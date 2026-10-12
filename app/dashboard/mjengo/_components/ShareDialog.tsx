"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, Globe, Link2, Loader2, Lock, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MjengoLoader } from "./MjengoLoader";
import { AvatarStack, useTeam } from "./People";
import { getAccess, listPeople, setGeneralAccess, setPermission, type AccessView, type PersonRow, type VaultItem } from "../vault/api";

const LEVELS = [["view", "Can view"], ["share", "Can view and share"], ["edit", "Can edit"]] as const;

/** Who can open this: people with a level each, and a general-access switch for all administrators. */
export function ShareDialog({ item, onClose }: { item: VaultItem | null; onClose: () => void }) {
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
