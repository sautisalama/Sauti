"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, Circle, Download, FileText, Loader2, Plus, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import {
	addDocumentRequirement, deleteDocument, getDocumentUrl, listDocuments, registerDocumentFile, type DocRow,
} from "@/app/actions/mjengo";
import { safeFileName, uploadWithProgress } from "@/lib/client/upload";
import { DeadlineChip, fmtBytes, type Kind } from "./shared";

const MAX_BYTES = 25 * 1024 * 1024;

/** The paperwork for one grant, opportunity or project: a checklist of what is needed, and the files. */
export function DocumentsPanel({ kind, entityId, onChange }: { kind: Kind; entityId: string; onChange?: () => void }) {
	const { toast } = useToast();
	const [docs, setDocs] = useState<DocRow[] | null>(null);
	const [name, setName] = useState("");
	const [due, setDue] = useState("");
	const [progress, setProgress] = useState<Record<string, number>>({});
	const input = useRef<HTMLInputElement>(null);
	const target = useRef<string | "extra" | null>(null);

	const load = useCallback(async () => {
		setDocs(await listDocuments({ kind, entityId }));
	}, [kind, entityId]);
	useEffect(() => {
		load().catch(() => setDocs([]));
	}, [load]);

	const fail = (title: string, e: unknown) => toast({ title, description: e instanceof Error ? e.message : undefined, variant: "destructive" });

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

	const open = async (d: DocRow) => {
		try {
			window.open(await getDocumentUrl(d.id), "_blank", "noopener");
		} catch (e) {
			fail("Could not open", e);
		}
	};

	const remove = async (d: DocRow) => {
		if (!window.confirm(`Delete "${d.name}"${d.file_name ? " and its file" : ""}?`)) return;
		try {
			await deleteDocument(d.id);
			await load();
			onChange?.();
		} catch (e) {
			fail("Could not delete", e);
		}
	};

	const missing = docs?.filter((d) => d.required && !d.file_path).length ?? 0;

	return (
		<section aria-label="Documents">
			<div className="mb-2 flex items-center justify-between">
				<h3 className="text-sm font-bold text-serene-neutral-900">Documents</h3>
				{docs && docs.length > 0 && <span className={`text-xs font-medium ${missing ? "text-amber-700" : "text-emerald-700"}`}>{missing ? `${missing} still needed` : "All in"}</span>}
			</div>

			{!docs ? (
				<Loader2 className="h-5 w-5 animate-spin text-serene-neutral-400" />
			) : (
				<ul className="divide-y divide-serene-neutral-100 rounded-xl border border-serene-neutral-100 bg-white">
					{docs.map((d) => {
						const p = progress[d.id];
						return (
							<li key={d.id} className="flex items-center gap-3 p-3">
								{d.file_path ? <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" /> : <Circle className="h-5 w-5 shrink-0 text-serene-neutral-300" />}
								<div className="min-w-0 flex-1">
									<p className="truncate text-sm font-medium text-serene-neutral-900">
										{d.name}
										{!d.required && <span className="ml-2 text-xs font-normal text-serene-neutral-400">optional</span>}
									</p>
									<p className="truncate text-xs text-serene-neutral-500">
										{d.file_path ? `${d.file_name} · ${fmtBytes(d.file_size)}${d.uploaded_at ? ` · ${format(new Date(d.uploaded_at), "d MMM")}` : ""}${d.uploaded_by_name ? ` · ${d.uploaded_by_name}` : ""}` : "Not uploaded yet"}
									</p>
									{p !== undefined && (
										<div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-serene-neutral-100" role="progressbar" aria-valuenow={p}>
											<div className="h-full rounded-full bg-purple-600 transition-[width]" style={{ width: `${p}%` }} />
										</div>
									)}
								</div>
								{!d.file_path && <DeadlineChip date={d.due_date} />}
								{d.file_path ? (
									<Button size="icon" variant="ghost" onClick={() => open(d)} aria-label={`Download ${d.name}`}><Download className="h-4 w-4" /></Button>
								) : null}
								<Button size="icon" variant="ghost" disabled={p !== undefined} onClick={() => chooseFile(d.id)} aria-label={d.file_path ? `Replace ${d.name}` : `Upload ${d.name}`}>
									{p !== undefined ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
								</Button>
								<Button size="icon" variant="ghost" className="text-serene-neutral-400 hover:text-red-600" onClick={() => remove(d)} aria-label={`Delete ${d.name}`}><Trash2 className="h-4 w-4" /></Button>
							</li>
						);
					})}
					{docs.length === 0 && (
						<li className="flex items-center gap-3 p-4 text-sm text-serene-neutral-500">
							<FileText className="h-5 w-5 text-serene-neutral-300" /> List what is needed below, then upload each file against it.
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
				{progress.extra !== undefined ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload another file
			</Button>
			<input ref={input} type="file" className="hidden" onChange={(e) => e.target.files?.[0] && upload(e.target.files[0])} />
		</section>
	);
}
