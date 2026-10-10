"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Loader2 } from "lucide-react";
import { WordcraftEditor, type SavedFile, type WordcraftEditorRef } from "@gamine/wordcraft-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { putToSignedUrl } from "@/lib/client/upload";
import { finishReplace, getFileUrl, prepareReplace, prepareUpload, registerUpload } from "../../vault/api";

const extOf = (n: string) => n.split(".").pop()?.toLowerCase() ?? "";

/** The WordCraft document editor, saving into the vault so sharing, folders and email attachments all apply. */
function EditorScreen() {
	const { toast } = useToast();
	const params = useSearchParams();
	const initialFile = params.get("file");
	const folderParam = params.get("folder");

	const ref = useRef<WordcraftEditorRef>(null);
	const [fileId, setFileId] = useState<string | null>(initialFile);
	const [name, setName] = useState("Untitled document.docx");
	const [folderId, setFolderId] = useState<string | null>(folderParam);
	const [level, setLevel] = useState<"view" | "share" | "edit">("edit");
	const [doc, setDoc] = useState<{ name: string; data: ArrayBuffer } | null>(null);
	const [loading, setLoading] = useState(!!initialFile);
	const [dirty, setDirty] = useState(false);
	const [saving, setSaving] = useState(false);
	const [savedAt, setSavedAt] = useState<Date | null>(null);

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

	/** Write what the editor produced into the vault: over the open file, or as a new one. */
	const persist = async (file: SavedFile) => {
		const blob = new File([file.bytes as BlobPart], file.name, { type: file.mimeType });
		const sameKind = fileId && level === "edit" && extOf(file.name) === extOf(name);
		if (sameKind) {
			const { signedUrl } = await prepareReplace(fileId!);
			await putToSignedUrl(signedUrl, blob);
			await finishReplace(fileId!, blob.size);
			return;
		}
		// New file, or "Save As" to another format: a fresh vault file you own.
		const target = level === "edit" || !fileId ? folderId : null;
		const { path, signedUrl } = await prepareUpload(target, file.name, blob.size);
		await putToSignedUrl(signedUrl, blob);
		const created = await registerUpload(target, path, file.name, blob.size, file.mimeType || null);
		if (extOf(file.name) === "docx" || !fileId) {
			setFileId(created.id);
			setName(file.name);
			setLevel("edit");
			setFolderId(target);
			window.history.replaceState(null, "", `/dashboard/mjengo/documents/editor?file=${created.id}`);
		}
	};

	const onSave = async (file: SavedFile) => {
		setSaving(true);
		try {
			await persist(file);
			setSavedAt(new Date());
			setDirty(false);
			toast({ title: "Saved to the vault", description: file.name });
		} catch (e) {
			toast({ title: "Could not save", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
			throw e;
		} finally {
			setSaving(false);
		}
	};

	return (
		<div className="flex h-full min-h-0 flex-col bg-white">
			<div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-serene-neutral-200 px-3 py-1.5">
				<Button asChild variant="ghost" size="sm" className="gap-1.5">
					<Link href="/dashboard/mjengo/documents"><ArrowLeft className="h-4 w-4" /> Documents</Link>
				</Button>
				<div className="min-w-0 flex-1">
					<p className="truncate text-sm font-semibold text-sauti-dark">{name}</p>
					<p className="text-xs text-serene-neutral-500">
						{level !== "edit" ? "View only: Save makes your own copy. " : ""}
						{saving ? "Saving..." : dirty ? "Unsaved changes" : savedAt ? `Saved ${savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}` : "Stored in the vault"}
					</p>
				</div>
			</div>

			{loading ? (
				<div className="flex min-h-0 flex-1 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-serene-neutral-400" /></div>
			) : (
				<div className="min-h-0 flex-1 overflow-hidden">
					<WordcraftEditor
						ref={ref}
						height="100%"
						document={doc}
						guardUnload
						author=""
						onChange={(info) => setDirty(info.dirty)}
						onSave={onSave}
						onError={(e) => toast({ title: "The editor reported a problem", description: e.message, variant: "destructive" })}
						loading={<div className="flex h-full items-center justify-center gap-2 text-sm text-serene-neutral-500"><Loader2 className="h-5 w-5 animate-spin" /> Starting the editor (first load downloads about 10 MB)...</div>}
						fallback={(e) => <div className="p-6 text-sm text-red-700">The editor could not start: {e.message}. It needs a current browser with WebGL2 or WebGPU.</div>}
					/>
				</div>
			)}
		</div>
	);
}

export default function EditorPage() {
	return (
		<Suspense fallback={<div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-serene-neutral-400" /></div>}>
			<EditorScreen />
		</Suspense>
	);
}
