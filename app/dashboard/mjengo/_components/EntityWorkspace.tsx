"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, CheckSquare, ExternalLink, FileWarning, Kanban, List, Loader2, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { deleteEntity, listAdmins, listEntities, saveEntity, type AdminLite, type EntityRow } from "@/app/actions/mjengo";
import { cn } from "@/lib/utils";
import { DocumentsPanel } from "./DocumentsPanel";
import { GrantCharts, type GrantLite } from "./GrantCharts";
import { Avatars, DeadlineChip, STATUSES, StatusPill, money, type Kind } from "./shared";

type FieldDef = { key: string; label: string; type: "text" | "textarea" | "number" | "date" | "select" | "owner" | "grant" | "url"; options?: { value: string; label: string }[]; wide?: boolean };

const CURRENCY: FieldDef = { key: "currency", label: "Currency", type: "select", options: ["USD", "KES", "EUR", "GBP"].map((c) => ({ value: c, label: c })) };

const CONFIG: Record<Kind, { noun: string; plural: string; titleKey: string; subKey: string; subLabel: string; fields: FieldDef[]; amountKey?: string }> = {
	grant: {
		noun: "grant",
		plural: "Grants",
		titleKey: "title",
		subKey: "funder",
		subLabel: "Funder",
		amountKey: "amount",
		fields: [
			{ key: "title", label: "Grant name", type: "text", wide: true },
			{ key: "funder", label: "Funder", type: "text" },
			{ key: "status", label: "Stage", type: "select", options: STATUSES.grant.map((s) => ({ value: s.value, label: s.label })) },
			{ key: "amount", label: "Amount", type: "number" },
			CURRENCY,
			{ key: "deadline", label: "Application deadline", type: "date" },
			{ key: "decision_date", label: "Decision expected", type: "date" },
			{ key: "owner_id", label: "Owner", type: "owner" },
			{ key: "link", label: "Call / portal link", type: "url", wide: true },
			{ key: "description", label: "What it funds", type: "textarea", wide: true },
			{ key: "notes", label: "Notes", type: "textarea", wide: true },
		],
	},
	opportunity: {
		noun: "opportunity",
		plural: "Opportunities",
		titleKey: "title",
		subKey: "organisation",
		subLabel: "Organisation",
		amountKey: "value",
		fields: [
			{ key: "title", label: "Opportunity", type: "text", wide: true },
			{ key: "organisation", label: "Organisation", type: "text" },
			{ key: "kind", label: "Type", type: "select", options: ["grant", "partnership", "tender", "fellowship", "event", "other"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })) },
			{ key: "status", label: "Status", type: "select", options: STATUSES.opportunity.map((s) => ({ value: s.value, label: s.label })) },
			{ key: "value", label: "Estimated value", type: "number" },
			CURRENCY,
			{ key: "deadline", label: "Deadline", type: "date" },
			{ key: "owner_id", label: "Owner", type: "owner" },
			{ key: "source_url", label: "Source link", type: "url", wide: true },
			{ key: "description", label: "Details", type: "textarea", wide: true },
			{ key: "notes", label: "Notes", type: "textarea", wide: true },
		],
	},
	project: {
		noun: "project",
		plural: "Projects",
		titleKey: "name",
		subKey: "description",
		subLabel: "Summary",
		fields: [
			{ key: "name", label: "Project name", type: "text", wide: true },
			{ key: "status", label: "Status", type: "select", options: STATUSES.project.map((s) => ({ value: s.value, label: s.label })) },
			{ key: "lead_id", label: "Lead", type: "owner" },
			{ key: "start_date", label: "Starts", type: "date" },
			{ key: "end_date", label: "Ends", type: "date" },
			{ key: "budget", label: "Budget", type: "number" },
			{ key: "spent", label: "Spent so far", type: "number" },
			CURRENCY,
			{ key: "progress", label: "Progress (%)", type: "number" },
			{ key: "grant_id", label: "Funded by grant", type: "grant", wide: true },
			{ key: "description", label: "Summary", type: "textarea", wide: true },
			{ key: "notes", label: "Notes", type: "textarea", wide: true },
		],
	},
};

const dueKey = (kind: Kind) => (kind === "project" ? "end_date" : "deadline");
const ownerKey = (kind: Kind) => (kind === "project" ? "lead_id" : "owner_id");
type Row = EntityRow & Record<string, any>;

export function EntityWorkspace({ kind }: { kind: Kind }) {
	const cfg = CONFIG[kind];
	const statuses = STATUSES[kind];
	const { toast } = useToast();

	const [rows, setRows] = useState<Row[] | null>(null);
	const [admins, setAdmins] = useState<AdminLite[]>([]);
	const [grants, setGrants] = useState<{ id: string; title: string }[]>([]);
	const [view, setView] = useState<"board" | "list">("board");
	const [q, setQ] = useState("");
	const [statusFilter, setStatusFilter] = useState<string | null>(null);
	const [editing, setEditing] = useState<{ id: string | null; values: Record<string, any> } | null>(null);
	const [saving, setSaving] = useState(false);
	const [dragId, setDragId] = useState<string | null>(null);

	useEffect(() => {
		try {
			const v = localStorage.getItem("ss_mjengo_view");
			if (v === "board" || v === "list") setView(v);
		} catch {}
	}, []);
	const changeView = (v: "board" | "list") => {
		setView(v);
		try { localStorage.setItem("ss_mjengo_view", v); } catch {}
	};

	const load = useCallback(async () => {
		const [list, people] = await Promise.all([listEntities(kind), listAdmins()]);
		setRows(list as Row[]);
		setAdmins(people);
		if (kind === "project") setGrants(((await listEntities("grant")) as Row[]).map((g) => ({ id: g.id, title: g.title })));
	}, [kind]);
	useEffect(() => {
		load().catch((e) => toast({ title: "Could not load", description: e instanceof Error ? e.message : undefined, variant: "destructive" }));
	}, [load, toast]);

	const filtered = useMemo(() => {
		const term = q.trim().toLowerCase();
		return (rows ?? []).filter((r) => (!statusFilter || r.status === statusFilter) && (!term || [r[cfg.titleKey], r[cfg.subKey]].some((v) => String(v ?? "").toLowerCase().includes(term))));
	}, [rows, q, statusFilter, cfg]);

	const openNew = () => setEditing({ id: null, values: { status: statuses[0].value, currency: "USD", ...(kind === "opportunity" ? { kind: "grant" } : {}), ...(kind === "project" ? { progress: 0 } : {}) } });
	const openRow = (r: Row) => setEditing({ id: r.id, values: { ...r } });

	const set = (key: string, value: unknown) => setEditing((e) => (e ? { ...e, values: { ...e.values, [key]: value } } : e));

	const save = async () => {
		if (!editing) return;
		setSaving(true);
		try {
			const payload: Record<string, unknown> = {};
			for (const f of cfg.fields) payload[f.key] = editing.values[f.key] === "" ? null : editing.values[f.key];
			const row = await saveEntity(kind, editing.id, payload);
			await load();
			setEditing({ id: row.id, values: { ...row } }); // stay open so documents can be added
			toast({ title: editing.id ? "Saved" : `${cfg.noun[0].toUpperCase()}${cfg.noun.slice(1)} created`, description: editing.id ? undefined : "You can now add its documents." });
		} catch (e) {
			toast({ title: "Could not save", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setSaving(false);
		}
	};

	const remove = async () => {
		if (!editing?.id || !window.confirm(`Delete this ${cfg.noun} and all its documents? This cannot be undone.`)) return;
		try {
			await deleteEntity(kind, editing.id);
			setEditing(null);
			await load();
		} catch (e) {
			toast({ title: "Could not delete", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		}
	};

	const moveTo = async (id: string, status: string) => {
		const row = rows?.find((r) => r.id === id);
		if (!row || row.status === status) return;
		setRows((prev) => prev?.map((r) => (r.id === id ? { ...r, status } : r)) ?? prev); // instantly
		try {
			await saveEntity(kind, id, { status });
		} catch (e) {
			toast({ title: "Could not move it", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
			load();
		}
	};

	if (!rows) {
		return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-serene-neutral-400" /></div>;
	}

	return (
		<div className="space-y-5">
			{kind === "grant" && <GrantCharts grants={rows as unknown as GrantLite[]} />}

			<div className="flex flex-col gap-3 lg:flex-row lg:items-center">
				<div className="relative flex-1">
					<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-serene-neutral-400" />
					<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Search ${cfg.plural.toLowerCase()}`} className="pl-9" />
				</div>
				<div className="flex items-center gap-2">
					<div className="inline-flex rounded-lg border border-serene-neutral-200 bg-white p-0.5" role="group" aria-label="View">
						<Button size="sm" variant={view === "board" ? "secondary" : "ghost"} className="h-8 gap-1.5" onClick={() => changeView("board")}><Kanban className="h-4 w-4" /> Board</Button>
						<Button size="sm" variant={view === "list" ? "secondary" : "ghost"} className="h-8 gap-1.5" onClick={() => changeView("list")}><List className="h-4 w-4" /> List</Button>
					</div>
					<Button onClick={openNew} className="gap-1.5 bg-sauti-teal hover:bg-sauti-dark"><Plus className="h-4 w-4" /> New {cfg.noun}</Button>
				</div>
			</div>

			<div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide" role="group" aria-label="Filter by status">
				<FilterChip active={!statusFilter} onClick={() => setStatusFilter(null)}>All <span className="ml-1 opacity-60">{rows.length}</span></FilterChip>
				{statuses.map((s) => (
					<FilterChip key={s.value} active={statusFilter === s.value} onClick={() => setStatusFilter(statusFilter === s.value ? null : s.value)}>
						{s.label} <span className="ml-1 opacity-60">{rows.filter((r) => r.status === s.value).length}</span>
					</FilterChip>
				))}
			</div>

			{rows.length === 0 ? (
				<div className="rounded-2xl border border-dashed border-serene-neutral-200 bg-white p-12 text-center">
					<p className="font-semibold text-serene-neutral-900">No {cfg.plural.toLowerCase()} yet</p>
					<p className="mt-1 text-sm text-serene-neutral-500">Add the first one to start tracking deadlines, documents and who is responsible.</p>
					<Button onClick={openNew} className="mt-4 gap-1.5"><Plus className="h-4 w-4" /> New {cfg.noun}</Button>
				</div>
			) : view === "board" ? (
				<div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-3 md:mx-0 md:px-0">
					{statuses.filter((s) => !statusFilter || s.value === statusFilter).map((s) => {
						const col = filtered.filter((r) => r.status === s.value);
						return (
							<div
								key={s.value}
								onDragOver={(e) => dragId && e.preventDefault()}
								onDrop={() => { if (dragId) moveTo(dragId, s.value); setDragId(null); }}
								className="w-[280px] shrink-0 rounded-2xl bg-serene-neutral-100/60 p-2"
							>
								<div className="flex items-center justify-between px-2 pb-2 pt-1">
									<span className="flex items-center gap-2 text-sm font-semibold text-serene-neutral-800"><span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />{s.label}</span>
									<span className="text-xs text-serene-neutral-500">{col.length}</span>
								</div>
								<div className="space-y-2">
									{col.map((r) => (
										<Card key={r.id} kind={kind} r={r} admins={admins} onOpen={() => openRow(r)} onDragStart={() => setDragId(r.id)} onDragEnd={() => setDragId(null)} dragging={dragId === r.id} />
									))}
									{col.length === 0 && <p className="px-2 py-6 text-center text-xs text-serene-neutral-400">Nothing here</p>}
								</div>
							</div>
						);
					})}
				</div>
			) : (
				<div className="overflow-hidden rounded-2xl border border-serene-neutral-100 bg-white">
					<ul className="divide-y divide-serene-neutral-50">
						{filtered.map((r) => (
							<li key={r.id}>
								<button onClick={() => openRow(r)} className="flex w-full touch-manipulation flex-wrap items-center gap-x-4 gap-y-1 p-3 text-left hover:bg-serene-neutral-50 sm:flex-nowrap">
									<div className="min-w-0 flex-1">
										<p className="truncate text-sm font-semibold text-serene-neutral-900">{r[cfg.titleKey]}</p>
										<p className="truncate text-xs text-serene-neutral-500">{r[cfg.subKey] || cfg.subLabel}</p>
									</div>
									<StatusPill kind={kind} value={r.status} />
									{cfg.amountKey && <span className="w-24 text-right text-sm tabular-nums text-serene-neutral-700">{money(r[cfg.amountKey], r.currency)}</span>}
									<DeadlineChip date={r[dueKey(kind)]} done={["awarded", "declined", "closed", "won", "lost", "passed", "completed", "cancelled"].includes(r.status)} />
									<Avatars ids={r[ownerKey(kind)] ? [r[ownerKey(kind)]] : []} admins={admins} />
									{r.docs.missing > 0 && <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-700"><FileWarning className="h-3.5 w-3.5" />{r.docs.missing}</span>}
								</button>
							</li>
						))}
						{filtered.length === 0 && <li className="p-8 text-center text-sm text-serene-neutral-500">Nothing matches.</li>}
					</ul>
				</div>
			)}

			<Sheet open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
				<SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-xl">
					<SheetHeader className="border-b p-4 pt-[max(1rem,env(safe-area-inset-top))]">
						<SheetTitle>{editing?.id ? `Edit ${cfg.noun}` : `New ${cfg.noun}`}</SheetTitle>
					</SheetHeader>
					{editing && (
						<div className="flex-1 space-y-6 p-4">
							<div className="grid gap-4 sm:grid-cols-2">
								{cfg.fields.map((f) => (
									<div key={f.key} className={cn("space-y-1.5", f.wide && "sm:col-span-2")}>
										<Label htmlFor={`f-${f.key}`} className="text-xs font-semibold text-serene-neutral-600">{f.label}</Label>
										<FieldInput f={f} value={editing.values[f.key]} onChange={(v) => set(f.key, v)} admins={admins} grants={grants} />
									</div>
								))}
							</div>

							{editing.id ? (
								<>
									{kind === "project" && <ProjectMoney v={editing.values} />}
									<DocumentsPanel kind={kind} entityId={editing.id} onChange={load} />
									<Link href="/dashboard/mjengo/todos" className="flex items-center gap-2 rounded-xl border border-serene-neutral-100 p-3 text-sm text-serene-neutral-700 hover:bg-serene-neutral-50">
										<CheckSquare className="h-4 w-4 text-sauti-teal" />
										{(rows.find((r) => r.id === editing.id)?.openTodos ?? 0)} open to-dos linked to this {cfg.noun}
										<ExternalLink className="ml-auto h-3.5 w-3.5 text-serene-neutral-400" />
									</Link>
								</>
							) : (
								<p className="flex items-start gap-2 rounded-xl bg-sauti-teal-light/40 p-3 text-sm text-sauti-dark"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> Save first, then add the documents this {cfg.noun} needs.</p>
							)}
						</div>
					)}
					<div className="sticky bottom-0 flex items-center gap-2 border-t bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
						{editing?.id && <Button variant="ghost" className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={remove}><Trash2 className="h-4 w-4" /> Delete</Button>}
						<div className="flex-1" />
						<Button variant="ghost" onClick={() => setEditing(null)}>Close</Button>
						<Button onClick={save} disabled={saving} className="gap-1.5 bg-sauti-teal hover:bg-sauti-dark">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
					</div>
				</SheetContent>
			</Sheet>
		</div>
	);
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
	return (
		<button onClick={onClick} aria-pressed={active} className={cn("shrink-0 touch-manipulation rounded-full border px-3 py-1 text-xs font-medium transition-colors", active ? "border-sauti-teal bg-sauti-teal text-white" : "border-serene-neutral-200 bg-white text-serene-neutral-700 hover:bg-serene-neutral-50")}>
			{children}
		</button>
	);
}

function Card({ kind, r, admins, onOpen, onDragStart, onDragEnd, dragging }: { kind: Kind; r: Row; admins: AdminLite[]; onOpen: () => void; onDragStart: () => void; onDragEnd: () => void; dragging: boolean }) {
	const cfg = CONFIG[kind];
	const finished = ["awarded", "declined", "closed", "won", "lost", "passed", "completed", "cancelled"].includes(r.status);
	return (
		<div
			role="button"
			tabIndex={0}
			draggable
			onDragStart={onDragStart}
			onDragEnd={onDragEnd}
			onClick={onOpen}
			onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpen()}
			className={cn("cursor-pointer touch-manipulation rounded-xl border border-serene-neutral-100 bg-white p-3 shadow-sm transition hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-sauti-teal", dragging && "opacity-40")}
		>
			<p className="line-clamp-2 text-sm font-semibold text-serene-neutral-900">{r[cfg.titleKey]}</p>
			{r[cfg.subKey] && kind !== "project" && <p className="mt-0.5 truncate text-xs text-serene-neutral-500">{r[cfg.subKey]}</p>}
			{kind === "project" && typeof r.progress === "number" && <Progress value={r.progress} className="mt-2 h-1.5" />}
			{cfg.amountKey && r[cfg.amountKey] != null && <p className="mt-2 text-sm font-bold tabular-nums text-serene-neutral-800">{money(r[cfg.amountKey], r.currency)}</p>}
			<div className="mt-2 flex flex-wrap items-center gap-1.5">
				<DeadlineChip date={r[dueKey(kind)]} done={finished} />
				{r.docs.missing > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"><FileWarning className="h-3 w-3" />{r.docs.missing} doc{r.docs.missing === 1 ? "" : "s"} needed</span>}
				{r.openTodos > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-sauti-teal-light px-2 py-0.5 text-xs font-medium text-sauti-dark"><CheckSquare className="h-3 w-3" />{r.openTodos}</span>}
			</div>
			<div className="mt-2"><Avatars ids={r[ownerKey(kind)] ? [r[ownerKey(kind)]] : []} admins={admins} /></div>
		</div>
	);
}

function ProjectMoney({ v }: { v: Record<string, any> }) {
	if (!v.budget) return null;
	const pct = Math.min(100, Math.round(((v.spent ?? 0) / v.budget) * 100));
	return (
		<div className="rounded-xl border border-serene-neutral-100 p-3">
			<div className="mb-1.5 flex justify-between text-xs text-serene-neutral-600"><span>Budget used</span><span>{money(v.spent ?? 0, v.currency)} of {money(v.budget, v.currency)} ({pct}%)</span></div>
			<Progress value={pct} className={cn("h-2", pct > 90 && "[&>div]:bg-rose-500")} />
		</div>
	);
}

function FieldInput({ f, value, onChange, admins, grants }: { f: FieldDef; value: any; onChange: (v: unknown) => void; admins: AdminLite[]; grants: { id: string; title: string }[] }) {
	const id = `f-${f.key}`;
	switch (f.type) {
		case "textarea":
			return <Textarea id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} rows={3} />;
		case "number":
			return <Input id={id} type="number" min={0} inputMode="decimal" value={value ?? ""} onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))} />;
		case "date":
			return <Input id={id} type="date" value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} />;
		case "url":
			return <Input id={id} type="url" inputMode="url" placeholder="https://" value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
		case "select":
			return (
				<Select value={value ?? undefined} onValueChange={onChange}>
					<SelectTrigger id={id}><SelectValue placeholder="Choose" /></SelectTrigger>
					<SelectContent>{f.options!.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent>
				</Select>
			);
		case "owner":
			return (
				<Select value={value ?? "none"} onValueChange={(v) => onChange(v === "none" ? null : v)}>
					<SelectTrigger id={id}><SelectValue placeholder="Unassigned" /></SelectTrigger>
					<SelectContent>
						<SelectItem value="none">Unassigned</SelectItem>
						{admins.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
					</SelectContent>
				</Select>
			);
		case "grant":
			return (
				<Select value={value ?? "none"} onValueChange={(v) => onChange(v === "none" ? null : v)}>
					<SelectTrigger id={id}><SelectValue placeholder="Not linked" /></SelectTrigger>
					<SelectContent>
						<SelectItem value="none">Not linked</SelectItem>
						{grants.map((g) => <SelectItem key={g.id} value={g.id}>{g.title}</SelectItem>)}
					</SelectContent>
				</Select>
			);
		default:
			return <Input id={id} value={value ?? ""} onChange={(e) => onChange(e.target.value)} />;
	}
}
