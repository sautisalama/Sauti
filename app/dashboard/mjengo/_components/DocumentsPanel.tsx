"use client";

import { MjengoLoader } from "./MjengoLoader";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import { CheckCircle2, ClipboardList, Download, ExternalLink, Eye, FileImage, FileSpreadsheet, FileText, FolderSearch, LayoutGrid, List, Loader2, Maximize2, Plus, Presentation, Trash2, Upload, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import {
	addDocumentRequirement, deleteDocument, getDocumentUrl, listDocuments, registerDocumentFile, type DocRow,
} from "@/app/actions/mjengo";
import { documentPreview } from "@/app/actions/mjengo-attach";
import { safeFileName, uploadWithProgress } from "@/lib/client/upload";
import { DeadlineChip, fmtBytes, hasFile, type Kind } from "./shared";
import { AddDocumentDialog } from "./AddDocumentDialog";
import { FilePreviewDialog, PreviewBody, type PreviewSource } from "./FilePreviewDialog";

const MAX_BYTES = 25 * 1024 * 1024;

/** Where a document's file lives, in words. */
const whereIs = (d: DocRow) => (d.vault_file_id ? "From Files" : d.drive_file_id && !d.file_path ? "Google Drive" : null);

/** A small picture and colour for what kind of file it is, from its name. */
function glyph(d: DocRow): { Icon: typeof FileText; tone: string; label: string } {
	if (d.form_id) return { Icon: ClipboardList, tone: "#7c3aed", label: "Form" };
	const ext = (d.file_name || d.name).toLowerCase().split(".").pop() ?? "";
	if (["xlsx", "xls", "csv"].includes(ext)) return { Icon: FileSpreadsheet, tone: "#2e7d32", label: "Spreadsheet" };
	if (["pptx", "ppt", "deck"].includes(ext)) return { Icon: Presentation, tone: "#d9622b", label: "Presentation" };
	if (ext === "excalidraw") return { Icon: Workflow, tone: "#7c3aed", label: "Flow" };
	if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) return { Icon: FileImage, tone: "#0e7490", label: "Image" };
	if (ext === "pdf") return { Icon: FileText, tone: "#d6362b", label: "PDF" };
	return { Icon: FileText, tone: "#2f78b3", label: ext && ext.length <= 5 && (d.file_name || "").includes(".") ? ext.toUpperCase() : "Document" };
}

/** A document shown in full inside its own card. It is only opened once it scrolls near the screen. */
function LazyPreview({ docId, height = 420 }: { docId: string; height?: number }) {
	const box = useRef<HTMLDivElement>(null);
	const [near, setNear] = useState(false);
	const [src, setSrc] = useState<PreviewSource | null>(null);
	const [err, setErr] = useState<string | null>(null);
	useEffect(() => {
		const el = box.current;
		if (!el) return;
		if (typeof IntersectionObserver === "undefined") { setNear(true); return; }
		const io = new IntersectionObserver((e) => { if (e.some((x) => x.isIntersecting)) { setNear(true); io.disconnect(); } }, { rootMargin: "300px" });
		io.observe(el);
		return () => io.disconnect();
	}, []);
	useEffect(() => {
		if (!near) return;
		let live = true;
		unwrap(documentPreview(docId)).then((s) => live && setSrc(s)).catch((e) => live && setErr(e instanceof Error ? e.message : "Could not open the file."));
		return () => { live = false; };
	}, [near, docId]);
	return <div ref={box} className="relative flex items-center justify-center overflow-hidden bg-serene-neutral-100/70" style={{ height }}>{near ? <PreviewBody src={src} error={err} /> : null}</div>;
}

/**
 * The paperwork for one grant, opportunity or project: a checklist of what is needed, and the files. A file can be
 * uploaded, chosen from Files or Google Drive, or created here. Clicking a document shows it in a preview window.
 */
export function DocumentsPanel({ kind, entityId, entityName, onChange, defaultView }: { kind: Kind; entityId: string; entityName?: string; onChange?: () => void; defaultView?: "list" | "cards" | "full" }) {
	const { toast } = useToast();
	const [docs, setDocs] = useState<DocRow[] | null>(null);
	const [name, setName] = useState("");
	const [due, setDue] = useState("");
	const [progress, setProgress] = useState<Record<string, number>>({});
	const [adding, setAdding] = useState<{ docId?: string; docName?: string } | null>(null);
	const [previewId, setPreviewId] = useState<string | null>(null);
	const [view, setView] = useState<"list" | "cards" | "full">(defaultView ?? "list");
	useEffect(() => { try { const v = localStorage.getItem("ss_docs_view"); if (v === "list" || v === "cards" || v === "full") setView(v); } catch { /* default */ } }, []);
	const changeView = (v: "list" | "cards" | "full") => { setView(v); try { localStorage.setItem("ss_docs_view", v); } catch { /* ignore */ } };
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
		const linked = !!whereIs(d) || !!d.form_id;
		if (!window.confirm(linked ? `Remove "${d.name}" from this ${kind}? ${d.form_id ? "The form stays as it is." : "The file stays where it is."}` : `Delete "${d.name}"${d.file_name ? " and its file" : ""}?`)) return;
		try {
			await deleteDocument(d.id);
			await load();
			onChange?.();
		} catch (e) {
			fail("Could not delete", e);
		}
	};

	const metaOf = (d: DocRow, has: boolean, label: string) => {
		if (!has) return "Not added yet";
		const where = whereIs(d);
		return [where ?? label, d.file_name && d.file_name !== d.name && !d.form_id ? d.file_name : null, d.file_size ? fmtBytes(d.file_size) : null, d.uploaded_at ? format(new Date(d.uploaded_at), "d MMM") : null, d.uploaded_by_name].filter(Boolean).join(" · ");
	};

	/** A document with a file can be previewed, downloaded or removed; one still waiting for its file can be given one or removed. */
	const RowActions = ({ d, has, uploading }: { d: DocRow; has: boolean; uploading: boolean }) => (
		<>
			{has ? (
				<>
					<Button size="icon" variant="ghost" onClick={() => setPreviewId(d.id)} aria-label={`Preview ${d.name}`} title="Preview"><Eye className="h-4 w-4" /></Button>
					{d.form_id
						? <Button asChild size="icon" variant="ghost" aria-label={`Open the form ${d.name}`} title="Open the form"><a href={`/dashboard/mjengo/forms/${d.form_id}`} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /></a></Button>
						: <Button size="icon" variant="ghost" onClick={() => download(d)} aria-label={`Download ${d.name}`} title="Download"><Download className="h-4 w-4" /></Button>}
				</>
			) : (
				<>
					<Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2" onClick={() => setAdding({ docId: d.id, docName: d.name })} title="Choose from Files or Google Drive"><FolderSearch className="h-4 w-4" /> Choose</Button>
					<Button size="sm" variant="ghost" className="h-8 gap-1.5 px-2" disabled={uploading} onClick={() => chooseFile(d.id)}>{uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Upload</Button>
				</>
			)}
			<Button size="icon" variant="ghost" className="text-serene-neutral-400 hover:text-red-600" onClick={() => remove(d)} aria-label={`Delete ${d.name}`} title={whereIs(d) || d.form_id ? "Remove from here" : "Delete"}><Trash2 className="h-4 w-4" /></Button>
		</>
	);

	const missing = docs?.filter((d) => d.required && !hasFile(d)).length ?? 0;

	return (
		<section aria-label="Documents">
			<div className="mb-2 flex items-center justify-between gap-2">
				<h3 className="text-sm font-bold text-sauti-dark">Documents</h3>
				<div className="flex items-center gap-2">
					{docs && docs.length > 0 && (
						<div className="inline-flex rounded-lg border border-serene-neutral-200 p-0.5" role="group" aria-label="View">
							{([["list", List, "List"], ["cards", LayoutGrid, "Cards"], ["full", Maximize2, "Full"]] as const).map(([v, Icon, l]) => (
								<button key={v} type="button" aria-pressed={view === v} aria-label={`${l} view`} title={`${l} view`} onClick={() => changeView(v)} className={cn("flex h-7 w-7 items-center justify-center rounded-md", view === v ? "bg-sauti-teal text-white" : "text-serene-neutral-600 hover:bg-serene-neutral-100")}><Icon className="h-4 w-4" /></button>
							))}
						</div>
					)}
					{docs && docs.length > 0 && <span className={`text-xs font-medium ${missing ? "text-amber-700" : "text-emerald-700"}`}>{missing ? `${missing} still needed` : "All in"}</span>}
					<Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setAdding({})}><Plus className="h-4 w-4" /> Add a document</Button>
				</div>
			</div>

			{!docs ? (
				<MjengoLoader label="Loading documents" compact />
			) : docs.length === 0 ? (
				<p className="flex items-center gap-3 rounded-xl border border-serene-neutral-200 bg-white p-4 text-sm text-serene-neutral-500">
					<FileText className="h-5 w-5 text-serene-neutral-300" /> Add a file from Files or Google Drive, create one here, or list what is needed below.
				</p>
			) : view === "list" ? (
				<ul className="divide-y divide-serene-neutral-200 rounded-xl border border-serene-neutral-200 bg-white">
					{docs.map((d) => {
						const p = progress[d.id];
						const has = hasFile(d);
						const g = glyph(d);
						return (
							<li key={d.id} className="flex items-center gap-3 p-3">
								{has ? <g.Icon className="h-5 w-5 shrink-0" style={{ color: g.tone }} aria-hidden /> : <span className="h-5 w-5 shrink-0 rounded-full border-2 border-dashed border-serene-neutral-300" aria-hidden />}
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
									<p className="truncate text-xs text-serene-neutral-500">{metaOf(d, has, g.label)}</p>
									{p !== undefined && (
										<div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-serene-neutral-100" role="progressbar" aria-valuenow={p}>
											<div className="h-full rounded-full bg-sauti-teal transition-[width]" style={{ width: `${p}%` }} />
										</div>
									)}
								</div>
								{!has && <DeadlineChip date={d.due_date} />}
								<RowActions d={d} has={has} uploading={p !== undefined} />
							</li>
						);
					})}
				</ul>
			) : view === "full" ? (
				<ul className="space-y-4">
					{docs.map((d) => {
						const p = progress[d.id];
						const has = hasFile(d);
						const g = glyph(d);
						return (
							<li key={d.id} className="overflow-hidden rounded-2xl border border-serene-neutral-200 bg-white">
								<div className="flex items-center gap-3 border-b border-serene-neutral-200 px-3 py-2">
									{has ? <g.Icon className="h-5 w-5 shrink-0" style={{ color: g.tone }} aria-hidden /> : <span className="h-5 w-5 shrink-0 rounded-full border-2 border-dashed border-serene-neutral-300" aria-hidden />}
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-medium text-serene-neutral-900">{d.name}{!d.required && <span className="ml-2 text-xs font-normal text-serene-neutral-400">optional</span>}</p>
										<p className="truncate text-xs text-serene-neutral-500">{metaOf(d, has, g.label)}</p>
									</div>
									{!has && <DeadlineChip date={d.due_date} />}
									<RowActions d={d} has={has} uploading={p !== undefined} />
								</div>
								{has ? <LazyPreview docId={d.id} /> : <p className="px-4 py-6 text-center text-sm text-serene-neutral-500">Not added yet. Choose or upload the file and it shows here in full.</p>}
							</li>
						);
					})}
				</ul>
			) : (
				<ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
					{docs.map((d) => {
						const p = progress[d.id];
						const has = hasFile(d);
						const g = glyph(d);
						return (
							<li key={d.id} className="flex flex-col overflow-hidden rounded-xl border border-serene-neutral-200 bg-white">
								<button type="button" disabled={!has} onClick={() => setPreviewId(d.id)} aria-label={has ? `Preview ${d.name}` : undefined} className={cn("flex h-24 items-center justify-center", has ? "hover:opacity-90" : "cursor-default")} style={{ background: has ? `${g.tone}1a` : undefined }}>
									{has ? <g.Icon className="h-9 w-9" style={{ color: g.tone }} aria-hidden /> : <span className="rounded-full border-2 border-dashed border-serene-neutral-300 px-3 py-1 text-xs text-serene-neutral-500">Not added yet</span>}
								</button>
								<div className="min-w-0 flex-1 space-y-0.5 p-3">
									<p className="truncate text-sm font-medium text-serene-neutral-900">{d.name}{!d.required && <span className="ml-2 text-xs font-normal text-serene-neutral-400">optional</span>}</p>
									<p className="truncate text-xs text-serene-neutral-500">{metaOf(d, has, g.label)}</p>
									{!has && <div className="pt-1"><DeadlineChip date={d.due_date} /></div>}
									{p !== undefined && (
										<div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-serene-neutral-100" role="progressbar" aria-valuenow={p}>
											<div className="h-full rounded-full bg-sauti-teal transition-[width]" style={{ width: `${p}%` }} />
										</div>
									)}
								</div>
								<div className="flex items-center justify-end gap-0.5 border-t border-serene-neutral-200 px-2 py-1.5">
									<RowActions d={d} has={has} uploading={p !== undefined} />
								</div>
							</li>
						);
					})}
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
