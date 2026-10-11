"use client";

import { MjengoLoader } from "../_components/MjengoLoader";
import { DriveResult, saveToDrive } from "../_components/drive";
import { AvatarStack, DriveBadge, useTeam } from "../_components/People";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ, ChevronRight, CloudUpload, Download, FileEdit, FileText as FileTextIcon, Folder, FolderPlus, HardDrive, Loader2, MoreVertical, Pencil, Share2, Trash2, Unplug, Upload, Users } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { filesHub, renameDriveFolder, disconnectDrive, shareFolderToDrive, type FilesHub } from "@/app/actions/mjengo-files";
import { unwrap } from "@/lib/action-result";
import { clearFilesInbox } from "@/app/actions/mjengo-nav";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { putToSignedUrl } from "@/lib/client/upload";
import { cn } from "@/lib/utils";
import { fmtBytes } from "../_components/shared";
import {
	createFolder, deleteItem, getAccess, getFileUrl, listPeople, listVault, prepareUpload, registerUpload, renameItem, setGeneralAccess, setPermission,
	type AccessView, type PersonRow, type VaultItem, type VaultListing,
} from "./api";

type Tab = "mine" | "shared";

/** Drive-style document vault: folders and files, shared with view / share / edit rights. */
export default function VaultPage() {
	const team = useTeam();
	const { toast } = useToast();
	const [tab, setTab] = useState<Tab>("mine");
	const [folderId, setFolderId] = useState<string | null>(null);
	const [data, setData] = useState<VaultListing | null>(null);
	const [busy, setBusy] = useState(false);
	const [newFolder, setNewFolder] = useState(false);
	const [rename, setRename] = useState<VaultItem | null>(null);
	const [share, setShare] = useState<VaultItem | null>(null);
	const [removing, setRemoving] = useState<VaultItem | null>(null);
	const [uploads, setUploads] = useState<{ name: string; pct: number; error?: string }[]>([]);
	const fileInput = useRef<HTMLInputElement>(null);
	const pdfInput = useRef<HTMLInputElement>(null);
	const [hub, setHub] = useState<FilesHub | null>(null);
	const [sortKey, setSortKey] = useState<"name" | "type" | "date" | "size">("date");
	const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
	const [typeFilter, setTypeFilter] = useState<string>("all");
	const [driveRename, setDriveRename] = useState<{ id: string; name: string } | null>(null);

	const load = useCallback(async () => {
		try {
			setData(await listVault(folderId ? "folder" : tab, folderId));
		} catch (e) {
			setData({ path: [], here: null, items: [] });
			toast({ title: "Could not load the vault", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		}
	}, [tab, folderId, toast]);

	useEffect(() => {
		setData(null);
		load();
	}, [load]);

	// Files shared from a phone: tell the person, then stop counting them.
	useEffect(() => {
		const n = new URLSearchParams(window.location.search).get("shared_files");
		if (n) toast({ title: `${n} file${n === "1" ? "" : "s"} added from your phone`, description: "They are at the top level of Mine." });
		const t = setTimeout(() => { clearFilesInbox().catch(() => undefined); }, 2500);
		if (n) window.history.replaceState(null, "", window.location.pathname);
		return () => clearTimeout(t);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const loadHub = useCallback(async () => {
		try { setHub(await unwrap(filesHub())); } catch { /* the page works without it */ }
	}, []);
	useEffect(() => { loadHub(); }, [loadHub]);

	// A link from an email: /vault?open=<file id> opens that file if you have access.
	useEffect(() => {
		const id = new URLSearchParams(window.location.search).get("open");
		if (!id) return;
		getFileUrl(id)
			.then((r) => window.open(r.url, "_blank", "noopener"))
			.catch((e) => toast({ title: "You cannot open that file", description: e instanceof Error ? e.message : undefined, variant: "destructive" }));
		window.history.replaceState(null, "", window.location.pathname);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const canWrite = tab === "mine" || (!!folderId && data?.here === "edit");
	const fail = (title: string, e: unknown) => toast({ title, description: e instanceof Error ? e.message : undefined, variant: "destructive" });

	const upload = async (files: FileList | null) => {
		if (!files?.length) return;
		for (const file of Array.from(files)) {
			setUploads((u) => [...u, { name: file.name, pct: 0 }]);
			const set = (patch: Partial<{ pct: number; error: string }>) => setUploads((u) => u.map((x) => (x.name === file.name ? { ...x, ...patch } : x)));
			try {
				const { path, signedUrl } = await prepareUpload(folderId, file.name, file.size);
				await putToSignedUrl(signedUrl, file, (pct) => set({ pct }));
				await registerUpload(folderId, path, file.name, file.size, file.type || null);
				setUploads((u) => u.filter((x) => x.name !== file.name));
			} catch (e) {
				set({ error: e instanceof Error ? e.message : "Upload failed" });
			}
		}
		if (fileInput.current) fileInput.current.value = "";
		load();
	};

	const open = async (i: VaultItem) => {
		if (i.type === "folder") {
			setFolderId(i.id);
			return;
		}
		try {
			const { url } = await getFileUrl(i.id);
			window.open(url, "_blank", "noopener");
		} catch (e) {
			fail("Could not open the file", e);
		}
	};

	const switchTab = (t: Tab) => {
		setTab(t);
		setFolderId(null);
	};

	const folders = (data?.items ?? []).filter((i) => i.type === "folder");
	const allFiles = (data?.items ?? []).filter((i) => i.type === "file");
	const extOf = (n: string) => (n.includes(".") ? n.split(".").pop()!.toLowerCase() : "file");
	const types = ["all", ...Array.from(new Set(allFiles.map((f) => extOf(f.name)))).sort()];
	const shownFiles = allFiles
		.filter((f) => typeFilter === "all" || extOf(f.name) === typeFilter)
		.sort((x, y) => {
			const d = sortDir === "asc" ? 1 : -1;
			if (sortKey === "name") return d * x.name.localeCompare(y.name);
			if (sortKey === "type") return d * (extOf(x.name).localeCompare(extOf(y.name)) || x.name.localeCompare(y.name));
			if (sortKey === "size") return d * ((x.size ?? 0) - (y.size ?? 0));
			return d * (x.updatedAt ?? x.createdAt ?? "").localeCompare(y.updatedAt ?? y.createdAt ?? "");
		});

	const rowMenu = (i: VaultItem) => (
		<DropdownMenu>
			<DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`Actions for ${i.name}`}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				{i.type === "file" && /\.(docx|doc|odt|rtf|md|txt)$/i.test(i.name) && <DropdownMenuItem onClick={() => { window.location.href = `/dashboard/mjengo/documents/editor?file=${i.id}`; }}><FileEdit className="mr-2 h-4 w-4" />{i.level === "edit" ? "Edit" : "Open in editor"}</DropdownMenuItem>}
				<DropdownMenuItem onClick={() => open(i)}>{i.type === "folder" ? <Folder className="mr-2 h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />}{i.type === "folder" ? "Open" : "Download"}</DropdownMenuItem>
				{i.type === "file" && <DropdownMenuItem onClick={() => saveToDrive("vault", i.id)}><CloudUpload className="mr-2 h-4 w-4" />{i.driveLink ? "Update in Google Drive" : "Save to Google Drive"}</DropdownMenuItem>}
				{i.type === "folder" && hub?.drive.connected && <DropdownMenuItem onClick={async () => { try { const r = await unwrap(shareFolderToDrive(i.id)); toast({ title: "Copied to Google Drive", description: `${r.copied} file${r.copied === 1 ? "" : "s"} added${r.skipped > 0 ? `, ${r.skipped} more to go: run it again` : ""}.` }); await loadHub(); load(); } catch (e) { fail("Could not copy to Google Drive", e); } }}><CloudUpload className="mr-2 h-4 w-4" />Share folder to Google Drive</DropdownMenuItem>}
				{(i.level === "share" || i.level === "edit") && <DropdownMenuItem onClick={() => setShare(i)}><Share2 className="mr-2 h-4 w-4" />Share</DropdownMenuItem>}
				{i.level === "edit" && <DropdownMenuItem onClick={() => setRename(i)}><Pencil className="mr-2 h-4 w-4" />Rename</DropdownMenuItem>}
				{i.level === "edit" && <DropdownMenuItem className="text-red-600" onClick={() => setRemoving(i)}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>}
			</DropdownMenuContent>
		</DropdownMenu>
	);

	return (
		<div className="space-y-4">
			<DriveResult />
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<h2 className="text-xl font-bold tracking-tight text-sauti-dark">Files</h2>
					<p className="text-sm text-serene-neutral-500">Your files and folders, shared with the team and kept in step with Google Drive.</p>
				</div>
				{canWrite && (
					<div className="flex gap-2">
						<Button variant="outline" className="gap-2" onClick={() => setNewFolder(true)}><FolderPlus className="h-4 w-4" /> New folder</Button>
						<Button className="gap-2 bg-sauti-teal hover:bg-sauti-dark" onClick={() => fileInput.current?.click()}><Upload className="h-4 w-4" /> Upload</Button>
						<input ref={fileInput} type="file" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
					</div>
				)}
			</div>

			<div className="flex flex-wrap items-center gap-3">
				<div className="inline-flex rounded-lg border border-serene-neutral-200 bg-white p-0.5">
					{([["mine", "Mine", HardDrive], ["shared", "Shared with me", Users]] as const).map(([v, l, Icon]) => (
						<button key={v} onClick={() => switchTab(v)} aria-pressed={tab === v} className={cn("flex touch-manipulation items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold", tab === v ? "bg-sauti-teal text-white" : "text-serene-neutral-600 hover:bg-serene-neutral-50")}>
							<Icon className="h-3.5 w-3.5" /> {l}
						</button>
					))}
				</div>
				<nav aria-label="Folder path" className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
					<button onClick={() => setFolderId(null)} className="rounded px-1.5 py-0.5 text-serene-neutral-600 hover:bg-serene-neutral-100">{tab === "mine" ? "Mine" : "Shared with me"}</button>
					{data?.path.map((p) => (
						<span key={p.id} className="flex items-center gap-1">
							<ChevronRight className="h-3.5 w-3.5 text-serene-neutral-400" />
							<button onClick={() => setFolderId(p.id)} className="max-w-[160px] truncate rounded px-1.5 py-0.5 font-medium text-serene-neutral-800 hover:bg-serene-neutral-100">{p.name}</button>
						</span>
					))}
				</nav>
			</div>

			{uploads.length > 0 && (
				<ul className="space-y-1 rounded-xl border border-serene-neutral-100 bg-white p-3 text-sm">
					{uploads.map((u) => (
						<li key={u.name} className="flex items-center gap-3">
							<span className="min-w-0 flex-1 truncate">{u.name}</span>
							{u.error ? <span className="text-xs text-red-600">{u.error}</span> : <span className="text-xs text-serene-neutral-500">{u.pct}%</span>}
							{u.error && <button className="text-xs text-serene-neutral-500 underline" onClick={() => setUploads((x) => x.filter((y) => y.name !== u.name))}>Dismiss</button>}
						</li>
					))}
				</ul>
			)}

			{!folderId && tab === "mine" && (
				<>
					<section aria-label="Start something new" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
						<NewCard badge="DOCX" tone="bg-[#3b8bc2]" label="Document" onClick={() => { window.location.href = "/dashboard/mjengo/documents/editor"; }} />
						<NewCard badge="XLSX" tone="bg-[#43a047]" label="Spreadsheet" soon />
						<NewCard badge="PPTX" tone="bg-[#ef7d3c]" label="Presentation" soon />
						<NewCard badge="PDF" tone="bg-[#e0483d]" label="PDF" onClick={() => pdfInput.current?.click()} hint="Add a PDF" />
						<input ref={pdfInput} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
					</section>

					{hub && hub.recent.length > 0 && (
						<section aria-label="Recent files">
							<h3 className="mb-2 text-base font-semibold text-sauti-dark">Recent files</h3>
							<div className="overflow-hidden rounded-2xl border border-serene-neutral-200/70 bg-white">
								<div className="hidden grid-cols-[1fr_200px_160px] gap-3 border-b border-serene-neutral-100 px-4 py-2 text-xs font-semibold text-serene-neutral-500 sm:grid"><span>File name</span><span>Location</span><span className="text-right">Last opened</span></div>
								<ul className="divide-y divide-serene-neutral-50">
									{hub.recent.map((r) => (
										<li key={r.id}>
											<button onClick={() => open({ type: "file", id: r.id, name: r.name } as VaultItem)} className="grid w-full grid-cols-[1fr_auto] items-center gap-3 px-4 py-3 text-left hover:bg-serene-neutral-50/70 sm:grid-cols-[1fr_200px_160px]">
												<span className="flex min-w-0 items-center gap-3"><TypeIcon name={r.name} /><span className="truncate text-sm font-medium text-serene-neutral-900">{r.name}</span>{r.driveLink && <DriveBadge href={r.driveLink} />}</span>
												<span className="hidden truncate text-sm text-serene-neutral-500 sm:block">{r.location}</span>
												<span className="text-right text-sm text-serene-neutral-500">{formatDistanceToNow(new Date(r.opened), { addSuffix: true })}</span>
											</button>
										</li>
									))}
								</ul>
							</div>
						</section>
					)}
				</>
			)}

			{data && (folders.length > 0 || (!folderId && tab === "mine" && hub)) && (
				<section aria-label="Folders" className="space-y-2">
					<h3 className="text-base font-semibold text-sauti-dark">Folders</h3>
					<div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
						{folders.map((f) => (
							<div key={f.id} className="group flex items-center gap-3 rounded-2xl border border-serene-neutral-200/70 bg-white p-3 transition hover:border-sauti-teal/40">
								<button onClick={() => open(f)} className="flex min-w-0 flex-1 items-center gap-3 text-left">
									<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sauti-teal-light text-sauti-teal"><Folder className="h-5 w-5" /></span>
									<span className="min-w-0"><span className="block truncate text-sm font-semibold text-serene-neutral-900">{f.name}</span><span className="block truncate text-xs text-serene-neutral-500">{f.ownerName}</span></span>
								</button>
								{f.driveLink && <DriveBadge href={f.driveLink} />}
								<AvatarStack ids={f.people} team={team} max={3} />
								{rowMenu(f)}
							</div>
						))}
						{!folderId && tab === "mine" && hub?.drive.folders.map((d) => (
							<div key={d.id} className="flex items-center gap-3 rounded-2xl border border-serene-neutral-200/70 bg-white p-3">
								<a href={d.link ?? undefined} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-3">
									<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f0fe]"><DriveBadge className="h-5 w-5" /></span>
									<span className="min-w-0"><span className="block truncate text-sm font-semibold text-serene-neutral-900">{d.name}</span><span className="block truncate text-xs text-serene-neutral-500">Google Drive{d.modified ? ` · ${format(new Date(d.modified), "d MMM")}` : ""}</span></span>
								</a>
								<DrivePeople folder={d} />
								<Button size="icon" variant="ghost" aria-label={`Rename ${d.name}`} onClick={() => setDriveRename({ id: d.id, name: d.name })}><Pencil className="h-4 w-4" /></Button>
							</div>
						))}
						{!folderId && tab === "mine" && hub && !hub.drive.connected && hub.drive.available && (
							<a href="/api/mjengo/drive/google/start?kind=connect&return=/dashboard/mjengo/vault" className="flex items-center gap-3 rounded-2xl border border-dashed border-serene-neutral-300 bg-white p-3 hover:border-sauti-teal/50">
								<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f0fe]"><DriveBadge className="h-5 w-5" /></span>
								<span><span className="block text-sm font-semibold text-sauti-dark">Connect Google Drive</span><span className="block text-xs text-serene-neutral-500">See and rename your Drive folders here and keep copies up to date.</span></span>
							</a>
						)}
					</div>
					{hub?.drive.error && <p className="text-xs text-amber-700">{hub.drive.error}</p>}
					{hub?.drive.connected && (
						<p className="flex flex-wrap items-center gap-2 text-xs text-serene-neutral-500">
							Connected to Google Drive{hub.drive.email ? ` as ${hub.drive.email}` : ""}.
							<button className="inline-flex items-center gap-1 text-serene-neutral-600 underline" onClick={async () => { try { await unwrap(disconnectDrive()); await loadHub(); toast({ title: "Disconnected from Google Drive" }); } catch (e) { fail("Could not disconnect", e); } }}><Unplug className="h-3 w-3" /> Disconnect</button>
						</p>
					)}
				</section>
			)}

			<section aria-label="Files" className="space-y-2">
				<div className="flex flex-wrap items-center gap-2">
					<h3 className="mr-auto text-base font-semibold text-sauti-dark">{tab === "shared" && !folderId ? "Shared with me" : folderId ? "In this folder" : "All files"}</h3>
					<div className="flex flex-wrap gap-1">
						{types.map((t) => (
							<button key={t} onClick={() => setTypeFilter(t)} aria-pressed={typeFilter === t} className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", typeFilter === t ? "border-sauti-teal bg-sauti-teal-light/50 text-sauti-dark" : "border-serene-neutral-200 text-serene-neutral-600 hover:bg-serene-neutral-50")}>{t === "all" ? "All types" : t.toUpperCase()}</button>
						))}
					</div>
					<Select value={sortKey} onValueChange={(v) => setSortKey(v as typeof sortKey)}>
						<SelectTrigger className="h-8 w-[130px] text-xs" aria-label="Sort by"><SelectValue /></SelectTrigger>
						<SelectContent><SelectItem value="date">Last changed</SelectItem><SelectItem value="name">Name</SelectItem><SelectItem value="type">Type</SelectItem><SelectItem value="size">Size</SelectItem></SelectContent>
					</Select>
					<Button size="icon" variant="outline" className="h-8 w-8" aria-label={sortDir === "asc" ? "Ascending" : "Descending"} onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>{sortDir === "asc" ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}</Button>
				</div>
				<div className="overflow-hidden rounded-2xl border border-serene-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
					{!data ? (
						<MjengoLoader label="Opening your files" />
					) : shownFiles.length === 0 ? (
						<p className="p-12 text-center text-sm text-serene-neutral-500">{tab === "shared" && !folderId ? "Nothing has been shared with you yet." : typeFilter !== "all" ? "No files of this type." : "No files here yet."}</p>
					) : (
						<ul className="divide-y divide-serene-neutral-50">
							{shownFiles.map((i) => (
								<li key={i.id} className="flex items-center gap-3 p-3 hover:bg-serene-neutral-50/60">
									<button onClick={() => open(i)} className="flex min-w-0 flex-1 touch-manipulation items-center gap-3 text-left">
										<TypeIcon name={i.name} />
										<span className="min-w-0">
											<span className="block truncate text-sm font-medium text-serene-neutral-900">{i.name}</span>
											<span className="block truncate text-xs text-serene-neutral-500">{i.size != null ? `${fmtBytes(i.size)} · ` : ""}{i.ownerName}{i.updatedAt ? ` · ${format(new Date(i.updatedAt), "d MMM yyyy")}` : ""}</span>
										</span>
									</button>
									{i.driveLink && <DriveBadge href={i.driveLink} />}
									{(i.shared || i.people.length > 1) && <AvatarStack ids={i.people} team={team} />}
									<span className="hidden w-14 text-right text-xs capitalize text-serene-neutral-400 sm:inline">{i.level}</span>
									{rowMenu(i)}
								</li>
							))}
						</ul>
					)}
				</div>
			</section>

			<NameDialog
				open={!!driveRename}
				title="Rename Google Drive folder"
				action="Save"
				initial={driveRename?.name ?? ""}
				busy={busy}
				onClose={() => setDriveRename(null)}
				onSubmit={async (name) => {
					if (!driveRename) return;
					setBusy(true);
					try { await unwrap(renameDriveFolder(driveRename.id, name)); setDriveRename(null); await loadHub(); load(); } catch (e) { fail("Could not rename", e); } finally { setBusy(false); }
				}}
			/>

			<NameDialog
				open={newFolder}
				title="New folder"
				action="Create"
				initial=""
				busy={busy}
				onClose={() => setNewFolder(false)}
				onSubmit={async (name) => {
					setBusy(true);
					try { await createFolder(folderId, name); setNewFolder(false); load(); } catch (e) { fail("Could not create the folder", e); } finally { setBusy(false); }
				}}
			/>
			<NameDialog
				open={!!rename}
				title="Rename"
				action="Save"
				initial={rename?.name ?? ""}
				busy={busy}
				onClose={() => setRename(null)}
				onSubmit={async (name) => {
					if (!rename) return;
					setBusy(true);
					try { await renameItem(rename.type, rename.id, name); setRename(null); load(); } catch (e) { fail("Could not rename", e); } finally { setBusy(false); }
				}}
			/>

			<Dialog open={!!removing} onOpenChange={(o) => !o && setRemoving(null)}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Delete “{removing?.name}”?</DialogTitle>
						<DialogDescription>{removing?.type === "folder" ? "Everything inside it is deleted too, for everyone it was shared with." : "It is deleted for everyone it was shared with."} This cannot be undone.</DialogDescription>
					</DialogHeader>
					<DialogFooter>
						<Button variant="outline" onClick={() => setRemoving(null)}>Cancel</Button>
						<Button className="bg-red-600 hover:bg-red-700" disabled={busy} onClick={async () => {
							if (!removing) return;
							setBusy(true);
							try { await deleteItem(removing.type, removing.id); setRemoving(null); load(); } catch (e) { fail("Could not delete", e); } finally { setBusy(false); }
						}}>Delete</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<ShareDialog item={share} onClose={() => { setShare(null); load(); }} />
		</div>
	);
}

function NameDialog({ open, title, action, initial, busy, onClose, onSubmit }: { open: boolean; title: string; action: string; initial: string; busy: boolean; onClose: () => void; onSubmit: (name: string) => void }) {
	const [name, setName] = useState(initial);
	useEffect(() => { if (open) setName(initial); }, [open, initial]);
	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-sm">
				<DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
				<Input autoFocus value={name} maxLength={120} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && name.trim() && onSubmit(name)} aria-label="Name" />
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>Cancel</Button>
					<Button disabled={busy || !name.trim()} onClick={() => onSubmit(name)} className="gap-2 bg-sauti-teal hover:bg-sauti-dark">{busy && <Loader2 className="h-4 w-4 animate-spin" />}{action}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

const LEVELS = [["view", "Can view"], ["share", "Can view and share"], ["edit", "Can edit"]] as const;

/** Who can open this: people with a level each, and a general-access switch for all administrators. */
function ShareDialog({ item, onClose }: { item: VaultItem | null; onClose: () => void }) {
	const { toast } = useToast();
	const [view, setView] = useState<AccessView | null>(null);
	const [people, setPeople] = useState<PersonRow[]>([]);
	const [q, setQ] = useState("");
	const [busy, setBusy] = useState(false);

	const refresh = useCallback(async () => {
		if (!item) return;
		try { setView(await getAccess(item.type, item.id)); } catch (e) { toast({ title: "Could not load sharing", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); }
	}, [item, toast]);

	useEffect(() => {
		setView(null);
		setQ("");
		if (item) { refresh(); listPeople().then(setPeople).catch(() => setPeople([])); }
	}, [item, refresh]);

	const run = async (fn: () => Promise<unknown>) => {
		setBusy(true);
		try { await fn(); await refresh(); } catch (e) { toast({ title: "Could not update sharing", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setBusy(false); }
	};

	const have = new Set(view?.people.map((p) => p.userId));
	const matches = q.trim() ? people.filter((p) => !have.has(p.id) && p.id !== view?.owner.id && `${p.name} ${p.email}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 5) : [];
	const canGiveEdit = view?.myLevel === "edit";

	return (
		<Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Share “{item?.name}”</DialogTitle>
					<DialogDescription>Only Mjengo administrators can be added. People can also see anything inside a shared folder.</DialogDescription>
				</DialogHeader>
				{!view ? (
					<MjengoLoader label="Loading" compact />
				) : (
					<div className="space-y-4">
						<div className="relative">
							<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add people by name or email" aria-label="Add people" />
							{matches.length > 0 && (
								<ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-serene-neutral-200 bg-white shadow-lg">
									{matches.map((p) => (
										<li key={p.id}>
											<button disabled={busy} onClick={() => { setQ(""); run(() => setPermission(item!.type, item!.id, p.id, "view")); }} className="flex w-full flex-col px-3 py-2 text-left text-sm hover:bg-serene-neutral-50">
												<span className="font-medium">{p.name}</span><span className="text-xs text-serene-neutral-500">{p.email}</span>
											</button>
										</li>
									))}
								</ul>
							)}
						</div>

						<ul className="divide-y divide-serene-neutral-50">
							<li className="flex items-center gap-3 py-2 text-sm"><span className="min-w-0 flex-1 truncate"><span className="font-medium">{view.owner.name}</span> <span className="text-serene-neutral-500">(owner)</span></span><span className="text-xs text-serene-neutral-500">Full access</span></li>
							{view.people.map((p) => (
								<li key={p.userId} className="flex items-center gap-3 py-2 text-sm">
									<span className="min-w-0 flex-1"><span className="block truncate font-medium">{p.name}</span><span className="block truncate text-xs text-serene-neutral-500">{p.email}{p.inherited ? " · from a parent folder" : ""}</span></span>
									{p.inherited ? <span className="text-xs capitalize text-serene-neutral-500">{p.level}</span> : (
										<Select value={p.level} disabled={busy || (p.level === "edit" && !canGiveEdit)} onValueChange={(v) => run(() => v === "none" ? setPermission(item!.type, item!.id, p.userId, null) : setPermission(item!.type, item!.id, p.userId, v as "view" | "share" | "edit"))}>
											<SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
											<SelectContent>
												{LEVELS.filter(([v]) => v !== "edit" || canGiveEdit).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
												<SelectItem value="none">Remove access</SelectItem>
											</SelectContent>
										</Select>
									)}
								</li>
							))}
						</ul>

						<div className="rounded-xl bg-serene-neutral-50 p-3">
							<p className="mb-2 text-sm font-semibold">General access</p>
							<Select value={view.general} disabled={busy} onValueChange={(v) => run(() => setGeneralAccess(item!.type, item!.id, v as "restricted" | "admins_view" | "admins_share"))}>
								<SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
								<SelectContent>
									<SelectItem value="restricted">Restricted: only people added</SelectItem>
									<SelectItem value="admins_view">All administrators can view</SelectItem>
									<SelectItem value="admins_share">All administrators can view and share</SelectItem>
								</SelectContent>
							</Select>
						</div>
					</div>
				)}
				<DialogFooter><Button onClick={onClose} className="bg-sauti-teal hover:bg-sauti-dark">Done</Button></DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

const TYPE_STYLE: Record<string, string> = { pdf: "bg-[#e0483d]", doc: "bg-[#3b8bc2]", docx: "bg-[#3b8bc2]", xls: "bg-[#43a047]", xlsx: "bg-[#43a047]", csv: "bg-[#43a047]", ppt: "bg-[#ef7d3c]", pptx: "bg-[#ef7d3c]", png: "bg-[#8e5bd6]", jpg: "bg-[#8e5bd6]", jpeg: "bg-[#8e5bd6]", txt: "bg-[#6b7280]", md: "bg-[#6b7280]" };

function TypeIcon({ name }: { name: string }) {
	const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
	return (
		<span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[9px] font-bold uppercase text-white", TYPE_STYLE[ext] ?? "bg-serene-neutral-400")}>{ext.slice(0, 4) || <FileTextIcon className="h-4 w-4" />}</span>
	);
}

function NewCard({ badge, tone, label, onClick, soon, hint }: { badge: string; tone: string; label: string; onClick?: () => void; soon?: boolean; hint?: string }) {
	return (
		<button
			onClick={onClick}
			disabled={soon}
			title={soon ? "Coming soon" : hint}
			className={cn("group relative flex flex-col items-center gap-3 rounded-2xl border border-serene-neutral-200/70 bg-serene-neutral-50 px-4 pb-4 pt-5 text-center transition", soon ? "cursor-not-allowed opacity-70" : "hover:border-sauti-teal/40 hover:bg-white hover:shadow-sm")}
		>
			<span className={cn("absolute left-3 top-3 rounded-md px-2 py-0.5 text-[11px] font-bold text-white", tone)}>{badge}</span>
			<span className="mt-3 flex h-16 w-14 flex-col gap-1.5 rounded-md bg-white p-2 shadow-sm">
				{[0, 1, 2, 3].map((n) => <span key={n} className={cn("h-1.5 rounded-full opacity-40", tone)} style={{ width: `${100 - n * 12}%` }} />)}
			</span>
			<span className="text-sm font-medium text-serene-neutral-800">{label}</span>
			{soon && <span className="absolute right-3 top-3 text-[10px] font-semibold uppercase tracking-wide text-serene-neutral-500">Soon</span>}
		</button>
	);
}

/** Who can open a Drive folder: a stack of photos with the names in a popover. */
function DrivePeople({ folder }: { folder: { people: { email: string | null; name: string | null; role: string; photo: string | null }[] } }) {
	if (!folder.people.length) return null;
	return (
		<Popover>
			<PopoverTrigger asChild>
				<button aria-label="Who has access" className="flex -space-x-2">
					{folder.people.slice(0, 3).map((p, k) => (
						<span key={k} className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-sauti-teal-light text-[10px] font-bold text-sauti-teal ring-2 ring-white">
							{p.photo ? <img src={p.photo} alt="" className="h-full w-full object-cover" /> : (p.name || p.email || "?").charAt(0).toUpperCase()}
						</span>
					))}
					{folder.people.length > 3 && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-serene-neutral-100 text-[10px] font-bold ring-2 ring-white">+{folder.people.length - 3}</span>}
				</button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-64 p-2">
				<p className="px-2 pb-1 text-xs font-semibold text-serene-neutral-500">People with access</p>
				<ul>
					{folder.people.map((p, k) => (
						<li key={k} className="flex items-center gap-2 px-2 py-1.5 text-sm">
							<span className="min-w-0 flex-1 truncate">{p.name || p.email}</span>
							<span className="text-xs capitalize text-serene-neutral-500">{p.role === "owner" ? "Owner" : p.role}</span>
						</li>
					))}
				</ul>
			</PopoverContent>
		</Popover>
	);
}
