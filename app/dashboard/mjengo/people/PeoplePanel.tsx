"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Crown, Loader2, Lock, Plus, Search, ShieldCheck, ShieldOff, Trash2, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { MjengoLoader } from "../_components/MjengoLoader";
import { SHARE_EMAIL_UI } from "@/lib/client/flags";
import {
	addSuperAdmin, getAccessOverview, removeSuperAdmin, searchPeople, setAccountType, setAdminStatus,
	type AccessOverview, type PersonView,
} from "@/app/actions/access";
import { assignRole, deleteRole, listRoles, notifyAccessChange, roleModules, saveRole, type RoleView } from "@/app/actions/roles";

type Lvl = "view" | "write" | "owner";
const LVLS: { v: Lvl | "none"; label: string }[] = [{ v: "none", label: "None" }, { v: "view", label: "View" }, { v: "write", label: "Write" }, { v: "owner", label: "Owner" }];
const RANK: Record<Lvl, number> = { view: 1, write: 2, owner: 3 };
const TONE: Record<Lvl, string> = { view: "bg-sky-50 text-sky-800", write: "bg-emerald-50 text-emerald-800", owner: "bg-violet-50 text-violet-800" };
const initials = (s: string) => s.trim().split(/\s+/).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";

interface Module { key: string; label: string; hint: string }
const parse = (p: string): { key: string; level: Lvl } => { const [key, l] = p.split(":"); return { key, level: l === "view" || l === "owner" ? l : "write" }; };

/** The highest level of each module across a person's roles; null means no role at all (full access). */
function effective(userId: string, roles: RoleView[]): Map<string, Lvl> | null {
	const mine = roles.filter((r) => r.members.some((m) => m.id === userId));
	if (!mine.length) return null;
	const out = new Map<string, Lvl>();
	for (const r of mine) for (const raw of r.permissions) { const p = parse(raw); const cur = out.get(p.key); if (!cur || RANK[p.level] > RANK[cur]) out.set(p.key, p.level); }
	return out;
}

/** People and access: who is on the team and what they may do, the roles that define it, and super admins. */
export function PeoplePanel() {
	const { toast } = useToast();
	const [tab, setTab] = useState<"people" | "roles" | "super">("people");
	const [data, setData] = useState<AccessOverview | null>(null);
	const [roles, setRoles] = useState<RoleView[]>([]);
	const [modules, setModules] = useState<Module[]>([]);
	const [q, setQ] = useState("");
	const [found, setFound] = useState<PersonView[]>([]);
	const [open, setOpen] = useState<{ id: string; name: string; email: string | null; isSuperAdmin: boolean; isAdmin: boolean; userType?: string | null } | null>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const [edit, setEdit] = useState<{ id: string | null; name: string; description: string; levels: Record<string, Lvl | "none"> } | null>(null);
	const [identifier, setIdentifier] = useState("");

	const fail = useCallback((e: unknown) => toast({ title: "That did not work", description: e instanceof Error ? e.message : undefined, variant: "destructive" }), [toast]);
	const load = useCallback(async () => {
		try {
			const [o, r, m] = await Promise.all([getAccessOverview(), unwrap(listRoles()), unwrap(roleModules())]);
			setData(o); setRoles(r); setModules(m);
		} catch (e) { fail(e); }
	}, [fail]);
	useEffect(() => { void load(); }, [load]);

	useEffect(() => {
		if (q.trim().length < 2) { setFound([]); return; }
		const t = setTimeout(() => searchPeople(q).then(setFound).catch(() => setFound([])), 250);
		return () => clearTimeout(t);
	}, [q]);

	const run = async (key: string, fn: () => Promise<unknown>, ok: string) => {
		setBusy(key);
		try { await fn(); toast({ title: ok }); await load(); if (q.trim().length >= 2) setFound(await searchPeople(q)); } catch (e) { fail(e); } finally { setBusy(null); }
	};
	const askEmail = async (userId: string, summary: string) => {
		if (!SHARE_EMAIL_UI || !window.confirm("Email them about this change?")) return;
		try { const r = await notifyAccessChange(userId, summary); if (!r.ok) throw new Error(r.error); } catch (e) { fail(e); }
	};

	const people = useMemo(() => {
		const t = q.trim().toLowerCase();
		const base = data?.admins ?? [];
		return t ? base.filter((a) => `${a.name} ${a.email ?? ""}`.toLowerCase().includes(t)) : base;
	}, [data, q]);

	if (!data) return <MjengoLoader label="Loading people and access" />;

	const summary = (id: string, isSuper: boolean) => {
		if (isSuper) return { text: "Everything", chip: "Owner of everything" };
		const e = effective(id, roles);
		if (!e) return { text: "Everything (no role set)", chip: null };
		const owner = [...e.values()].filter((l) => l === "owner").length;
		return { text: `${e.size} of ${modules.length} areas`, chip: owner ? `Owner of ${owner}` : null };
	};

	const openPerson = (p: { id: string; name: string; email: string | null; isSuperAdmin: boolean; isAdmin?: boolean; userType?: string | null }) => setOpen({ ...p, isAdmin: p.isAdmin ?? true });
	const live = open ? (data.admins.find((a) => a.id === open.id) ?? open) : null;

	return (
		<div className="mx-auto max-w-5xl space-y-5">
			<div>
				<h2 className="text-xl font-bold tracking-tight text-sauti-dark">People and access</h2>
				<p className="text-sm text-serene-neutral-500">Who is on the team, what each person may do in every part of the suite, and the roles that define it.</p>
			</div>

			<div className="inline-flex rounded-xl border border-serene-neutral-200 bg-white p-1" role="tablist">
				{([["people", "People"], ["roles", `Roles (${roles.length})`], ["super", "Super admins"]] as const).map(([k, l]) => (
					<button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} className={cn("rounded-lg px-4 py-1.5 text-sm font-medium transition", tab === k ? "bg-sauti-teal text-white shadow-sm" : "text-serene-neutral-600 hover:bg-serene-neutral-50")}>{l}</button>
				))}
			</div>

			{tab === "people" && (
				<section className="space-y-3">
					<div className="relative">
						<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-serene-neutral-400" />
						<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search the team, or anyone by name, email or Sauti ID" className="h-11 bg-white pl-9" autoComplete="off" />
					</div>
					<ul className="divide-y divide-serene-neutral-100 overflow-hidden rounded-2xl border border-serene-neutral-200/70 bg-white">
						{people.map((a) => {
							const s = summary(a.id, a.isSuperAdmin);
							const mine = roles.filter((r) => r.members.some((m) => m.id === a.id));
							return (
								<li key={a.id}>
									<button onClick={() => openPerson(a)} className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-serene-neutral-50/70">
										<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sauti-teal-light text-sm font-bold text-sauti-teal">{initials(a.name)}</span>
										<span className="min-w-0 flex-1">
											<span className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-serene-neutral-900">{a.name}</span>{a.isSuperAdmin && <Crown className="h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Super admin" />}</span>
											<span className="block truncate text-xs text-serene-neutral-500">{a.email}</span>
										</span>
										<span className="hidden flex-wrap justify-end gap-1 sm:flex">
											{mine.map((r) => <span key={r.id} className="rounded-full bg-serene-neutral-100 px-2 py-0.5 text-[11px] font-medium text-serene-neutral-700">{r.name}</span>)}
										</span>
										<span className="w-36 shrink-0 text-right text-xs text-serene-neutral-500">{s.text}</span>
									</button>
								</li>
							);
						})}
						{people.length === 0 && <li className="p-6 text-center text-sm text-serene-neutral-500">No administrator matches.</li>}
					</ul>
					{found.filter((f) => !f.isAdmin).length > 0 && (
						<div>
							<p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wide text-serene-neutral-400">Not on the team yet</p>
							<ul className="divide-y divide-serene-neutral-100 overflow-hidden rounded-2xl border border-serene-neutral-200/70 bg-white">
								{found.filter((f) => !f.isAdmin).map((p) => (
									<li key={p.id} className="flex items-center gap-3 px-4 py-3">
										<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-serene-neutral-100 text-sm font-bold text-serene-neutral-600">{initials(p.name)}</span>
										<span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{p.name}</span><span className="block truncate text-xs text-serene-neutral-500">{p.email}{p.sautiId ? ` · ${p.sautiId}` : ""} · {(p.userType ?? "member").replace(/_/g, " ")}</span></span>
										<Button size="sm" disabled={busy === p.id} className="gap-1.5 bg-sauti-teal hover:bg-sauti-dark" onClick={() => window.confirm(`Make ${p.name} an administrator? They will be able to use the suite.`) && run(p.id, async () => { await setAdminStatus(p.id, true); await askEmail(p.id, "You were made an administrator, so you can now use the Mjengo suite."); }, "Made an admin")}>
											{busy === p.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />} Make admin
										</Button>
									</li>
								))}
							</ul>
						</div>
					)}
				</section>
			)}

			{tab === "roles" && (
				<section className="space-y-3">
					<div className="flex items-center justify-between gap-3">
						<p className="max-w-xl text-sm text-serene-neutral-500">Each role sets a level for every part of the suite: <b>View</b> reads, <b>Write</b> creates and changes, <b>Owner</b> can also delete and manage other people&apos;s items. People with no role keep everything.</p>
						<Button className="shrink-0 gap-1.5 bg-sauti-teal hover:bg-sauti-dark" onClick={() => setEdit({ id: null, name: "", description: "", levels: {} })}><Plus className="h-4 w-4" /> New role</Button>
					</div>
					{roles.length === 0 ? <p className="rounded-2xl border border-dashed border-serene-neutral-200 bg-white p-10 text-center text-sm text-serene-neutral-500">No roles yet.</p> : (
						<ul className="grid gap-3 md:grid-cols-2">
							{roles.map((r) => (
								<li key={r.id} className="rounded-2xl border border-serene-neutral-200/70 bg-white p-4">
									<div className="flex items-start gap-2">
										<div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-serene-neutral-900">{r.name}</p>{r.description && <p className="text-xs text-serene-neutral-500">{r.description}</p>}</div>
										<Button size="sm" variant="ghost" onClick={() => setEdit({ id: r.id, name: r.name, description: r.description ?? "", levels: Object.fromEntries(r.permissions.map((p) => { const x = parse(p); return [x.key, x.level]; })) })}>Edit</Button>
										<button aria-label={`Delete ${r.name}`} onClick={async () => { if (!window.confirm(`Delete "${r.name}"?`)) return; try { setRoles(await unwrap(deleteRole(r.id))); } catch (e) { fail(e); } }} className="flex h-8 w-8 items-center justify-center rounded-full text-serene-neutral-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
									</div>
									<div className="mt-3 flex flex-wrap gap-1">
										{r.permissions.length === 0 && <span className="text-xs text-amber-700">Allows nothing yet</span>}
										{r.permissions.map((p) => { const x = parse(p); return <span key={p} className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", TONE[x.level])}>{modules.find((m) => m.key === x.key)?.label ?? x.key} · {x.level}</span>; })}
									</div>
									<p className="mt-3 border-t border-serene-neutral-100 pt-2 text-xs text-serene-neutral-500">{r.members.length ? r.members.map((m) => m.name).join(", ") : "Given to nobody yet"}</p>
								</li>
							))}
						</ul>
					)}
				</section>
			)}

			{tab === "super" && (
				<section className="space-y-3">
					<p className="text-sm text-serene-neutral-500">Super admins manage people and access and can read the logs. Each can add {data.me.limit} more. Protected accounts can never be removed.</p>
					<ul className="divide-y divide-serene-neutral-100 overflow-hidden rounded-2xl border border-serene-neutral-200/70 bg-white">
						{data.superAdmins.map((s) => (
							<li key={s.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
								<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-sm font-bold text-amber-700">{initials(s.name || s.email)}</span>
								<span className="min-w-0 flex-1 basis-[10rem]"><span className="block truncate text-sm font-semibold">{s.name || s.email}</span><span className="block truncate text-xs text-serene-neutral-500">{s.name ? `${s.email} · ` : ""}{s.added_by ? `added by ${s.added_by}` : "founding super admin"}{!s.hasAccount && " · no account yet"}</span></span>
								{s.is_protected && <span className="flex items-center gap-1 rounded-full bg-sauti-teal-light px-2 py-0.5 text-[11px] font-medium text-sauti-teal"><Lock className="h-3 w-3" /> Protected</span>}
								{s.canRemove && <Button size="sm" variant="ghost" className="text-red-600 hover:bg-red-50" disabled={busy === s.id} onClick={() => window.confirm(`Remove ${s.email} as a super admin?`) && run(s.id, () => removeSuperAdmin(s.id), "Super admin removed")}>{busy === s.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}<span className="sr-only">Remove</span></Button>}
							</li>
						))}
					</ul>
					<div className="rounded-2xl border border-serene-neutral-200/70 bg-white p-4">
						<p className="mb-1.5 text-xs font-semibold text-serene-neutral-600">Add a super admin ({data.me.added} of {data.me.limit} used by you)</p>
						<div className="flex flex-col gap-2 sm:flex-row">
							<Input value={identifier} onChange={(e) => setIdentifier(e.target.value)} placeholder="Email address or Sauti ID (SS-XXXX-XXXX)" disabled={!data.me.canAdd} autoComplete="off" />
							<Button disabled={!data.me.canAdd || !identifier.trim() || busy === "add"} className="gap-1.5" onClick={() => run("add", async () => { await addSuperAdmin(identifier); setIdentifier(""); }, "Super admin added")}><UserPlus className="h-4 w-4" /> Add</Button>
						</div>
						{!data.me.canAdd && <p className="mt-1.5 text-xs text-amber-700">You have used all {data.me.limit} of your additions.</p>}
					</div>
				</section>
			)}

			{/* One person */}
			<Sheet open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
				<SheetContent className="flex w-full flex-col gap-0 p-0 sm:max-w-lg">
					{open && live && (() => {
						const sa = data.superAdmins.find((x) => x.email.toLowerCase() === (open.email ?? "").toLowerCase());
						const eff = effective(open.id, roles);
						return (
							<>
								<SheetHeader className="border-b p-5">
									<div className="flex items-center gap-3">
										<span className="flex h-12 w-12 items-center justify-center rounded-full bg-sauti-teal-light text-lg font-bold text-sauti-teal">{initials(open.name)}</span>
										<div className="min-w-0 text-left"><SheetTitle className="truncate">{open.name}</SheetTitle><SheetDescription className="truncate">{open.email}</SheetDescription></div>
									</div>
								</SheetHeader>
								<div className="flex-1 space-y-6 overflow-y-auto p-5">
									<section>
										<h4 className="mb-2 text-sm font-semibold">Roles</h4>
										{open.isSuperAdmin ? <p className="text-sm text-serene-neutral-600">Super admins have full access to everything and manage people and access.</p> : roles.length === 0 ? <p className="text-sm text-serene-neutral-500">No roles exist yet. Make one in the Roles tab.</p> : (
											<ul className="space-y-1">
												{roles.map((r) => {
													const on = r.members.some((m) => m.id === open.id);
													return (
														<li key={r.id}>
															<button disabled={busy === r.id} onClick={() => run(r.id, async () => { await unwrap(assignRole(r.id, open.id, !on, false)); await askEmail(open.id, on ? `The role "${r.name}" was taken away.` : `You were given the role "${r.name}".`); }, on ? "Role taken away" : "Role given")} className={cn("flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition", on ? "border-sauti-teal bg-sauti-teal-light/40" : "border-serene-neutral-200 hover:bg-serene-neutral-50")}>
																<span className={cn("flex h-5 w-5 items-center justify-center rounded-md border", on ? "border-sauti-teal bg-sauti-teal text-white" : "border-serene-neutral-300")}>{on && <Check className="h-3.5 w-3.5" />}</span>
																<span className="min-w-0 flex-1"><span className="block text-sm font-medium">{r.name}</span><span className="block truncate text-xs text-serene-neutral-500">{r.permissions.length} area{r.permissions.length === 1 ? "" : "s"}</span></span>
															</button>
														</li>
													);
												})}
											</ul>
										)}
									</section>
									<section>
										<h4 className="mb-2 text-sm font-semibold">What they can do</h4>
										<ul className="divide-y divide-serene-neutral-100 overflow-hidden rounded-xl border border-serene-neutral-100">
											{modules.map((m) => {
												const l: Lvl | null = open.isSuperAdmin || !eff ? "owner" : eff.get(m.key) ?? null;
												return (
													<li key={m.key} className="flex items-center justify-between gap-3 px-3 py-2">
														<span className="text-sm">{m.label}</span>
														{l ? <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium capitalize", TONE[l])}>{l}</span> : <span className="text-xs text-serene-neutral-400">No access</span>}
													</li>
												);
											})}
										</ul>
										{!open.isSuperAdmin && !eff && <p className="mt-1.5 text-xs text-serene-neutral-500">No role is set, so they can use everything. Give a role to limit this.</p>}
									</section>
									<section className="space-y-2">
										<h4 className="text-sm font-semibold">Account</h4>
										{open.isSuperAdmin ? (
											sa?.is_protected ? <p className="flex items-center gap-1.5 text-sm text-serene-neutral-500"><Lock className="h-4 w-4" /> Protected: this account cannot be changed.</p>
											: sa?.canRemove ? <Button variant="outline" className="gap-1.5 text-red-600" onClick={() => window.confirm(`Remove ${open.email} as a super admin?`) && run(sa.id, () => removeSuperAdmin(sa.id), "Super admin removed")}><ShieldOff className="h-4 w-4" /> Remove as super admin</Button>
											: <p className="text-sm text-serene-neutral-500">Only the person who added them can remove them.</p>
										) : (
											<div className="flex flex-wrap gap-2">
												<Button variant="outline" className="gap-1.5" disabled={!data.me.canAdd} onClick={() => window.confirm(`Make ${open.name} a super admin?`) && run(open.id, () => addSuperAdmin(open.email ?? ""), "Made a super admin")}><Crown className="h-4 w-4" /> Make super admin</Button>
												<Button variant="outline" className="gap-1.5" onClick={() => window.confirm(`Remove admin access for ${open.name}?`) && run(open.id, async () => { await setAdminStatus(open.id, false); await askEmail(open.id, "Your administrator access was removed."); setOpen(null); }, "Admin access removed")}><ShieldOff className="h-4 w-4" /> Make regular member</Button>
											</div>
										)}
										{!open.isSuperAdmin && (
											<Select onValueChange={(v) => window.confirm(`Change ${open.name}'s account type to ${v}?`) && run(open.id, () => setAccountType(open.id, v as "survivor" | "professional" | "ngo"), "Account type changed")}>
												<SelectTrigger><SelectValue placeholder="Change the account type" /></SelectTrigger>
												<SelectContent><SelectItem value="survivor">Survivor</SelectItem><SelectItem value="professional">Professional</SelectItem><SelectItem value="ngo">NGO</SelectItem></SelectContent>
											</Select>
										)}
									</section>
								</div>
							</>
						);
					})()}
				</SheetContent>
			</Sheet>

			{/* A role */}
			<Dialog open={!!edit} onOpenChange={(o) => !o && busy !== "role" && setEdit(null)}>
				<DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
					<DialogHeader><DialogTitle>{edit?.id ? "Edit role" : "New role"}</DialogTitle><DialogDescription>Choose a level for each part of the suite. Parts left on None are hidden from people with this role.</DialogDescription></DialogHeader>
					{edit && (
						<div className="space-y-3">
							<Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Role name, for example Fundraising" autoFocus />
							<Textarea value={edit.description} onChange={(e) => setEdit({ ...edit, description: e.target.value })} rows={2} placeholder="What this role is for (optional)" />
							<div className="flex flex-wrap gap-1.5 text-xs">
								<span className="py-1 text-serene-neutral-500">Set all to:</span>
								{LVLS.map((l) => <button key={l.v} type="button" onClick={() => setEdit({ ...edit, levels: Object.fromEntries(modules.map((m) => [m.key, l.v])) })} className="rounded-full border border-serene-neutral-200 px-2.5 py-1 font-medium hover:bg-serene-neutral-50">{l.label}</button>)}
							</div>
							<ul className="divide-y divide-serene-neutral-100 rounded-xl border border-serene-neutral-100">
								{modules.map((m) => {
									const cur = edit.levels[m.key] ?? "none";
									return (
										<li key={m.key} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5">
											<span><span className="block text-sm font-medium">{m.label}</span><span className="block text-xs text-serene-neutral-500">{m.hint}</span></span>
											<div className="inline-flex rounded-lg border border-serene-neutral-200 p-0.5" role="radiogroup" aria-label={m.label}>
												{LVLS.map((l) => (
													<button key={l.v} type="button" role="radio" aria-checked={cur === l.v} onClick={() => setEdit({ ...edit, levels: { ...edit.levels, [m.key]: l.v } })} className={cn("rounded-md px-2.5 py-1 text-xs font-medium", cur === l.v ? (l.v === "none" ? "bg-serene-neutral-200 text-serene-neutral-800" : "bg-sauti-teal text-white") : "text-serene-neutral-600 hover:bg-serene-neutral-50")}>{l.label}</button>
												))}
											</div>
										</li>
									);
								})}
							</ul>
						</div>
					)}
					<DialogFooter>
						<Button variant="outline" onClick={() => setEdit(null)} disabled={busy === "role"}>Cancel</Button>
						<Button className="gap-2 bg-sauti-teal hover:bg-sauti-dark" disabled={busy === "role" || !edit?.name.trim()} onClick={async () => {
							if (!edit) return;
							setBusy("role");
							try {
								const permissions = Object.entries(edit.levels).filter(([, l]) => l !== "none").map(([k, l]) => `${k}:${l}`);
								setRoles(await unwrap(saveRole(edit.id, { name: edit.name, description: edit.description, permissions })));
								setEdit(null);
								toast({ title: "Role saved" });
							} catch (e) { fail(e); } finally { setBusy(null); }
						}}>{busy === "role" && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</div>
	);
}
