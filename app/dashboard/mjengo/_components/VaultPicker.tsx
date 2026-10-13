"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronRight, FileText, Folder, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { listVault, recentFiles, searchFiles, type VaultItem } from "../vault/api";

export interface Picked { id: string; name: string; kind: "file" | "folder" }

/**
 * Choose files, and (when allowed) whole folders, from the vault. Opens on the most recently used files so
 * nobody has to remember a name; type to search, or move through folders. Folders are only ever vault folders.
 */
export function VaultPicker({ open, onClose, onPick, allowFolders = false, max = 5, title = "Choose from Files", already = [] }: { open: boolean; onClose: () => void; onPick: (items: Picked[]) => void; allowFolders?: boolean; max?: number; title?: string; already?: string[] }) {
	const [q, setQ] = useState("");
	const [folder, setFolder] = useState<{ id: string | null; path: { id: string; name: string }[] }>({ id: null, path: [] });
	const [items, setItems] = useState<VaultItem[]>([]);
	const [recent, setRecent] = useState<{ id: string; name: string; size: number; tags: string[] }[]>([]);
	const [hits, setHits] = useState<{ id: string; name: string }[] | null>(null);
	const [chosen, setChosen] = useState<Picked[]>([]);
	const [busy, setBusy] = useState(false);

	const load = useCallback(async (id: string | null) => {
		setBusy(true);
		try {
			const l = await listVault("mine", id);
			setItems(l.items);
			setFolder({ id, path: l.path });
		} catch { setItems([]); } finally { setBusy(false); }
	}, []);

	useEffect(() => {
		if (!open) return;
		setQ(""); setHits(null); setChosen([]);
		void load(null);
		recentFiles(12).then(setRecent).catch(() => setRecent([]));
	}, [open, load]);

	useEffect(() => {
		if (!q.trim()) { setHits(null); return; }
		const t = setTimeout(() => searchFiles(q).then((r) => setHits(r.map((f) => ({ id: f.id, name: f.name })))).catch(() => setHits([])), 200);
		return () => clearTimeout(t);
	}, [q]);

	const toggle = (p: Picked) => setChosen((cur) => (cur.some((c) => c.id === p.id) ? cur.filter((c) => c.id !== p.id) : cur.length >= max ? cur : [...cur, p]));
	const has = (id: string) => chosen.some((c) => c.id === id) || already.includes(id);

	const row = (p: Picked, sub?: string) => (
		<li key={p.id}>
			<button type="button" disabled={already.includes(p.id)} onClick={() => toggle(p)} className={cn("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-serene-neutral-50 disabled:opacity-40", has(p.id) && "bg-sauti-teal-light/40")}>
				<span className={cn("flex h-5 w-5 shrink-0 items-center justify-center rounded border text-[11px] font-bold", has(p.id) ? "border-sauti-teal bg-sauti-teal text-white" : "border-serene-neutral-300")}>{has(p.id) ? "✓" : ""}</span>
				<FileText className="h-4 w-4 shrink-0 text-serene-neutral-500" />
				<span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{p.name}</span>{sub && <span className="block truncate text-xs text-serene-neutral-500">{sub}</span>}</span>
			</button>
		</li>
	);

	return (
		<Dialog open={open} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="flex max-h-[85vh] max-w-xl flex-col">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{allowFolders ? "Pick files, or a whole folder from the vault." : "Pick files from the vault."} Up to {max}.</DialogDescription>
				</DialogHeader>
				<div className="relative">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-serene-neutral-400" />
					<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your files" className="pl-9" aria-label="Search files" />
				</div>
				<div className="min-h-0 flex-1 overflow-y-auto">
					{hits ? (
						<ul className="space-y-0.5">{hits.map((h) => row({ id: h.id, name: h.name, kind: "file" }))}{hits.length === 0 && <li className="p-4 text-center text-sm text-serene-neutral-500">Nothing matches.</li>}</ul>
					) : (
						<>
							{folder.id === null && recent.length > 0 && (
								<div className="mb-3">
									<p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-serene-neutral-400">Recent</p>
									<ul className="space-y-0.5">{recent.map((r) => row({ id: r.id, name: r.name, kind: "file" }, r.tags.join(", ") || undefined))}</ul>
								</div>
							)}
							<p className="px-2.5 pb-1 text-[11px] font-semibold uppercase tracking-wide text-serene-neutral-400">
								<button type="button" onClick={() => void load(null)} className="hover:underline">My files</button>
								{folder.path.map((p) => <span key={p.id}> <ChevronRight className="inline h-3 w-3" /> <button type="button" onClick={() => void load(p.id)} className="hover:underline">{p.name}</button></span>)}
							</p>
							{busy ? <div className="flex justify-center p-6"><Loader2 className="h-5 w-5 animate-spin text-serene-neutral-400" /></div> : (
								<ul className="space-y-0.5">
									{items.filter((i) => i.type === "folder").map((f) => (
										<li key={f.id} className="flex items-center gap-1">
											<button type="button" onClick={() => void load(f.id)} className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-serene-neutral-50">
												<Folder className="h-4 w-4 shrink-0 text-amber-500" /><span className="min-w-0 flex-1 truncate text-sm font-medium">{f.name}</span><ChevronRight className="h-4 w-4 text-serene-neutral-300" />
											</button>
											{allowFolders && <Button type="button" size="sm" variant={has(f.id) ? "default" : "outline"} className="h-8 shrink-0 text-xs" onClick={() => toggle({ id: f.id, name: f.name, kind: "folder" })}>{has(f.id) ? "Chosen" : "Use folder"}</Button>}
										</li>
									))}
									{items.filter((i) => i.type === "file").map((f) => row({ id: f.id, name: f.name, kind: "file" }))}
									{items.length === 0 && <li className="p-4 text-center text-sm text-serene-neutral-500">This folder is empty.</li>}
								</ul>
							)}
						</>
					)}
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>Cancel</Button>
					<Button className="bg-sauti-teal hover:bg-sauti-dark" disabled={!chosen.length} onClick={() => { onPick(chosen); onClose(); }}>Attach {chosen.length || ""}</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
