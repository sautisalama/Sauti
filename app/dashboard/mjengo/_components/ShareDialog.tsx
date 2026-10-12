"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Copy, Globe, Link2, Loader2, Lock, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { MjengoLoader } from "./MjengoLoader";
import { RecipientField } from "../mail/_components/RecipientField";
import { getAccess, inviteByLink, listPeople, fileMeta, setFileMeta, setGeneralAccess, setPermission, type AccessView, type PersonRow, type VaultItem } from "../vault/api";

const LEVELS = [["view", "Can view"], ["share", "Can view and share"], ["edit", "Can edit"]] as const;

const initials = (n: string) => n.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";

/**
 * Who can open this, in the way Google's share box works: add people as pills (teammates and contacts are
 * suggested as you type), pick what they can do, and they are emailed. People who are not administrators
 * get the link instead. Anyone-with-the-link access, and a switch for everyone on the team, sit below.
 */
export function ShareDialog({ item, onClose }: { item: VaultItem | null; onClose: () => void }) {
	const { toast } = useToast();
	const [view, setView] = useState<AccessView | null>(null);
	const [people, setPeople] = useState<PersonRow[]>([]);
	const [link, setLink] = useState<"off" | "view" | "edit">("off");
	const [adding, setAdding] = useState("");
	const [addLevel, setAddLevel] = useState<"view" | "share" | "edit">("view");
	const [note, setNote] = useState("");
	const [notify, setNotify] = useState(true);
	const [busy, setBusy] = useState(false);
	const [copied, setCopied] = useState(false);

	const isFile = item?.type === "file";
	const url = typeof window === "undefined" || !item ? "" : isFile ? `${window.location.origin}/d/${item.id}` : "";

	const refresh = useCallback(async () => {
		if (!item) return;
		try {
			setView(await getAccess(item.type, item.id));
			if (item.type === "file") setLink((await fileMeta(item.id)).linkAccess);
		} catch (e) {
			toast({ title: "Could not load sharing", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		}
	}, [item, toast]);

	useEffect(() => {
		setView(null); setAdding(""); setNote(""); setLink("off");
		if (item) { void refresh(); listPeople().then(setPeople).catch(() => setPeople([])); }
	}, [item, refresh]);

	const run = async (fn: () => Promise<unknown>, done?: string) => {
		setBusy(true);
		try { await fn(); await refresh(); if (done) toast({ title: done }); } catch (e) { toast({ title: "Could not update sharing", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setBusy(false); }
	};

	const byEmail = useMemo(() => new Map(people.map((p) => [p.email.toLowerCase(), p])), [people]);
	const canGiveEdit = view?.myLevel === "edit";
	const emails = adding.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);
	const have = new Set((view?.people ?? []).map((p) => p.email.toLowerCase()));

	const submit = async () => {
		if (!item || !emails.length) return;
		const team = emails.filter((e) => byEmail.has(e) && !have.has(e));
		const outside = emails.filter((e) => !byEmail.has(e));
		await run(async () => {
			for (const e of team) await setPermission(item.type, item.id, byEmail.get(e)!.id, addLevel, notify, note.trim() || undefined);
			if (outside.length) {
				if (!isFile) throw new Error("Only administrators can be given access to a folder.");
				const r = await inviteByLink(item.id, outside, addLevel === "edit" ? "edit" : "view", note.trim() || undefined);
				setLink(r.linkAccess);
			}
			setAdding(""); setNote("");
		}, `Shared with ${emails.length} ${emails.length === 1 ? "person" : "people"}`);
	};

	const copy = () => navigator.clipboard.writeText(url).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => undefined);

	return (
		<Dialog open={!!item} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="truncate pr-6">Share “{item?.name}”</DialogTitle>
					<DialogDescription>Add people by name or email. Teammates are emailed a link to open it{isFile ? "; people outside the team get the link" : ""}.</DialogDescription>
				</DialogHeader>
				{!view ? (
					<MjengoLoader label="Loading" compact />
				) : (
					<div className="space-y-5">
						<div className="space-y-2">
							<div className="min-h-11 rounded-xl border border-serene-neutral-200 bg-white px-2.5 focus-within:border-sauti-teal">
								<RecipientField value={adding} onChange={setAdding} placeholder="Add people, contacts or emails" />
							</div>
							{emails.length > 0 && (
								<div className="space-y-2 rounded-xl bg-serene-neutral-50 p-3">
									<div className="flex flex-wrap items-center gap-2">
										<Select value={addLevel} onValueChange={(v) => setAddLevel(v as "view" | "share" | "edit")}>
											<SelectTrigger className="h-9 w-48 text-sm"><SelectValue /></SelectTrigger>
											<SelectContent>{LEVELS.filter(([v]) => v !== "edit" || canGiveEdit).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}</SelectContent>
										</Select>
										<label className="flex items-center gap-2 text-sm"><Switch checked={notify} onCheckedChange={setNotify} aria-label="Notify people" /> Email them</label>
									</div>
									{emails.some((e) => !byEmail.has(e)) && isFile && (
										<p className="text-xs text-serene-neutral-600">{emails.filter((e) => !byEmail.has(e)).join(", ")} {emails.filter((e) => !byEmail.has(e)).length === 1 ? "is" : "are"} not on the team, so they will get the link (anyone with it can {addLevel === "edit" ? "edit" : "view"}).</p>
									)}
									{notify && <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} placeholder="Add a message (optional)" className="text-sm" />}
									<div className="flex justify-end"><Button size="sm" disabled={busy} onClick={submit} className="gap-1.5 bg-sauti-teal hover:bg-sauti-dark">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Share</Button></div>
								</div>
							)}
						</div>

						<div>
							<p className="mb-1 text-sm font-semibold">People with access</p>
							<ul className="divide-y divide-serene-neutral-50">
								<li className="flex items-center gap-3 py-2 text-sm"><span className="flex h-8 w-8 items-center justify-center rounded-full bg-sauti-teal-light text-xs font-bold text-sauti-teal">{initials(view.owner.name)}</span><span className="min-w-0 flex-1 truncate"><span className="font-medium">{view.owner.name}</span> <span className="text-serene-neutral-500">(owner)</span></span><span className="text-xs text-serene-neutral-500">Full access</span></li>
								{view.people.map((p) => (
									<li key={p.userId} className="flex items-center gap-3 py-2 text-sm">
										<span className="flex h-8 w-8 items-center justify-center rounded-full bg-serene-neutral-100 text-xs font-bold text-serene-neutral-600">{initials(p.name)}</span>
										<span className="min-w-0 flex-1"><span className="block truncate font-medium">{p.name}</span><span className="block truncate text-xs text-serene-neutral-500">{p.email}{p.inherited ? " · from a parent folder" : ""}</span></span>
										{p.inherited ? <span className="text-xs capitalize text-serene-neutral-500">{p.level}</span> : (
											<Select value={p.level} disabled={busy || (p.level === "edit" && !canGiveEdit)} onValueChange={(v) => run(() => v === "none" ? setPermission(item!.type, item!.id, p.userId, null, notify) : setPermission(item!.type, item!.id, p.userId, v as "view" | "share" | "edit", notify))}>
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
							{view.people.length > 0 && <label className="mt-2 flex items-center gap-2 text-xs text-serene-neutral-600"><Switch checked={notify} onCheckedChange={setNotify} aria-label="Email people about changes" /> Email people when their access changes</label>}
						</div>

						<div className="space-y-3 rounded-xl bg-serene-neutral-50 p-3">
							<p className="text-sm font-semibold">General access</p>
							<div className="flex items-start gap-3">
								<span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white text-serene-neutral-600">{view.general === "restricted" ? <Lock className="h-4 w-4" /> : <Globe className="h-4 w-4" />}</span>
								<div className="min-w-0 flex-1">
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
							{isFile && (
								<div className="flex items-start gap-3">
									<span className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full", link === "off" ? "bg-white text-serene-neutral-600" : "bg-emerald-100 text-emerald-700")}><Link2 className="h-4 w-4" /></span>
									<div className="min-w-0 flex-1">
										<Select value={link} disabled={busy || (view.myLevel === "view")} onValueChange={(v) => run(() => setFileMeta(item!.id, { linkAccess: v as "off" | "view" | "edit" }), v === "off" ? "Link sharing is off" : "Link sharing updated")}>
											<SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
											<SelectContent>
												<SelectItem value="off">Link off: only people above</SelectItem>
												<SelectItem value="view">Anyone with the link can view</SelectItem>
												{canGiveEdit && <SelectItem value="edit">Anyone with the link can edit</SelectItem>}
											</SelectContent>
										</Select>
										{link !== "off" && <p className="mt-1.5 text-xs text-serene-neutral-600">People outside the team can open the link without an account{link === "edit" ? " and edit together with you, live" : ""}. Everything they do is kept in the history.</p>}
									</div>
								</div>
							)}
						</div>
					</div>
				)}
				<DialogFooter className="gap-2 sm:justify-between">
					{isFile ? <Button variant="outline" onClick={copy} className="gap-1.5">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : link === "off" ? "Copy link (team only)" : "Copy link"}</Button> : <span />}
					<Button onClick={onClose} className="bg-sauti-teal hover:bg-sauti-dark">Done</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
