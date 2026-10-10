"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronRight, Download, File as FileIcon, Folder, FolderPlus, HardDrive, Loader2, MoreVertical, Pencil, Share2, Trash2, Upload, Users } from "lucide-react";
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

	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<h2 className="text-lg font-bold text-serene-neutral-900">Vault</h2>
					<p className="text-sm text-serene-neutral-500">Shared files for the team. Each file or folder has its own people and rights.</p>
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
					{([["mine", "My vault", HardDrive], ["shared", "Shared with me", Users]] as const).map(([v, l, Icon]) => (
						<button key={v} onClick={() => switchTab(v)} aria-pressed={tab === v} className={cn("flex touch-manipulation items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold", tab === v ? "bg-sauti-teal text-white" : "text-serene-neutral-600 hover:bg-serene-neutral-50")}>
							<Icon className="h-3.5 w-3.5" /> {l}
						</button>
					))}
				</div>
				<nav aria-label="Folder path" className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
					<button onClick={() => setFolderId(null)} className="rounded px-1.5 py-0.5 text-serene-neutral-600 hover:bg-serene-neutral-100">{tab === "mine" ? "My vault" : "Shared with me"}</button>
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

			<div className="overflow-hidden rounded-2xl border border-serene-neutral-100 bg-white">
				{!data ? (
					<div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-serene-neutral-400" /></div>
				) : data.items.length === 0 ? (
					<p className="p-12 text-center text-sm text-serene-neutral-500">{tab === "shared" && !folderId ? "Nothing has been shared with you yet." : "This folder is empty."}</p>
				) : (
					<ul className="divide-y divide-serene-neutral-50">
						{data.items.map((i) => (
							<li key={`${i.type}:${i.id}`} className="flex items-center gap-3 p-3 hover:bg-serene-neutral-50/60">
								<button onClick={() => open(i)} className="flex min-w-0 flex-1 touch-manipulation items-center gap-3 text-left">
									{i.type === "folder" ? <Folder className="h-5 w-5 shrink-0 text-sauti-teal" /> : <FileIcon className="h-5 w-5 shrink-0 text-serene-neutral-500" />}
									<span className="min-w-0">
										<span className="block truncate text-sm font-medium text-serene-neutral-900">{i.name}</span>
										<span className="block truncate text-xs text-serene-neutral-500">
											{i.type === "file" && i.size != null ? `${fmtBytes(i.size)} · ` : ""}
											{i.ownerName}
										</span>
									</span>
								</button>
								{i.shared && <span title="Shared" className="hidden rounded-full bg-sauti-teal-light/40 px-2 py-0.5 text-[11px] font-semibold text-sauti-teal sm:inline"><Users className="mr-1 inline h-3 w-3" />Shared</span>}
								<span className="hidden w-14 text-right text-xs capitalize text-serene-neutral-400 sm:inline">{i.level}</span>
								<DropdownMenu>
									<DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label={`Actions for ${i.name}`}><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
									<DropdownMenuContent align="end">
										<DropdownMenuItem onClick={() => open(i)}>{i.type === "folder" ? <Folder className="mr-2 h-4 w-4" /> : <Download className="mr-2 h-4 w-4" />}{i.type === "folder" ? "Open" : "Download"}</DropdownMenuItem>
										{(i.level === "share" || i.level === "edit") && <DropdownMenuItem onClick={() => setShare(i)}><Share2 className="mr-2 h-4 w-4" />Share</DropdownMenuItem>}
										{i.level === "edit" && <DropdownMenuItem onClick={() => setRename(i)}><Pencil className="mr-2 h-4 w-4" />Rename</DropdownMenuItem>}
										{i.level === "edit" && <DropdownMenuItem className="text-red-600" onClick={() => setRemoving(i)}><Trash2 className="mr-2 h-4 w-4" />Delete</DropdownMenuItem>}
									</DropdownMenuContent>
								</DropdownMenu>
							</li>
						))}
					</ul>
				)}
			</div>

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
					<div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-serene-neutral-400" /></div>
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
