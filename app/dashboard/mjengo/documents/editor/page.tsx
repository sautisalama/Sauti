"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { WordcraftEditor, httpVersionStore, type SavedFile, type WordcraftEditorRef } from "@gamine/wordcraft-react";
import * as Y from "yjs";
import type { AiOptions } from "@gamine/wordcraft-react";
import { yjsCollaboration } from "@gamine/wordcraft-react/collab";
import { MjengoLoader } from "../../_components/MjengoLoader";
import { createClient } from "@/utils/supabase/client";
import { useUser } from "@/hooks/useUser";
import { SupabaseYProvider } from "@/lib/client/supabase-yjs";
import { listTemplates } from "@/app/actions/mjengo-templates";
import { useToast } from "@/hooks/use-toast";
import { putToSignedUrl } from "@/lib/client/upload";
import { DocAssist } from "./_DocAssist";
import { ShareDialog } from "../../_components/ShareDialog";
import { finishReplace, getFileUrl, prepareReplace, prepareUpload, registerUpload } from "../../vault/api";

/** Writing help runs on our server so the organisation key never reaches the browser. */
const ai: AiOptions = {
	name: "Salama AI",
	allowUserKey: true,
	studio: true,
	complete: (req) =>
		(async function* () {
			const res = await fetch("/api/mjengo/ai/complete", {
				method: "POST",
				signal: req.signal,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ prompt: req.prompt, action: req.action, selection: req.selection, document: req.document, instructions: req.instructions }),
			});
			if (!res.ok || !res.body) throw new Error((await res.text().catch(() => "")) || "The AI service is unavailable.");
			const reader = res.body.getReader();
			const dec = new TextDecoder();
			for (;;) {
				const { done, value } = await reader.read();
				if (done) break;
				yield dec.decode(value, { stream: true });
			}
		})(),
};

const COLORS = ["#0f766e", "#c2410c", "#7c3aed", "#0369a1", "#be123c", "#4d7c0f", "#a16207", "#0e7490"];
const colorFor = (s: string) => COLORS[[...s].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length];

const extOf = (n: string) => n.split(".").pop()?.toLowerCase() ?? "";

/** The WordCraft document editor, saving into the vault so sharing, folders and email attachments all apply. */
function EditorScreen() {
	const { toast } = useToast();
	const params = useSearchParams();
	const initialFile = params.get("file");
	const folderParam = params.get("folder");
	const templateId = params.get("template");
	const draftKey = params.get("draft");

	const ref = useRef<WordcraftEditorRef>(null);
	const [shareOpen, setShareOpen] = useState(false);
	const [copied, setCopied] = useState(false);
	const [fileId, setFileId] = useState<string | null>(initialFile);
	const [name, setName] = useState("Untitled document.docx");
	const [folderId, setFolderId] = useState<string | null>(folderParam);
	const [level, setLevel] = useState<"view" | "share" | "edit">("edit");
	const [doc, setDoc] = useState<{ name: string; data: ArrayBuffer } | null>(null);
	const [loading, setLoading] = useState(!!initialFile || !!templateId || !!draftKey);

	// A new document that starts from a template.
	useEffect(() => {
		if (!templateId || initialFile) return;
		let cancelled = false;
		(async () => {
			try {
				const r = await listTemplates("document");
				const t = r.ok ? r.data.find((x) => x.id === templateId) : null;
				if (t && !cancelled) {
					const html = `<!doctype html><html><head><meta charset="utf-8"><title>${t.name}</title></head><body>${t.body}</body></html>`;
					setDoc({ name: `${t.name}.html`, data: new TextEncoder().encode(html).buffer as ArrayBuffer });
					setName(`${t.name}.docx`);
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => { cancelled = true; };
	}, [templateId, initialFile]);

	// A draft handed over by another screen (a form report, say) opens as a new document.
	useEffect(() => {
		if (!draftKey || initialFile) return;
		try {
			const raw = sessionStorage.getItem(`ss_draft_${draftKey}`);
			if (raw) {
				const d = JSON.parse(raw) as { title: string; html: string };
				const html = `<!doctype html><html><head><meta charset="utf-8"><title>${d.title}</title></head><body>${d.html}</body></html>`;
				setDoc({ name: `${d.title}.html`, data: new TextEncoder().encode(html).buffer as ArrayBuffer });
				setName(`${d.title.replace(/[\\/:*?"<>|]+/g, " ")}.docx`);
			}
		} catch { /* nothing to open */ }
		setLoading(false);
	}, [draftKey, initialFile]);

	// Open an existing file from the vault.
	useEffect(() => {
		if (!initialFile) return;
		let cancelled = false;
		(async () => {
			try {
				const info = await getFileUrl(initialFile);
				const res = await fetch(info.url);
				if (!res.ok) throw new Error("Could not download the file.");
				const data = await res.arrayBuffer();
				if (cancelled) return;
				setName(info.name);
				setLevel(info.level);
				setFolderId(info.folderId);
				setDoc({ name: info.name, data });
			} catch (e) {
				toast({ title: "Could not open the document", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
			} finally {
				if (!cancelled) setLoading(false);
			}
		})();
		return () => { cancelled = true; };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [initialFile]);

	const me = useUser();
	const person = useMemo(() => {
		const p = me?.profile as { first_name?: string | null; last_name?: string | null } | null | undefined;
		const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ") || me?.email || "Someone";
		return { name, id: me?.id ?? undefined, color: colorFor(me?.id ?? name) };
	}, [me?.id, me?.email, me?.profile]);

	// Co-editing: everyone who opens this file with edit rights joins the same live document.
	const collab = useMemo(() => {
		if (!initialFile || loading || level !== "edit" || !me?.id) return null;
		const ydoc = new Y.Doc();
		const provider = new SupabaseYProvider(ydoc, createClient(), `mjengo-doc:${initialFile}`, `${me.id}:${Math.random().toString(36).slice(2, 8)}`);
		return { provider, collaboration: yjsCollaboration({ doc: ydoc, provider, user: person }) };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [initialFile, loading, level, me?.id]);
	useEffect(() => () => collab?.provider.destroy(), [collab]);

	// Where the open document lives, kept in a ref so a save that fires right after another (AutoSave)
	// always sees the file the previous one created.
	const target = useRef({ fileId: initialFile as string | null, level: "edit" as "view" | "share" | "edit", name: "Untitled document.docx", folderId: folderParam as string | null });
	target.current = { fileId, level, name, folderId };
	const queue = useRef<Promise<unknown>>(Promise.resolve());

	/** Write what the editor produced into the vault: over the open file, or as a new one. */
	const persist = async (file: SavedFile) => {
		const t = target.current;
		const blob = new File([file.bytes as BlobPart], file.name, { type: file.mimeType });
		const sameKind = t.fileId && t.level === "edit" && extOf(file.name) === extOf(t.name);
		if (sameKind) {
			const { signedUrl } = await prepareReplace(t.fileId!);
			await putToSignedUrl(signedUrl, blob);
			await finishReplace(t.fileId!, blob.size);
			return;
		}
		// New file, or "Save As" to another format: a fresh vault file you own.
		const folder = t.level === "edit" || !t.fileId ? t.folderId : null;
		const { path, signedUrl } = await prepareUpload(folder, file.name, blob.size);
		await putToSignedUrl(signedUrl, blob);
		const created = await registerUpload(folder, path, file.name, blob.size, file.mimeType || null);
		if (extOf(file.name) === "docx" || !t.fileId) {
			target.current = { fileId: created.id, level: "edit", name: file.name, folderId: folder };
			setFileId(created.id);
			setName(file.name);
			setLevel("edit");
			setFolderId(folder);
			window.history.replaceState(null, "", `/dashboard/mjengo/documents/editor?file=${created.id}`);
		}
	};

	// One save at a time, in order.
	const onSave = (file: SavedFile) => {
		const run = queue.current.catch(() => undefined).then(async () => {
			try {
				await persist(file);
				if (file.reason !== "autosave") toast({ title: "Saved to the vault", description: file.name });
			} catch (e) {
				toast({ title: file.reason === "autosave" ? "AutoSave could not reach the vault" : "Could not save", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
				throw e;
			}
		});
		queue.current = run;
		return run;
	};

	return (
		<div className="flex h-full min-h-0 flex-col bg-white">
			{loading ? (
				<MjengoLoader label="Opening your document" className="h-full min-h-0" />
			) : (
				<div className="relative min-h-0 flex-1 overflow-hidden">
					<WordcraftEditor
						ref={ref}
						height="100%"
						document={doc}
						guardUnload
						autoSave={level === "edit"}
						user={person}
						// Version history is kept on the server per document, so everyone sees the same list.
						versionHistory={fileId ? { store: httpVersionStore(`/api/mjengo/docs/versions/${fileId}`), documentId: fileId, interval: 120_000 } : true}
						ai={ai}
						collaboration={collab?.collaboration ?? null}
						onSave={onSave}
						onError={(e) => toast({ title: "The editor reported a problem", description: e.message, variant: "destructive" })}
						loading={<MjengoLoader label="Starting the editor" hint="The first time takes a moment while it downloads." className="h-full min-h-0" />}
						fallback={(e) => <div className="p-6 text-sm text-red-700">The editor could not start: {e.message}. It needs a current browser with WebGL2 or WebGPU.</div>}
					/>
					<DocAssist editor={ref} />
					{fileId && (
						<div className="absolute bottom-14 left-3 z-30 flex items-center gap-1.5 sm:bottom-16">
							<button
								onClick={() => { const url = `${window.location.origin}/dashboard/mjengo/documents/editor?file=${fileId}`; navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1600); toast({ title: "Link copied", description: "Anyone with access who opens it edits this same document, live." }); }).catch(() => undefined); }}
								className="flex h-9 items-center gap-1.5 rounded-full border border-black/10 bg-white px-3 text-sm font-medium text-[#37352f] shadow-sm hover:bg-[#f7f7f5]"
							>{copied ? "Copied" : "Copy link"}</button>
							{level !== "view" && <button onClick={() => setShareOpen(true)} className="flex h-9 items-center gap-1.5 rounded-full bg-sauti-teal px-3.5 text-sm font-semibold text-white shadow-sm hover:bg-sauti-dark">Share</button>}
						</div>
					)}
					<ShareDialog item={shareOpen && fileId ? ({ type: "file", id: fileId, name } as never) : null} onClose={() => setShareOpen(false)} />
				</div>
			)}
		</div>
	);
}

export default function EditorPage() {
	return (
		<Suspense fallback={<MjengoLoader label="Starting the editor" className="h-full min-h-0" />}>
			<EditorScreen />
		</Suspense>
	);
}
