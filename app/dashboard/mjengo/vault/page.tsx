"use client";

import { MjengoLoader } from "../_components/MjengoLoader";
import { DriveResult, saveToDrive } from "../_components/drive";
import { AvatarStack, DriveBadge, useTeam } from "../_components/People";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowDownAZ, ArrowUpAZ, ChevronDown, ChevronRight, LayoutGrid, List as ListIcon, CloudUpload, Download, FileEdit, FileText as FileTextIcon, Folder, FolderPlus, HardDrive, Loader2, MoreVertical, Pencil, Share2, Trash2, Unplug, Upload, Users } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { filesHub, renameDriveFolder, disconnectDrive, shareFolderToDrive, type FilesHub } from "@/app/actions/mjengo-files";
import { unwrap } from "@/lib/action-result";
import { clearFilesInbox } from "@/app/actions/mjengo-nav";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import RequirementsPanel from "../documents/page";
import { TemplatePicker } from "../_components/TemplatePicker";
import { makeDeck, type DeckTheme } from "@/app/actions/mjengo-assist";
import { Textarea } from "@/components/ui/textarea";
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
	const [addLink, setAddLink] = useState(false);
	const [pickDoc, setPickDoc] = useState(false);
	const [deck, setDeck] = useState(false);
	const [view, setView] = useState<"list" | "grid">("list");
	const [fold, setFold] = useState<Record<string, boolean>>({});
	useEffect(() => {
		try {
			const v = localStorage.getItem("ss_files_view");
			if (v === "grid" || v === "list") setView(v);
			const f = localStorage.getItem("ss_files_fold");
			if (f) setFold(JSON.parse(f));
		} catch { /* defaults */ }
	}, []);
	const changeView = (v: "list" | "grid") => { setView(v); try { localStorage.setItem("ss_files_view", v); } catch { /* ignore */ } };
	const toggleFold = (id: string, next: boolean) => setFold((m) => { const n = { ...m, [id]: next }; try { localStorage.setItem("ss_files_fold", JSON.stringify(n)); } catch { /* ignore */ } return n; });

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
		const ext = i.name.includes(".") ? i.name.split(".").pop()!.toLowerCase() : "";
		if (ext === "pdf") { window.location.href = `/dashboard/mjengo/files/pdf?file=${i.id}`; return; }
		if (["xlsx", "xls", "csv"].includes(ext)) { window.location.href = `/dashboard/mjengo/files/sheet?file=${i.id}`; return; }
		if (["docx", "doc", "odt", "rtf", "md"].includes(ext)) { window.location.href = `/dashboard/mjengo/documents/editor?file=${i.id}`; return; }
		try {
			const { url } = await getFileUrl(i.id);
			if (ext === "url") {
				// A saved link: read the address out of the shortcut and go there.
				const text = await (await fetch(url)).text();
				const target = /URL=(\S+)/i.exec(text)?.[1];
				if (target && /^https?:\/\//i.test(target)) { window.open(target, "_blank", "noopener"); return; }
			}
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
				{i.type === "file" && /\.pdf$/i.test(i.name) && <DropdownMenuItem onClick={() => { window.location.href = `/dashboard/mjengo/files/pdf?file=${i.id}`; }}><FileEdit className="mr-2 h-4 w-4" />Sign or mark up</DropdownMenuItem>}
				{i.type === "file" && /\.(xlsx|xls|csv)$/i.test(i.name) && <DropdownMenuItem onClick={() => { window.location.href = `/dashboard/mjengo/files/sheet?file=${i.id}`; }}><FileEdit className="mr-2 h-4 w-4" />Open as a sheet</DropdownMenuItem>}
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
				<Fold id="new" title="Start something new" openMap={fold} onToggle={toggleFold}>
					<section aria-label="Start something new" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
						<NewCard badge="DOCX" tone="bg-[#3b8bc2]" label="Document" onClick={() => setPickDoc(true)} hint="Blank or from a template" />
						<NewCard badge="XLSX" tone="bg-[#43a047]" label="Spreadsheet" onClick={() => { window.location.href = "/dashboard/mjengo/files/sheet"; }} />
						<NewCard badge="PPTX" tone="bg-[#ef7d3c]" label="Presentation" onClick={() => setDeck(true)} hint="Made with AI from a topic" />
						<NewCard badge="PDF" tone="bg-[#e0483d]" label="PDF" onClick={() => pdfInput.current?.click()} hint="Add a PDF to sign or mark up" />
						<NewCard badge="URL" tone="bg-[#6b7280]" label="Link" onClick={() => setAddLink(true)} hint="Save a web address" />
						<input ref={pdfInput} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={(e) => upload(e.target.files)} />
					</section>
				</Fold>
			)}

			{!folderId && tab === "mine" && hub && hub.recent.length > 0 && (
				<Fold id="recent" title="Recent files" count={hub.recent.length} openMap={fold} onToggle={toggleFold} right={<ViewToggle view={view} onChange={changeView} />}>
					{view === "list" ? (
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
					) : (
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
							{hub.recent.map((r) => (
								<button key={r.id} onClick={() => open({ type: "file", id: r.id, name: r.name } as VaultItem)} className="flex flex-col items-center gap-2 rounded-2xl border border-serene-neutral-200/70 bg-white p-4 text-center transition hover:border-sauti-teal/40 hover:shadow-sm">
									<TypeIcon name={r.name} big />
									<span className="line-clamp-2 w-full break-words text-sm font-medium text-serene-neutral-900">{r.name}</span>
									<span className="text-xs text-serene-neutral-500">{formatDistanceToNow(new Date(r.opened), { addSuffix: true })}</span>
								</button>
							))}
						</div>
					)}
				</Fold>
			)}

			{data && (folders.length > 0 || (!folderId && tab === "mine" && hub)) && (
				<Fold id="folders" title="Folders" count={folders.length + (hub?.drive.folders.length ?? 0)} openMap={fold} onToggle={toggleFold} right={<ViewToggle view={view} onChange={changeView} />}>
					<div className={view === "grid" ? "grid gap-3 sm:grid-cols-2 lg:grid-cols-3" : "overflow-hidden rounded-2xl border border-serene-neutral-200/70 bg-white"}>
						{view === "grid" ? (
							<>
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
							</>
						) : (
							<ul className="divide-y divide-serene-neutral-50">
								{folders.map((f) => (
									<li key={f.id} className="flex items-center gap-3 p-3 hover:bg-serene-neutral-50/60">
										<button onClick={() => open(f)} className="flex min-w-0 flex-1 items-center gap-3 text-left"><Folder className="h-5 w-5 shrink-0 text-sauti-teal" /><span className="truncate text-sm font-medium">{f.name}</span><span className="hidden truncate text-xs text-serene-neutral-500 sm:inline">{f.ownerName}</span></button>
										{f.driveLink && <DriveBadge href={f.driveLink} />}
										<AvatarStack ids={f.people} team={team} max={3} />
										{rowMenu(f)}
									</li>
								))}
								{!folderId && tab === "mine" && hub?.drive.folders.map((d) => (
									<li key={d.id} className="flex items-center gap-3 p-3">
										<a href={d.link ?? undefined} target="_blank" rel="noopener noreferrer" className="flex min-w-0 flex-1 items-center gap-3"><DriveBadge className="h-5 w-5" /><span className="truncate text-sm font-medium">{d.name}</span><span className="text-xs text-serene-neutral-500">Google Drive</span></a>
										<DrivePeople folder={d} />
										<Button size="icon" variant="ghost" aria-label={`Rename ${d.name}`} onClick={() => setDriveRename({ id: d.id, name: d.name })}><Pencil className="h-4 w-4" /></Button>
									</li>
								))}
							</ul>
						)}
					</div>
					{!folderId && tab === "mine" && hub && !hub.drive.connected && hub.drive.available && (
						<a href="/api/mjengo/drive/google/start?kind=connect&return=/dashboard/mjengo/vault" className="mt-3 flex items-center gap-3 rounded-2xl border border-dashed border-serene-neutral-300 bg-white p-3 hover:border-sauti-teal/50">
							<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8f0fe]"><DriveBadge className="h-5 w-5" /></span>
							<span><span className="block text-sm font-semibold text-sauti-dark">Connect Google Drive</span><span className="block text-xs text-serene-neutral-500">See and rename your Drive folders here and keep copies up to date.</span></span>
						</a>
					)}
					{hub?.drive.error && <p className="mt-2 text-xs text-amber-700">{hub.drive.error}</p>}
					{hub?.drive.connected && (
						<p className="mt-2 flex flex-wrap items-center gap-2 text-xs text-serene-neutral-500">
							Connected to Google Drive{hub.drive.email ? ` as ${hub.drive.email}` : ""}.
							<button className="inline-flex items-center gap-1 text-serene-neutral-600 underline" onClick={async () => { try { await unwrap(disconnectDrive()); await loadHub(); toast({ title: "Disconnected from Google Drive" }); } catch (e) { fail("Could not disconnect", e); } }}><Unplug className="h-3 w-3" /> Disconnect</button>
						</p>
					)}
				</Fold>
			)}

			<Fold
				id="files"
				title={tab === "shared" && !folderId ? "Shared with me" : folderId ? "In this folder" : "All files"}
				count={shownFiles.length}
				openMap={fold}
				onToggle={toggleFold}
				right={
					<div className="flex flex-wrap items-center gap-2">
						<div className="hidden flex-wrap gap-1 md:flex">
							{types.slice(0, 7).map((t) => (
								<button key={t} onClick={() => setTypeFilter(t)} aria-pressed={typeFilter === t} className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", typeFilter === t ? "border-sauti-teal bg-sauti-teal-light/50 text-sauti-dark" : "border-serene-neutral-200 text-serene-neutral-600 hover:bg-serene-neutral-50")}>{t === "all" ? "All types" : t.toUpperCase()}</button>
							))}
						</div>
						<Select value={sortKey} onValueChange={(v) => setSortKey(v as typeof sortKey)}>
							<SelectTrigger className="h-8 w-[120px] text-xs" aria-label="Sort by"><SelectValue /></SelectTrigger>
							<SelectContent><SelectItem value="date">Last changed</SelectItem><SelectItem value="name">Name</SelectItem><SelectItem value="type">Type</SelectItem><SelectItem value="size">Size</SelectItem></SelectContent>
						</Select>
						<Button size="icon" variant="outline" className="h-8 w-8" aria-label={sortDir === "asc" ? "Ascending" : "Descending"} onClick={() => setSortDir((d) => (d === "asc" ? "desc" : "asc"))}>{sortDir === "asc" ? <ArrowUpAZ className="h-4 w-4" /> : <ArrowDownAZ className="h-4 w-4" />}</Button>
						<ViewToggle view={view} onChange={changeView} />
					</div>
				}
			>
				{!data ? (
					<div className="rounded-2xl border border-serene-neutral-200/70 bg-white"><MjengoLoader label="Opening your files" /></div>
				) : shownFiles.length === 0 ? (
					<p className="rounded-2xl border border-serene-neutral-200/70 bg-white p-12 text-center text-sm text-serene-neutral-500">{tab === "shared" && !folderId ? "Nothing has been shared with you yet." : typeFilter !== "all" ? "No files of this type." : "No files here yet."}</p>
				) : view === "grid" ? (
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
						{shownFiles.map((i) => (
							<div key={i.id} className="group relative flex flex-col items-center gap-2 rounded-2xl border border-serene-neutral-200/70 bg-white p-4 text-center transition hover:border-sauti-teal/40 hover:shadow-sm">
								<button onClick={() => open(i)} className="flex w-full flex-col items-center gap-2">
									<TypeIcon name={i.name} big />
									<span className="line-clamp-2 w-full break-words text-sm font-medium text-serene-neutral-900">{i.name}</span>
									<span className="text-xs text-serene-neutral-500">{i.size != null ? fmtBytes(i.size) : ""}{i.updatedAt ? ` · ${format(new Date(i.updatedAt), "d MMM")}` : ""}</span>
								</button>
								<div className="flex items-center gap-1">{i.driveLink && <DriveBadge href={i.driveLink} />}{(i.shared || i.people.length > 1) && <AvatarStack ids={i.people} team={team} max={3} />}</div>
								<div className="absolute right-1.5 top-1.5">{rowMenu(i)}</div>
							</div>
						))}
					</div>
				) : (
					<div className="overflow-hidden rounded-2xl border border-serene-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
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
					</div>
				)}
			</Fold>

			{!folderId && tab === "mine" && (
				<Fold id="requirements" title="Requirements for grants, opportunities and projects" openMap={fold} onToggle={toggleFold} defaultOpen={false}>
					<RequirementsPanel />
				</Fold>
			)}

			<TemplatePicker
				kind="document"
				open={pickDoc}
				title="New document"
				blankLabel="Blank document"
				onClose={() => setPickDoc(false)}
				onPick={(t) => { window.location.href = `/dashboard/mjengo/documents/editor${t ? `?template=${encodeURIComponent(t.id)}` : ""}${folderId ? `${t ? "&" : "?"}folder=${folderId}` : ""}`; }}
			/>
			<DeckDialog open={deck} onClose={() => setDeck(false)} folderId={folderId} onDone={() => { setDeck(false); load(); }} />
			<AddLinkDialog open={addLink} onClose={() => setAddLink(false)} folderId={folderId} onAdded={() => { setAddLink(false); load(); }} />

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

const TYPE_STYLE: Record<string, string> = { pdf: "bg-[#e0483d]", doc: "bg-[#3b8bc2]", docx: "bg-[#3b8bc2]", xls: "bg-[#43a047]", xlsx: "bg-[#43a047]", csv: "bg-[#43a047]", ppt: "bg-[#ef7d3c]", pptx: "bg-[#ef7d3c]", png: "bg-[#8e5bd6]", jpg: "bg-[#8e5bd6]", jpeg: "bg-[#8e5bd6]", txt: "bg-[#6b7280]", md: "bg-[#6b7280]", url: "bg-[#0f766e]" };

function TypeIcon({ name, big }: { name: string; big?: boolean }) {
	const ext = name.includes(".") ? name.split(".").pop()!.toLowerCase() : "";
	return (
		<span className={cn("flex shrink-0 items-center justify-center font-bold uppercase text-white", big ? "h-14 w-14 rounded-2xl text-xs" : "h-8 w-8 rounded-lg text-[9px]", TYPE_STYLE[ext] ?? "bg-serene-neutral-400")}>{ext.slice(0, 4) || <FileTextIcon className="h-4 w-4" />}</span>
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

/** A collapsible section, like an accordion panel. Remembers whether it was left open. */
function Fold({ id, title, count, right, openMap, onToggle, defaultOpen = true, children }: { id: string; title: string; count?: number; right?: React.ReactNode; openMap: Record<string, boolean>; onToggle: (id: string, next: boolean) => void; defaultOpen?: boolean; children: React.ReactNode }) {
	const open = openMap[id] ?? defaultOpen;
	return (
		<section aria-label={title} className="space-y-2">
			<div className="flex flex-wrap items-center gap-2">
				<button type="button" onClick={() => onToggle(id, !open)} aria-expanded={open} className="mr-auto flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-base font-semibold text-sauti-dark hover:bg-serene-neutral-100">
					<ChevronDown className={cn("h-4 w-4 text-serene-neutral-500 transition-transform", !open && "-rotate-90")} />
					{title}
					{count !== undefined && <span className="rounded-full bg-serene-neutral-100 px-2 py-0.5 text-xs font-medium text-serene-neutral-600">{count}</span>}
				</button>
				{open && right}
			</div>
			{open && children}
		</section>
	);
}

function ViewToggle({ view, onChange }: { view: "list" | "grid"; onChange: (v: "list" | "grid") => void }) {
	return (
		<div className="inline-flex rounded-lg border border-serene-neutral-200 bg-white p-0.5" role="group" aria-label="View">
			<button type="button" onClick={() => onChange("list")} aria-pressed={view === "list"} aria-label="List" className={cn("flex h-7 w-7 items-center justify-center rounded-md", view === "list" ? "bg-sauti-teal text-white" : "text-serene-neutral-600")}><ListIcon className="h-4 w-4" /></button>
			<button type="button" onClick={() => onChange("grid")} aria-pressed={view === "grid"} aria-label="Grid" className={cn("flex h-7 w-7 items-center justify-center rounded-md", view === "grid" ? "bg-sauti-teal text-white" : "text-serene-neutral-600")}><LayoutGrid className="h-4 w-4" /></button>
		</div>
	);
}

/** Save a web address in Files as a shortcut that opens the page. */
function AddLinkDialog({ open, onClose, folderId, onAdded }: { open: boolean; onClose: () => void; folderId: string | null; onAdded: () => void }) {
	const { toast } = useToast();
	const [url, setUrl] = useState("");
	const [title, setTitle] = useState("");
	const [busy, setBusy] = useState(false);
	useEffect(() => { if (open) { setUrl(""); setTitle(""); } }, [open]);
	return (
		<Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
			<DialogContent className="max-w-md">
				<DialogHeader><DialogTitle>Add a link</DialogTitle><DialogDescription>Keep a web address with your files. Opening it goes to the page.</DialogDescription></DialogHeader>
				<div className="space-y-3">
					<Input autoFocus value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.org/funding-call" aria-label="Web address" />
					<Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Name (optional)" aria-label="Name" />
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
					<Button
						className="gap-2 bg-sauti-teal hover:bg-sauti-dark"
						disabled={busy || !url.trim()}
						onClick={async () => {
							let u = url.trim();
							if (!/^https?:\/\//i.test(u)) u = `https://${u}`;
							try { new URL(u); } catch { toast({ title: "That is not a web address", variant: "destructive" }); return; }
							setBusy(true);
							try {
								const host = new URL(u).hostname.replace(/^www\./, "");
								const name = `${(title.trim() || host).replace(/[\\/:*?"<>|]+/g, " ").slice(0, 100)}.url`;
								const file = new File([`[InternetShortcut]\nURL=${u}\n`], name, { type: "text/uri-list" });
								const { path, signedUrl } = await prepareUpload(folderId, name, file.size);
								await putToSignedUrl(signedUrl, file);
								await registerUpload(folderId, path, name, file.size, "text/uri-list");
								onAdded();
							} catch (e) {
								toast({ title: "Could not add the link", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
							} finally {
								setBusy(false);
							}
						}}
					>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Add</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

const THEME_SWATCH: Record<DeckTheme, { label: string; a: string; b: string }> = {
	teal: { label: "Teal", a: "#068297", b: "#E6F4F6" },
	purple: { label: "Purple", a: "#7D2AE8", b: "#F1E8FD" },
	sunrise: { label: "Sunrise", a: "#EA580C", b: "#FFEDD5" },
	night: { label: "Night", a: "#00C4CC", b: "#0E1318" },
};

/** Describe a talk; the AI writes the slides and a PowerPoint file lands in Files, ready to open or download. */
function DeckDialog({ open, onClose, folderId, onDone }: { open: boolean; onClose: () => void; folderId: string | null; onDone: () => void }) {
	const { toast } = useToast();
	const [topic, setTopic] = useState("");
	const [slides, setSlides] = useState(8);
	const [theme, setTheme] = useState<DeckTheme>("teal");
	const [busy, setBusy] = useState(false);
	const [outline, setOutline] = useState<{ title: string; bullets: string[] }[] | null>(null);
	useEffect(() => { if (open) { setTopic(""); setOutline(null); } }, [open]);
	return (
		<Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
			<DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
				<DialogHeader><DialogTitle>Presentation with AI</DialogTitle><DialogDescription>Say what it is about and who it is for. You get a PowerPoint file with speaker notes.</DialogDescription></DialogHeader>
				{outline ? (
					<div className="space-y-3">
						<p className="text-sm text-serene-neutral-600">Saved to Files. Here is what is in it:</p>
						<ol className="max-h-72 list-decimal space-y-1 overflow-y-auto pl-5 text-sm">{outline.map((o, i) => <li key={i}><span className="font-medium">{o.title}</span></li>)}</ol>
						<DialogFooter><Button className="bg-sauti-teal hover:bg-sauti-dark" onClick={onDone}>Done</Button></DialogFooter>
					</div>
				) : (
					<div className="space-y-3">
						<Textarea rows={5} autoFocus value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="A briefing for a county government partner on our legal aid clinics: what we do, results so far, and what we need from them." />
						<div className="grid grid-cols-2 gap-3">
							<label className="block text-xs font-medium text-serene-neutral-600">Slides<Input type="number" min={4} max={14} value={slides} onChange={(e) => setSlides(Number(e.target.value))} className="mt-1 h-9" /></label>
							<div className="text-xs font-medium text-serene-neutral-600">Look
								<div className="mt-1 flex gap-2">
									{(Object.keys(THEME_SWATCH) as DeckTheme[]).map((k) => (
										<button key={k} type="button" aria-label={THEME_SWATCH[k].label} aria-pressed={theme === k} onClick={() => setTheme(k)} className={cn("h-9 w-9 overflow-hidden rounded-lg border-2", theme === k ? "border-sauti-teal" : "border-transparent")} style={{ background: `linear-gradient(135deg, ${THEME_SWATCH[k].b} 50%, ${THEME_SWATCH[k].a} 50%)` }} />
									))}
								</div>
							</div>
						</div>
						<DialogFooter>
							<Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
							<Button
								className="gap-2 bg-sauti-teal hover:bg-sauti-dark"
								disabled={busy || topic.trim().length < 6}
								onClick={async () => {
									setBusy(true);
									try {
										const r = await unwrap(makeDeck(topic, theme, slides));
										const bytes = Uint8Array.from(atob(r.base64), (c) => c.charCodeAt(0));
										const file = new File([bytes], r.name, { type: "application/vnd.openxmlformats-officedocument.presentationml.presentation" });
										const { path, signedUrl } = await prepareUpload(folderId, r.name, file.size);
										await putToSignedUrl(signedUrl, file);
										await registerUpload(folderId, path, r.name, file.size, file.type);
										setOutline(r.outline);
									} catch (e) {
										toast({ title: "Could not make the presentation", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
									} finally {
										setBusy(false);
									}
								}}
							>{busy && <Loader2 className="h-4 w-4 animate-spin" />} {busy ? "Writing the slides..." : "Create"}</Button>
						</DialogFooter>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
