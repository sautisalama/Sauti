"use client";

import { useCallback, useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Bell, EyeOff, Loader2, Lock, Plus, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { RecipientField } from "../mail/_components/RecipientField";
import { EntityReminders } from "@/components/mjengo/EntityReminders";
import {
	deleteAssignment, getEntityAccess, listAdmins, listAssignments, saveAssignment, setEntityAccess, setEntityControls,
	type AdminLite, type AssignmentRow, type EntityAccess,
} from "@/app/actions/mjengo";
import type { Kind } from "./shared";

const FIELD_LABEL: Record<string, string> = {
	amount: "Amount", value: "Estimated value", budget: "Budget", spent: "Amount spent", stipend: "Stipend",
	funder: "Funder", organisation: "Organisation", host: "Host", deadline: "Deadline", decision_date: "Decision date",
	owner_id: "Who is responsible", lead_id: "Lead", grant_id: "Funding grant", link: "Link", source_url: "Source link",
	description: "Description", notes: "Notes",
};

/**
 * What the person who added this controls: who can open it, who they have given it to, and which details the
 * others do not see (the amount, the funder, who is responsible, the notes). Only the owner (and super admins)
 * change this; everyone else is told that some details are hidden.
 */
export function EntityAccessPanel({ kind, id }: { kind: Kind; id: string }) {
	const { toast } = useToast();
	const [view, setView] = useState<EntityAccess | null>(null);
	const [team, setTeam] = useState<AdminLite[]>([]);
	const [adding, setAdding] = useState("");
	const [level, setLevel] = useState<"view" | "edit">("view");
	const [notify, setNotify] = useState(true);
	const [busy, setBusy] = useState(false);

	const refresh = useCallback(async () => {
		try { setView(await getEntityAccess(kind, id)); } catch { setView(null); }
	}, [kind, id]);
	useEffect(() => { void refresh(); listAdmins().then(setTeam).catch(() => setTeam([])); }, [refresh]);

	const run = async (fn: () => Promise<unknown>) => {
		setBusy(true);
		try { await fn(); await refresh(); } catch (e) { toast({ title: "Could not update", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setBusy(false); }
	};
	if (!view) return <Loader2 className="h-4 w-4 animate-spin text-serene-neutral-400" />;

	const byEmail = new Map(team.map((t) => [t.email ?? "", t]));
	const emails = adding.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean);

	if (!view.canManage) {
		return (
			<div className="rounded-xl border border-serene-neutral-100 p-3 text-sm text-serene-neutral-600">
				<p className="flex items-center gap-2 font-semibold text-serene-neutral-900">{view.visibility === "restricted" ? <Lock className="h-4 w-4" /> : <Users className="h-4 w-4" />} {view.visibility === "restricted" ? "Shared with some people" : "Open to the team"}</p>
				<p className="mt-1 text-xs">Added by {view.owner?.name ?? "someone"}. {view.hidden.length > 0 ? "Some details are kept hidden by them." : "Nothing is hidden."}</p>
			</div>
		);
	}

	return (
		<div className="space-y-3 rounded-xl border border-serene-neutral-100 p-3">
			<p className="flex items-center gap-2 text-sm font-semibold text-serene-neutral-900"><Lock className="h-4 w-4 text-sauti-teal" /> Who sees this</p>
			<label className="flex items-center justify-between gap-3 text-sm">
				<span>Everyone on the team can see it<span className="block text-xs text-serene-neutral-500">{view.visibility === "team" ? "Switch off to keep it to the people you add." : "Only you and the people added below."}</span></span>
				<Switch checked={view.visibility === "team"} disabled={busy} onCheckedChange={(on) => run(() => setEntityControls(kind, id, { visibility: on ? "team" : "restricted" }))} aria-label="Visible to the whole team" />
			</label>

			{view.visibility === "restricted" && (
				<div className="space-y-2">
					<div className="min-h-10 rounded-xl border border-serene-neutral-200 bg-white px-2.5"><RecipientField value={adding} onChange={setAdding} placeholder="Add teammates by name or email" /></div>
					{emails.length > 0 && (
						<div className="flex flex-wrap items-center gap-3">
							<select value={level} onChange={(e) => setLevel(e.target.value as "view" | "edit")} aria-label="Access" className="h-9 rounded-md border border-serene-neutral-200 bg-white px-2 text-sm"><option value="view">Can view</option><option value="edit">Can edit</option></select>
							<label className="flex items-center gap-2 text-sm"><Switch checked={notify} onCheckedChange={setNotify} aria-label="Email them" /> Email them</label>
							<Button size="sm" disabled={busy} className="ml-auto bg-sauti-teal hover:bg-sauti-dark" onClick={() => run(async () => {
								const out = emails.filter((e) => !byEmail.has(e));
								if (out.length) throw new Error(`${out.join(", ")} ${out.length === 1 ? "is" : "are"} not on the team.`);
								for (const e of emails) await setEntityAccess(kind, id, byEmail.get(e)!.id, level, notify);
								setAdding("");
							})}>Share</Button>
						</div>
					)}
					<ul className="divide-y divide-serene-neutral-100">
						{view.owner && <li className="flex items-center gap-3 py-1.5 text-sm"><span className="min-w-0 flex-1 truncate font-medium">{view.owner.name} <span className="font-normal text-serene-neutral-500">(added it)</span></span></li>}
						{view.people.map((p) => (
							<li key={p.id} className="flex items-center gap-3 py-1.5 text-sm">
								<span className="min-w-0 flex-1 truncate">{p.name}</span>
								<select value={p.level} disabled={busy} onChange={(e) => run(() => e.target.value === "none" ? setEntityAccess(kind, id, p.id, null, false) : setEntityAccess(kind, id, p.id, e.target.value as "view" | "edit", false))} aria-label={`Access for ${p.name}`} className="h-8 rounded-md border border-serene-neutral-200 bg-white px-1.5 text-xs">
									<option value="view">Can view</option><option value="edit">Can edit</option><option value="none">Remove</option>
								</select>
							</li>
						))}
					</ul>
				</div>
			)}

			<div>
				<p className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-serene-neutral-900"><EyeOff className="h-4 w-4 text-sauti-teal" /> Keep these details to yourself</p>
				<div className="flex flex-wrap gap-1.5">
					{view.hideable.map((k) => {
						const on = view.hidden.includes(k);
						return (
							<button key={k} type="button" disabled={busy} aria-pressed={on} onClick={() => run(() => setEntityControls(kind, id, { hidden: on ? view.hidden.filter((x) => x !== k) : [...view.hidden, k] }))} className={cn("rounded-full border px-3 py-1 text-xs font-medium", on ? "border-amber-300 bg-amber-50 text-amber-900" : "border-serene-neutral-200 text-serene-neutral-600 hover:bg-serene-neutral-50")}>
								{on && <EyeOff className="mr-1 inline h-3 w-3" />}{FIELD_LABEL[k] ?? k}
							</button>
						);
					})}
				</div>
				<p className="mt-1 text-[11px] text-serene-neutral-400">Others see these as hidden. Super admins and you always see everything.</p>
			</div>
		</div>
	);
}

const A_STATUS: { value: AssignmentRow["status"]; label: string; tone: string }[] = [
	{ value: "todo", label: "To do", tone: "bg-slate-100 text-slate-700" },
	{ value: "in_progress", label: "In progress", tone: "bg-sky-100 text-sky-800" },
	{ value: "submitted", label: "Submitted", tone: "bg-emerald-100 text-emerald-800" },
	{ value: "accepted", label: "Accepted", tone: "bg-sauti-teal-light text-sauti-dark" },
	{ value: "revise", label: "Needs changes", tone: "bg-amber-100 text-amber-800" },
];

/** What is due for a fellowship: each assignment has a date, a status and its own reminders. */
export function FellowshipAssignments({ fellowshipId }: { fellowshipId: string }) {
	const { toast } = useToast();
	const [rows, setRows] = useState<AssignmentRow[] | null>(null);
	const [title, setTitle] = useState("");
	const [due, setDue] = useState("");
	const [open, setOpen] = useState<string | null>(null);

	const load = useCallback(async () => { try { setRows(await listAssignments(fellowshipId)); } catch { setRows([]); } }, [fellowshipId]);
	useEffect(() => { void load(); }, [load]);

	const fail = (e: unknown) => toast({ title: "Could not save", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
	const add = async () => {
		if (!title.trim()) return;
		try { await saveAssignment(fellowshipId, null, { title, dueDate: due || null }); setTitle(""); setDue(""); await load(); } catch (e) { fail(e); }
	};
	const patch = async (id: string, v: Parameters<typeof saveAssignment>[2]) => {
		try { await saveAssignment(fellowshipId, id, v); await load(); } catch (e) { fail(e); }
	};

	return (
		<div className="space-y-2 rounded-xl border border-serene-neutral-100 p-3">
			<p className="text-sm font-semibold text-serene-neutral-900">Assignments and submissions</p>
			{!rows ? <Loader2 className="h-4 w-4 animate-spin text-serene-neutral-400" /> : rows.length === 0 ? <p className="text-xs text-serene-neutral-500">Nothing is due yet. Add the reports, essays or forms you have to hand in.</p> : (
				<ul className="space-y-2">
					{rows.map((a) => {
						const overdue = a.due_date && a.status !== "submitted" && a.status !== "accepted" && parseISO(a.due_date) < new Date(new Date().toDateString());
						return (
							<li key={a.id} className="rounded-lg border border-serene-neutral-100 p-2.5">
								<div className="flex flex-wrap items-center gap-2">
									<span className="min-w-0 flex-1 truncate text-sm font-medium">{a.title}</span>
									{a.due_date && <span className={cn("rounded-full px-2 py-0.5 text-xs", overdue ? "bg-rose-100 text-rose-700" : "bg-serene-neutral-100 text-serene-neutral-600")}>{overdue ? "Overdue " : "Due "}{format(parseISO(a.due_date), "d MMM")}</span>}
									<select value={a.status} onChange={(e) => void patch(a.id, { status: e.target.value as AssignmentRow["status"] })} aria-label="Status" className={cn("h-8 rounded-md border-0 px-2 text-xs font-semibold", A_STATUS.find((x) => x.value === a.status)?.tone)}>
										{A_STATUS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
									</select>
									<button type="button" aria-label="Reminders" onClick={() => setOpen((cur) => (cur === a.id ? null : a.id))} className="flex h-8 w-8 items-center justify-center rounded-full text-serene-neutral-500 hover:bg-serene-neutral-100"><Bell className="h-4 w-4" /></button>
									<button type="button" aria-label="Delete assignment" onClick={async () => { try { await deleteAssignment(fellowshipId, a.id); await load(); } catch (e) { fail(e); } }} className="flex h-8 w-8 items-center justify-center rounded-full text-serene-neutral-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
								</div>
								{open === a.id && <div className="mt-2 border-t border-serene-neutral-100 pt-2"><EntityReminders type="assignment" id={a.id} /></div>}
							</li>
						);
					})}
				</ul>
			)}
			<div className="flex flex-wrap gap-2 pt-1">
				<Input value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void add(); } }} placeholder="Add an assignment, for example Mid-term report" className="h-9 min-w-[180px] flex-1" />
				<Input type="date" value={due} onChange={(e) => setDue(e.target.value)} aria-label="Due date" className="h-9 w-40" />
				<Button size="sm" variant="outline" className="h-9 gap-1.5" disabled={!title.trim()} onClick={add}><Plus className="h-4 w-4" /> Add</Button>
			</div>
		</div>
	);
}
