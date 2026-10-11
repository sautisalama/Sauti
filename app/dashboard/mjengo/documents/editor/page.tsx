"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { WordcraftEditor, type SavedFile, type WordcraftEditorRef } from "@gamine/wordcraft-react";
import { MjengoLoader } from "../../_components/MjengoLoader";
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
		try {
			await persist(file);
			toast({ title: "Saved to the vault", description: file.name });
		} catch (e) {
			toast({ title: "Could not save", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
			throw e;
		}
	};

	return (
		<div className="flex h-full min-h-0 flex-col bg-white">
			{loading ? (
				<MjengoLoader label="Opening your document" className="h-full min-h-0" />
			) : (
				<div className="min-h-0 flex-1 overflow-hidden">
					<WordcraftEditor
						ref={ref}
						height="100%"
						document={doc}
						guardUnload
						author=""
						onSave={onSave}
						onError={(e) => toast({ title: "The editor reported a problem", description: e.message, variant: "destructive" })}
						loading={<MjengoLoader label="Starting the editor" hint="The first time takes a moment while it downloads." className="h-full min-h-0" />}
						fallback={(e) => <div className="p-6 text-sm text-red-700">The editor could not start: {e.message}. It needs a current browser with WebGL2 or WebGPU.</div>}
					/>
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
