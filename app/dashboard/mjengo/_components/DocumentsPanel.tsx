"use client";

import { MjengoLoader } from "./MjengoLoader";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Circle, Download, FileText, FolderSearch, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import {
	addDocumentRequirement, deleteDocument, getDocumentUrl, listDocuments, registerDocumentFile, type DocRow,
} from "@/app/actions/mjengo";
import { documentPreview } from "@/app/actions/mjengo-attach";
import { safeFileName, uploadWithProgress } from "@/lib/client/upload";
import { DeadlineChip, fmtBytes, hasFile, type Kind } from "./shared";
import { AddDocumentDialog } from "./AddDocumentDialog";
import { FilePreviewDialog } from "./FilePreviewDialog";

const MAX_BYTES = 25 * 1024 * 1024;

/** Where a document's file lives, in words. */
const whereIs = (d: DocRow) => (d.vault_file_id ? "From Files" : d.drive_file_id && !d.file_path ? "Google Drive" : null);

/**
 * The paperwork for one grant, opportunity or project: a checklist of what is needed, and the files. A file can be
 * uploaded, chosen from Files or Google Drive, or created here. Clicking a document shows it in a preview window.
 */
export function DocumentsPanel({ kind, entityId, entityName, onChange }: { kind: Kind; entityId: string; entityName?: string; onChange?: () => void }) {
	const { toast } = useToast();
	const [docs, setDocs] = useState<DocRow[] | null>(null);
	const [name, setName] = useState("");
	const [due, setDue] = useState("");
	const [progress, setProgress] = useState<Record<string, number>>({});
	const [adding, setAdding] = useState<{ docId?: string; docName?: string } | null>(null);
	const [previewId, setPreviewId] = useState<string | null>(null);
	const input = useRef<HTMLInputElement>(null);
	const target = useRef<string | "extra" | null>(null);

	const load = useCallback(async () => {
		setDocs(await listDocuments({ kind, entityId }));
	}, [kind, entityId]);
	useEffect(() => {
		load().catch(() => setDocs([]));
	}, [load]);
	// A file made in another tab is linked here the moment it is saved; show it when the person comes back.
	useEffect(() => {
		const h = () => { if (document.visibilityState === "visible") load().then(() => onChange?.()).catch(() => undefined); };
		document.addEventListener("visibilitychange", h);
		return () => document.removeEventListener("visibilitychange", h);
	}, [load, onChange]);

	const fail = (title: string, e: unknown) => toast({ title, description: e instanceof Error ? e.message : undefined, variant: "destructive" });
	const attachedFiles = useMemo(() => new Set((docs ?? []).map((d) => d.vault_file_id).filter(Boolean) as string[]), [docs]);
	const previewable = useMemo(() => (docs ?? []).filter(hasFile), [docs]);
	const previewIdx = previewable.findIndex((d) => d.id === previewId);
	const loadPreview = useCallback(async () => unwrap(documentPreview(previewId ?? "")), [previewId]);

	const addRequirement = async () => {
		if (!name.trim()) return;
		try {
			await addDocumentRequirement(kind, entityId, { name, required: true, dueDate: due || null });
			setName("");
			setDue("");
			await load();
			onChange?.();
		} catch (e) {
			fail("Could not add it", e);
		}
	};

	const chooseFile = (docId: string | "extra") => {
		target.current = docId;
		input.current?.click();
	};

	const upload = async (file: File) => {
		const docId = target.current;
		if (!docId) return;
		if (file.size > MAX_BYTES) return fail("File too large", new Error("Up to 25 MB."));
		const key = docId;
		setProgress((p) => ({ ...p, [key]: 0 }));
		try {
			const path = `${kind}/${entityId}/${Date.now()}-${safeFileName(file.name)}`;
			await uploadWithProgress("mjengo-docs", path, file, (pct) => setProgress((p) => ({ ...p, [key]: pct })));
			await registerDocumentFile({ docId: docId === "extra" ? undefined : docId, kind, entityId, path, fileName: file.name, size: file.size, mime: file.type || "application/octet-stream" });
			await load();
			onChange?.();
		} catch (e) {
			fail("Upload failed", e);
		} finally {
			setProgress((p) => {
				const { [key]: _drop, ...rest } = p;
				return rest;
			});
			if (input.current) input.current.value = "";
		}
	};

	const download = async (d: DocRow) => {
		try {
			window.open(await getDocumentUrl(d.id), "_blank", "noopener");
		} catch (e) {
			fail("Could not open", e);
		}
	};

	const remove = async (d: DocRow) => {
		const linked = !!whereIs(d);
		if (!window.confirm(linked ? `Remove "${d.name}" from this ${kind}? The file stays where it is.` : `Delete "${d.name}"${d.file_name ? " and its file" : ""}?`)) return;
		try {
			await deleteDocument(d.id);
			await load();
			onChange?.();
		} catch (e) {
			fail("Could not delete", e);
		}
	};

	const missing = docs?.filter((d) => d.required && !hasFile(d)).length ?? 0;

	return (
		<section aria-label="Documents">
			<div className="mb-2 flex items-center justify-between gap-2">
				<h3 className="text-sm font-bold text-sauti-dark">Documents</h3>
				<div className="flex items-center gap-2">
					{docs && docs.length > 0 && <span className={`text-xs font-medium ${missing ? "text-amber-700" : "text-emerald-700"}`}>{missing ? `${missing} still needed` : "All in"}</span>}
					<Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setAdding({})}><Plus className="h-4 w-4" /> Add a document</Button>
				</div>
			</div>

			{!docs ? (
				<MjengoLoader label="Loading documents" compact />
			) : (
				<ul className="divide-y divide-serene-neutral-100 rounded-xl border border-serene-neutral-100 bg-white">
					{docs.map((d) => {
						const p = progress[d.id];
						const has = hasFile(d);
						const where = whereIs(d);
						return (
							<li key={d.id} className="flex items-center gap-3 p-3">
								{has ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <Circle className="h-5 w-5 shrink-0 text-serene-neutral-300" />}
								<div className="min-w-0 flex-1">
									{has ? (
										<button type="button" onClick={() => setPreviewId(d.id)} className="block max-w-full truncate text-left text-sm font-medium text-serene-neutral-900 hover:text-sauti-teal hover:underline" aria-label={`Preview ${d.name}`}>
											{d.name}
											{!d.required && <span className="ml-2 text-xs font-normal text-serene-neutral-400">optional</span>}
										</button>
									) : (
										<p className="truncate text-sm font-medium text-serene-neutral-900">
											{d.name}
											{!d.required && <span className="ml-2 text-xs font-normal text-serene-neutral-400">optional</span>}
										</p>
									)}
									<p className="truncate text-xs text-serene-neutral-500">
										{has ? [where, d.file_name !== d.name ? d.file_name : null, d.file_size ? fmtBytes(d.file_size) : null, d.uploaded_at ? format(new Date(d.uploaded_at), "d MMM") : null, d.uploaded_by_name].filter(Boolean).join(" · ") : "Not added yet"}
									</p>
									{p !== undefined && (
										<div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-serene-neutral-100" role="progressbar" aria-valuenow={p}>
											<div className="h-full rounded-full bg-sauti-teal transition-[width]" style={{ width: `${p}%` }} />
										</div>
									)}
								</div>
								{!has && <DeadlineChip date={d.due_date} />}
								{has && <Button size="icon" variant="ghost" onClick={() => download(d)} aria-label={`Download ${d.name}`}><Download className="h-4 w-4" /></Button>}
								<Button size="icon" variant="ghost" onClick={() => setAdding({ docId: d.id, docName: d.name })} aria-label={`Choose an existing file for ${d.name}`} title="Choose from Files or Google Drive"><FolderSearch className="h-4 w-4" /></Button>
								<Button size="icon" variant="ghost" disabled={p !== undefined} onClick={() => chooseFile(d.id)} aria-label={has ? `Replace ${d.name}` : `Upload ${d.name}`}>
									{p !== undefined ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
								</Button>
								<Button size="icon" variant="ghost" className="text-serene-neutral-400 hover:text-red-600" onClick={() => remove(d)} aria-label={`Delete ${d.name}`}><Trash2 className="h-4 w-4" /></Button>
							</li>
						);
					})}
					{docs.length === 0 && (
						<li className="flex items-center gap-3 p-4 text-sm text-serene-neutral-500">
							<FileText className="h-5 w-5 text-serene-neutral-300" /> Add a file from Files or Google Drive, create one here, or list what is needed below.
						</li>
					)}
				</ul>
			)}

			<div className="mt-3 flex flex-col gap-2 sm:flex-row">
				<Input value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addRequirement()} placeholder="Add a required document, e.g. Audited accounts" />
				<Input type="date" value={due} onChange={(e) => setDue(e.target.value)} className="sm:w-[150px]" aria-label="Needed by" />
				<Button onClick={addRequirement} disabled={!name.trim()} className="gap-1.5"><Plus className="h-4 w-4" /> Add</Button>
			</div>
			<Button variant="ghost" size="sm" className="mt-2 gap-1.5 text-serene-neutral-600" onClick={() => chooseFile("extra")} disabled={progress.extra !== undefined}>
				{progress.extra !== undefined ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload a new file
			</Button>
			<input ref={input} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />

			<AddDocumentDialog
				open={!!adding}
				onClose={() => setAdding(null)}
				kind={kind}
				entityId={entityId}
				entityName={entityName}
				docId={adding?.docId}
				docName={adding?.docName}
				attachedFiles={attachedFiles}
				onAdded={() => { void load(); onChange?.(); }}
			/>
			<FilePreviewDialog
				open={!!previewId}
				onClose={() => setPreviewId(null)}
				load={loadPreview}
				label={previewable[previewIdx]?.name}
				position={previewable.length > 1 && previewIdx >= 0 ? `${previewIdx + 1} of ${previewable.length}` : undefined}
				onPrev={previewable.length > 1 ? () => setPreviewId(previewable[(previewIdx - 1 + previewable.length) % previewable.length].id) : undefined}
				onNext={previewable.length > 1 ? () => setPreviewId(previewable[(previewIdx + 1) % previewable.length].id) : undefined}
			/>
		</section>
	);
}
