"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { WordcraftEditor, type PresenceUser, type SavedFile, type WordcraftEditorRef } from "@gamine/wordcraft-react";
import { directVersionStore } from "@/lib/client/direct-version-store";
import * as Y from "yjs";
import type { AiOptions } from "@gamine/wordcraft-react";
import { getBrand } from "@/app/actions/mjengo-brand";
import { unwrap } from "@/lib/action-result";
import { designSystemsForForms } from "@/app/actions/mjengo-forms";
import { yjsCollaboration } from "@gamine/wordcraft-react/collab";
import { MjengoLoader } from "../../_components/MjengoLoader";
import { createClient } from "@/utils/supabase/client";
import { useUser } from "@/hooks/useUser";
import { SupabaseYProvider } from "@/lib/client/supabase-yjs";
import { listTemplates } from "@/app/actions/mjengo-templates";
import { useToast } from "@/hooks/use-toast";
import { putToSignedUrl } from "@/lib/client/upload";
import { ArrowLeft } from "lucide-react";
import { DocAssist } from "./_DocAssist";
import { DocBar } from "./_DocBar";
import { watchedVersionStore } from "@/lib/client/watched-version-store";
import { ShareDialog } from "../../_components/ShareDialog";
import { useTeam } from "../../_components/People";
import { finishReplace, getFileUrl, prepareReplace, prepareUpload, registerUpload } from "../../vault/api";

/** Writing help runs on our server so the organisation key never reaches the browser. */
const ai: AiOptions = {
	name: "Salama AI",
	allowUserKey: true,
	studio: true,
	// Answers become real headings, lists and tables; "Ask this document" answers from the document with citations.
	structure: true,
	chat: true,
	complete: (req) =>
		(async function* () {
			const res = await fetch("/api/mjengo/ai/complete", {
				method: "POST",
				signal: req.signal,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ prompt: req.prompt, action: req.action, selection: req.selection, document: req.document, instructions: req.instructions, history: req.history, goals: req.goals, language: req.language, data: req.data }),
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

/** The organisation's letterhead and the colours of every saved design system, handed to AI Studio. */
async function loadBrand(onMore?: (more: NonNullable<AiOptions["palettes"]>) => void): Promise<Pick<AiOptions, "letterhead" | "palettes">> {
	const out: Pick<AiOptions, "letterhead" | "palettes"> = {};
	try {
		// A server action can fail once while the page is still settling; the brand is asked for up to three times.
		let b: Awaited<ReturnType<typeof getBrand>> extends infer R ? (R extends { ok: true; data: infer D } ? D : never) : never;
		for (let attempt = 0; ; attempt++) {
			try { b = await unwrap(getBrand()); break; } catch (e) { if (attempt >= 2) throw e; await new Promise((r) => setTimeout(r, 600 * (attempt + 1))); }
		}
		let logo: string | undefined;
		try {
			if (b.logo?.startsWith("data:")) logo = b.logo;
			else if (b.logo) {
				const r = await fetch(b.logo);
				if (r.ok) {
					const blob = await r.blob();
					logo = await new Promise<string>((resolve, reject) => { const fr = new FileReader(); fr.onload = () => resolve(String(fr.result)); fr.onerror = reject; fr.readAsDataURL(blob); });
				}
			}
		} catch { /* a letterhead without the logo is still a letterhead */ }
		const hex = (c: string) => c.replace(/^#/, "").toUpperCase();
		out.letterhead = { name: b.name, tagline: b.tagline || undefined, address: b.address || undefined, contact: b.contact || undefined, logo, logoWidth: b.letterhead.logoWidth, align: b.letterhead.align, rule: b.letterhead.rule, font: b.fonts.heading };
		out.palettes = [{ id: "brand", name: `${b.name} brand`, primary: hex(b.palette.primary), secondary: hex(b.palette.secondary), accent: hex(b.palette.accent), muted: hex(b.palette.muted) }];
	} catch { /* defaults */ }
	// The saved design systems follow, without holding the editor back: the palettes are read as they are shown.
	void (async () => {
		try {
			const r = await designSystemsForForms();
			const hex = (c: string) => c.replace(/^#/, "").toUpperCase();
			const palettes = r
				.filter((d) => (d.colors ?? []).length)
				.map((d) => ({ id: `ds-${d.id}`, name: d.name, primary: hex(d.colors[0]), secondary: hex(d.colors[1] ?? d.colors[0]), accent: hex(d.colors[2] ?? d.colors[0]), muted: "6B7280" }));
			if (palettes.length) onMore?.(palettes);
		} catch { /* built-in palettes */ }
	})();
	return out;
}

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
	const [versionsOpen, setVersionsOpen] = useState(false);
	const [brand, setBrand] = useState<Pick<AiOptions, "letterhead" | "palettes"> | null>(null);
	// Saved design systems arrive after the brand and never hold the editor back or replace its letterhead.
	const [designPalettes, setDesignPalettes] = useState<NonNullable<AiOptions["palettes"]>>([]);
	useEffect(() => {
		// The studio remembers a letterhead per browser. One saved with no organisation name (the page was only
		// looked at) would hide the organisation's own, so it is dropped before the editor starts.
		try {
			const raw = localStorage.getItem("wordcraft.ai.studio");
			const v = raw ? JSON.parse(raw) : null;
			if (v && v.letterhead && !String(v.letterhead.name ?? "").trim()) { v.letterhead = null; localStorage.setItem("wordcraft.ai.studio", JSON.stringify(v)); }
		} catch { /* no saved studio */ }
		Promise.race([loadBrand(setDesignPalettes), new Promise<Pick<AiOptions, "letterhead" | "palettes">>((res) => setTimeout(() => res({}), 20000))]).then((b) => setBrand(b));
	}, []);
	const aiOptions = useMemo<AiOptions>(() => ({ ...ai, ...(brand ?? {}), palettes: [...(brand?.palettes ?? []), ...designPalettes] }), [brand, designPalettes]);
	const [metaKey, setMetaKey] = useState(0);
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
	const team = useTeam();
	// The people who can be @mentioned or given a comment to follow up.
	const mentionable = useMemo(() => team.map((t) => ({ id: t.id, name: t.name, email: t.email ?? undefined, avatarUrl: t.avatar ?? undefined })), [team]);
	const person = useMemo(() => {
		const p = me?.profile as { first_name?: string | null; last_name?: string | null } | null | undefined;
		const name = [p?.first_name, p?.last_name].filter(Boolean).join(" ") || me?.email || "Someone";
		return { name, id: me?.id ?? undefined, color: colorFor(me?.id ?? name) };
	}, [me?.id, me?.email, me?.profile]);

	// Co-editing: everyone who opens this file with edit rights joins the same live document.
	const collab = useMemo(() => {
		if (!initialFile || loading || !me?.id) return null;
		const ydoc = new Y.Doc();
		const provider = new SupabaseYProvider(ydoc, createClient(), `mjengo-doc:${initialFile}`, `${me.id}:${Math.random().toString(36).slice(2, 8)}`);
		return { provider, collaboration: yjsCollaboration({ doc: ydoc, provider, user: person, onPresenceChange: setLive }) };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [initialFile, loading, me?.id]);
	useEffect(() => () => collab?.provider.destroy(), [collab]);
	// Everyone in the document right now, for the header (named people and anonymous guests alike).
	const [live, setLive] = useState<PresenceUser[]>([]);

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
			{loading || !brand ? (
				<MjengoLoader label="Opening your document" className="h-full min-h-0" />
			) : (
				<>
				<div className="flex h-11 shrink-0 items-center justify-between border-b border-black/10 bg-white px-2 sm:hidden">
					<button onClick={() => window.history.back()} className="flex h-9 items-center gap-1 rounded-full px-2 text-sm font-medium text-[#37352f]" aria-label="Back">
						<ArrowLeft className="h-4 w-4" /> Back
					</button>
					{fileId && level !== "view" && <button onClick={() => setShareOpen(true)} className="flex h-9 items-center gap-1.5 rounded-full bg-sauti-teal px-3.5 text-sm font-semibold text-white">Share</button>}
				</div>
									{fileId && <DocBar live={live} fileId={fileId} name={name} canShare={level !== "view"} refreshKey={metaKey} onShare={() => setShareOpen(true)} onHistory={() => setVersionsOpen(true)} />}
					<div className="relative min-h-0 flex-1 overflow-hidden">
						<WordcraftEditor
						ref={ref}
						height="100%"
						document={doc}
						guardUnload
						autoSave={level === "edit"}
						user={person}
						// Version history is kept on the server per document, so everyone sees the same list.
													versionHistory={fileId ? { store: watchedVersionStore(directVersionStore(`/api/mjengo/docs/versions/${fileId}`), (what, m) => toast({ title: what === "save" ? "Version history could not be saved" : "Version history could not be loaded", description: `${m}. Your document is still saved.`, variant: "destructive" })), documentId: fileId, interval: 120_000 } : true}
							versionsOpen={versionsOpen}
							onVersionsOpenChange={setVersionsOpen}
						ai={aiOptions}
						collaboration={collab?.collaboration ?? null}
						permission={level === "edit" ? "edit" : "view"}
						comments={{ people: mentionable }}
						presence
						checks
						tools={{ outline: true, accessibility: true, sources: true, wordCount: true, voice: true, translate: true }}
						onSave={onSave}
						onError={(e) => toast({ title: "The editor reported a problem", description: e.message, variant: "destructive" })}
						loading={<MjengoLoader label="Starting the editor" hint="The first time takes a moment while it downloads." className="h-full min-h-0" />}
						fallback={(e) => <div className="p-6 text-sm text-red-700">The editor could not start: {e.message}. It needs a current browser with WebGL2 or WebGPU.</div>}
					/>
					<DocAssist editor={ref} />
					<ShareDialog item={shareOpen && fileId ? ({ type: "file", id: fileId, name } as never) : null} onClose={() => { setShareOpen(false); setMetaKey((k) => k + 1); }} />
				</div>
				</>
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
