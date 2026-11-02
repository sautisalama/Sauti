"use client";

import { useCallback, useEffect, useState } from "react";
import { ClipboardList, FilePlus2, FileSpreadsheet, FileText, FolderOpen, Link2, Loader2, Presentation, Search, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { attachDriveFile, attachVaultFile, createFormForRecord, searchDrive, type DriveSearch } from "@/app/actions/mjengo-attach";
import { recentFiles, searchFiles } from "../vault/api";
import { fmtBytes, type Kind } from "./shared";
import { setPendingAttach } from "@/lib/client/pending-attach";

type FileHit = { id: string; name: string; size: number; folder?: string | null };

const NEW_FILES = [
	{ id: "doc", label: "Document", hint: "Write it with the document editor", href: "/dashboard/mjengo/documents/editor", Icon: FileText },
	{ id: "sheet", label: "Spreadsheet", hint: "A budget or a table", href: "/dashboard/mjengo/files/sheet", Icon: FileSpreadsheet },
	{ id: "deck", label: "Presentation", hint: "Slides for a pitch", href: "/dashboard/mjengo/files/deck", Icon: Presentation },
	{ id: "flow", label: "Flow or diagram", hint: "Draw a process or a plan", href: "/dashboard/mjengo/files/draw", Icon: Workflow },
	{ id: "form", label: "Form", hint: "Questions for people to answer", href: "/dashboard/mjengo/forms", Icon: ClipboardList },
] as const;

const useDebounced = <T,>(v: T, ms = 300) => {
	const [d, setD] = useState(v);
	useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
	return d;
};

/**
 * Add a document to a record from somewhere that already holds it: a file in Files, a file in Google Drive, or a
 * new file made right here. Only a link is kept, so the file stays where it is and can be reused on other records.
 * With `docId` it fills that checklist item instead of adding another document.
 */
export function AddDocumentDialog({ open, onClose, kind, entityId, entityName, docId, docName, attachedFiles, onAdded }: {
	open: boolean;
	onClose: () => void;
	kind: Kind;
	entityId: string;
	entityName?: string;
	docId?: string;
	docName?: string;
	/** Files already on this record, so they are not offered twice. */
	attachedFiles: Set<string>;
	onAdded: () => void;
}) {
	const { toast } = useToast();
	const [tab, setTab] = useState("files");
	const [q, setQ] = useState("");
	const dq = useDebounced(q);
	const [files, setFiles] = useState<FileHit[] | null>(null);
	const [drive, setDrive] = useState<DriveSearch | null>(null);
	const [link, setLink] = useState("");
	const [busy, setBusy] = useState<string | null>(null);

	useEffect(() => { if (open) { setQ(""); setLink(""); setTab("files"); } }, [open]);

	useEffect(() => {
		if (!open || tab !== "files") return;
		let live = true;
		setFiles(null);
		(dq.trim() ? searchFiles(dq) : recentFiles(30)).then((r) => live && setFiles(r as FileHit[])).catch(() => live && setFiles([]));
		return () => { live = false; };
	}, [open, tab, dq]);

	useEffect(() => {
		if (!open || tab !== "drive") return;
		let live = true;
		setDrive(null);
		unwrap(searchDrive(dq)).then((r) => live && setDrive(r)).catch((e) => live && setDrive({ connected: false, available: true, files: [], error: e instanceof Error ? e.message : "Could not search Google Drive." }));
		return () => { live = false; };
	}, [open, tab, dq]);

	const done = useCallback((what: string) => { toast({ title: "Added", description: what }); onAdded(); onClose(); }, [toast, onAdded, onClose]);
	const fail = (e: unknown) => toast({ title: "Could not add it", description: e instanceof Error ? e.message : undefined, variant: "destructive" });

	const addFile = async (f: FileHit) => {
		setBusy(f.id);
		try { await unwrap(attachVaultFile(kind, entityId, f.id, docId)); done(f.name); } catch (e) { fail(e); } finally { setBusy(null); }
	};
	const addDrive = async (input: { driveId?: string; link?: string; name?: string }, key: string, label: string) => {
		setBusy(key);
		try { await unwrap(attachDriveFile(kind, entityId, input, docId)); done(label); } catch (e) { fail(e); } finally { setBusy(null); }
	};
	const createForm = async () => {
		// The tab is opened first, while the click still counts, then sent to the new form.
		const tab = window.open("", "_blank");
		setBusy("form");
		try {
			const r = await unwrap(createFormForRecord(kind, entityId, entityName ? `${entityName}: form` : "New form", docId));
			if (tab) tab.location.href = `/dashboard/mjengo/forms/${r.formId}`; else window.open(`/dashboard/mjengo/forms/${r.formId}`, "_blank");
			done("A new form");
		} catch (e) { tab?.close(); fail(e); } finally { setBusy(null); }
	};
	const create = (n: (typeof NEW_FILES)[number]) => {
		if (n.id === "form") { void createForm(); return; }
		setPendingAttach({ kind, entityId, docId, name: entityName ?? "" });
		window.open(n.href, "_blank");
		toast({ title: `Opening the ${n.label.toLowerCase()} editor`, description: "It is added here as soon as you save it." });
		onClose();
	};

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="flex max-h-[85vh] w-[96vw] max-w-xl flex-col gap-3">
				<DialogHeader>
					<DialogTitle>{docName ? `Add a file for “${docName}”` : "Add a document"}</DialogTitle>
					<DialogDescription>Choose a file that already exists, or make a new one. It is linked here and stays where it is.</DialogDescription>
				</DialogHeader>
				<Tabs value={tab} onValueChange={setTab} className="flex min-h-0 flex-1 flex-col">
					<TabsList className="grid w-full grid-cols-3">
						<TabsTrigger value="files" className="gap-1.5"><FolderOpen className="h-4 w-4" /> From Files</TabsTrigger>
						<TabsTrigger value="drive" className="gap-1.5"><Link2 className="h-4 w-4" /> Google Drive</TabsTrigger>
						<TabsTrigger value="new" className="gap-1.5"><FilePlus2 className="h-4 w-4" /> Create new</TabsTrigger>
					</TabsList>

					{tab !== "new" && (
						<div className="relative mt-3">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-serene-neutral-400" aria-hidden />
							<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tab === "files" ? "Search your files by name or tag" : "Search Google Drive by name"} className="pl-9" aria-label="Search" autoFocus />
						</div>
					)}

					<TabsContent value="files" className="mt-2 min-h-0 flex-1 overflow-y-auto">
						{files === null ? <p className="flex items-center gap-2 p-4 text-sm text-serene-neutral-600"><Loader2 className="h-4 w-4 animate-spin" /> Looking</p>
							: files.length === 0 ? <p className="p-4 text-sm text-serene-neutral-600">{dq.trim() ? "No files match." : "No files yet. Upload one in Files, or create a new one here."}</p>
								: (
									<ul className="divide-y divide-serene-neutral-100">
										{files.map((f) => {
											const on = attachedFiles.has(f.id);
											return (
												<li key={f.id} className="flex items-center gap-3 py-2">
													<FileText className="h-4 w-4 shrink-0 text-serene-neutral-400" aria-hidden />
													<span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-serene-neutral-900">{f.name}</span><span className="block truncate text-xs text-serene-neutral-500">{[f.folder, fmtBytes(f.size)].filter(Boolean).join(" · ")}</span></span>
													<Button size="sm" variant={on ? "ghost" : "outline"} disabled={on || busy === f.id} onClick={() => addFile(f)}>{busy === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : on ? "Added" : "Add"}</Button>
												</li>
											);
										})}
									</ul>
								)}
					</TabsContent>

					<TabsContent value="drive" className="mt-2 min-h-0 flex-1 space-y-3 overflow-y-auto">
						{drive === null ? <p className="flex items-center gap-2 p-4 text-sm text-serene-neutral-600"><Loader2 className="h-4 w-4 animate-spin" /> Looking</p>
							: !drive.connected ? (
								<div className="space-y-2 rounded-xl border border-dashed border-serene-neutral-200 p-4 text-sm text-serene-neutral-700">
									<p>{drive.error ?? "Connect Google Drive to search it from here."}</p>
									{drive.available && <Button asChild size="sm"><a href={`/api/mjengo/drive/google/start?kind=connect&return=${encodeURIComponent(window.location.pathname)}`}>Connect Google Drive</a></Button>}
								</div>
							) : (
								<>
									{drive.error && <p className="text-sm text-amber-700">{drive.error}</p>}
									{drive.files.length === 0 && !drive.error && <p className="p-2 text-sm text-serene-neutral-600">{dq.trim() ? "Nothing in Drive matches." : "No files to show yet."}</p>}
									<ul className="divide-y divide-serene-neutral-100">
										{drive.files.map((f) => (
											<li key={f.id} className="flex items-center gap-3 py-2">
												<FileText className="h-4 w-4 shrink-0 text-serene-neutral-400" aria-hidden />
												<span className="min-w-0 flex-1 truncate text-sm font-medium text-serene-neutral-900">{f.name}</span>
												<Button size="sm" variant="outline" disabled={busy === f.id} onClick={() => addDrive({ driveId: f.id, name: f.name, link: f.link ?? undefined }, f.id, f.name)}>{busy === f.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}</Button>
											</li>
										))}
									</ul>
									<p className="text-xs text-serene-neutral-500">Search covers files this app created or was given. For any other Drive file, paste its link below.</p>
								</>
							)}
						<form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); if (link.trim()) void addDrive({ link }, "link", "Google Drive file"); }}>
							<Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="Paste a Google Drive link" aria-label="Google Drive link" />
							<Button type="submit" variant="outline" disabled={!link.trim() || busy === "link"}>{busy === "link" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add link"}</Button>
						</form>
					</TabsContent>

					<TabsContent value="new" className="mt-3">
						<div className="grid gap-2 sm:grid-cols-3">
							{NEW_FILES.map((n) => (
								<button key={n.id} type="button" disabled={busy === n.id} onClick={() => create(n)} className="flex flex-col items-start gap-1 rounded-xl border border-serene-neutral-200 p-3 text-left hover:bg-serene-neutral-50">
									<n.Icon className="h-5 w-5 text-sauti-teal" aria-hidden />
									<span className="text-sm font-semibold text-serene-neutral-900">{n.label}</span>
									<span className="text-xs text-serene-neutral-600">{n.hint}</span>
								</button>
							))}
						</div>
						<p className="mt-3 text-xs text-serene-neutral-500">Documents, spreadsheets, presentations and flows open their editor in a new tab; when you save, the file is kept in Files and added to this {kind}. A form is added straight away and opens so you can write its questions.</p>
					</TabsContent>
				</Tabs>
			</DialogContent>
		</Dialog>
	);
}
