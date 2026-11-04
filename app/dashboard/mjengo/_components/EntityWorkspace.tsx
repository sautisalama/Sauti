"use client";

import { R, fromCache, fresh, held } from "@/lib/client/resources";
import { EntityReminders } from "@/components/mjengo/EntityReminders";
import { MjengoLoader } from "./MjengoLoader";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, ArrowLeft, BadgeCheck, Check, CheckSquare, Globe, Maximize2, EyeOff, Lock, Users, ExternalLink, FileWarning, Kanban, List, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { clearOpportunityInbox } from "@/app/actions/mjengo-nav";
import { deleteEntity, listAdmins, listEntities, saveEntity, type AdminLite, type EntityRow } from "@/app/actions/mjengo";
import { cn } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { invalidate } from "@/lib/client/swr";
import type { Verification } from "@/lib/mjengo/opportunity-types";
import { linkPreview, type LinkPreview } from "@/app/actions/mjengo-link-preview";
import { extractFundDetails } from "@/app/actions/mjengo-fund-extract";
import { DocumentsPanel } from "./DocumentsPanel";
import { ApplicationStudio } from "./ApplicationStudio";
import { OpportunityVerifyCard } from "./OpportunityVerify";
import { GrantCharts, type GrantLite } from "./GrantCharts";
import { Avatars, accessIds, DeadlineChip, STATUSES, StatusPill, money, type Kind } from "./shared";
import { EntityAccessPanel, FellowshipAssignments } from "./EntityExtras";
import { EntityTimeline } from "./EntityTimeline";
import { EntityTasks } from "./EntityTasks";
import { autoTagItem } from "@/app/actions/mjengo-search";
import { ProgressReport } from "./ProgressReport";
import { MemberFilter, SimilarItems, TagEditor } from "./Facets";

type FieldDef = { key: string; label: string; type: "text" | "textarea" | "number" | "date" | "select" | "owner" | "grant" | "url" | "tags" | "sdgs"; options?: { value: string; label: string }[]; wide?: boolean };

const CURRENCY: FieldDef = { key: "currency", label: "Currency", type: "select", options: ["USD", "KES", "EUR", "GBP"].map((c) => ({ value: c, label: c })) };

const CONFIG = {
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
			{ key: "sectors", label: "Sectors", type: "tags", wide: true },
			{ key: "themes", label: "Themes", type: "tags", wide: true },
			{ key: "sdgs", label: "Sustainable Development Goals", type: "sdgs", wide: true },
			{ key: "regions", label: "Open to", type: "tags", wide: true },
			{ key: "eligibility", label: "Who can apply", type: "textarea", wide: true },
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
			{ key: "kind", label: "Type", type: "select", options: ["grant", "partnership", "tender", "fellowship", "consultancy", "event", "other"].map((v) => ({ value: v, label: v[0].toUpperCase() + v.slice(1) })) },
			{ key: "status", label: "Status", type: "select", options: STATUSES.opportunity.map((s) => ({ value: s.value, label: s.label })) },
			{ key: "value", label: "Estimated value", type: "number" },
			CURRENCY,
			{ key: "deadline", label: "Deadline", type: "date" },
			{ key: "owner_id", label: "Owner", type: "owner" },
			{ key: "source_url", label: "Source link", type: "url", wide: true },
			{ key: "description", label: "Details", type: "textarea", wide: true },
			{ key: "sectors", label: "Sectors", type: "tags", wide: true },
			{ key: "themes", label: "Themes", type: "tags", wide: true },
			{ key: "sdgs", label: "Sustainable Development Goals", type: "sdgs", wide: true },
			{ key: "regions", label: "Open to", type: "tags", wide: true },
			{ key: "eligibility", label: "Who can apply", type: "textarea", wide: true },
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
} as unknown as Record<Kind, { noun: string; plural: string; titleKey: string; subKey: string; subLabel: string; fields: FieldDef[]; amountKey?: string }>;

CONFIG.fellowship = {
	noun: "fellowship",
	plural: "Fellowships",
	titleKey: "title",
	subKey: "host",
	subLabel: "Host",
	amountKey: "stipend",
	fields: [
		{ key: "title", label: "Fellowship", type: "text", wide: true },
		{ key: "host", label: "Host organisation", type: "text" },
		{ key: "status", label: "Status", type: "select", options: STATUSES.fellowship.map((s) => ({ value: s.value, label: s.label })) },
		{ key: "stipend", label: "Stipend or grant", type: "number" },
		CURRENCY,
		{ key: "start_date", label: "Starts", type: "date" },
		{ key: "deadline", label: "Ends or next deadline", type: "date" },
		{ key: "owner_id", label: "Who is responsible", type: "owner" },
		{ key: "link", label: "Programme link", type: "url", wide: true },
		{ key: "description", label: "About it", type: "textarea", wide: true },
		{ key: "sectors", label: "Sectors", type: "tags", wide: true },
		{ key: "themes", label: "Themes", type: "tags", wide: true },
		{ key: "sdgs", label: "Sustainable Development Goals", type: "sdgs", wide: true },
		{ key: "regions", label: "Open to", type: "tags", wide: true },
		{ key: "eligibility", label: "Who can apply", type: "textarea", wide: true },
		{ key: "notes", label: "Notes", type: "textarea", wide: true },
	],
};

const dueKey = (kind: Kind) => (kind === "project" ? "end_date" : "deadline");
const ownerKey = (kind: Kind) => (kind === "project" ? "lead_id" : "owner_id");
type Row = EntityRow & Record<string, any>;

export function EntityWorkspace({ kind, pageId }: { kind: Kind; pageId?: string }) {
	const cfg = CONFIG[kind];
	const statuses = STATUSES[kind];
	const { toast } = useToast();
	const router = useRouter();
	const listHref = `/dashboard/mjengo/${cfg.plural.toLowerCase()}`;
	// Opportunities that arrived from a phone stop counting once the list has been looked at.
	useEffect(() => {
		if (kind !== "opportunity" || pageId) return;
		const t = setTimeout(() => { clearOpportunityInbox().catch(() => undefined); }, 2500);
		return () => clearTimeout(t);
	}, [kind, pageId]);
	// Arriving from the phone share sheet.
	useEffect(() => {
		const p = new URLSearchParams(window.location.search);
		if (p.get("shared")) toast({ title: "Added to Opportunities", description: "Shared from your phone. Open it to add the deadline and details." });
		if (p.get("share_error")) toast({ title: "Could not save what you shared", variant: "destructive" });
		if (p.get("shared") || p.get("share_error")) window.history.replaceState(null, "", window.location.pathname);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const [rows, setRows] = useState<Row[] | null>(null);
	const [admins, setAdmins] = useState<AdminLite[]>([]);
	const [grants, setGrants] = useState<{ id: string; title: string }[]>([]);
	const [view, setView] = useState<"board" | "list">("board");
	const [q, setQ] = useState("");
	const [statusFilter, setStatusFilter] = useState<string | null>(null);
	const [memberFilter, setMemberFilter] = useState<string | null>(null);
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

	const load = useCallback(async (paint = false) => {
		if (paint === true) { const l = held(R.entities(kind)), a = held(R.admins); if (l && a) { setRows(l as Row[]); setAdmins(a); } }
		const [list, people] = await Promise.all([fresh(R.entities(kind)), fresh(R.admins)]);
		setRows(list as Row[]);
		setAdmins(people);
		if (kind === "project") setGrants(((await listEntities("grant")) as Row[]).map((g) => ({ id: g.id, title: g.title })));
	}, [kind]);
	useEffect(() => {
		load(true).catch((e) => toast({ title: "Could not load", description: e instanceof Error ? e.message : undefined, variant: "destructive" }));
	}, [load, toast]);

	const filtered = useMemo(() => {
		const term = q.trim().toLowerCase();
		return (rows ?? []).filter((r) => (!statusFilter || r.status === statusFilter)
			&& (!term || [r[cfg.titleKey], r[cfg.subKey], ...((r.tags as string[] | undefined) ?? [])].some((v) => String(v ?? "").toLowerCase().includes(term)))
			&& (!memberFilter || [r[ownerKey(kind)], r.created_by].includes(memberFilter)));
	}, [rows, q, statusFilter, memberFilter, cfg, kind]);

	const openNew = () => setEditing({ id: null, values: { status: statuses[0].value, currency: "USD", ...(kind === "opportunity" ? { kind: "grant" } : {}), ...(kind === "project" ? { progress: 0 } : {}) } });
	const openRow = (r: Row) => setEditing({ id: r.id, values: { ...r } });
	// The full page shows one record: open it as soon as the list has loaded.
	useEffect(() => {
		if (!pageId || !rows) return;
		const r = rows.find((x) => x.id === pageId);
		setEditing((cur) => (cur?.id === pageId ? cur : r ? { id: r.id, values: { ...r } } : null));
	}, [pageId, rows]);
	// "Start it directly" from Opportunities opens a blank form here.
	const openedNew = useRef(false);
	useEffect(() => {
		if (openedNew.current || !rows) return;
		const p = new URLSearchParams(window.location.search);
		if (p.get("new")) { openedNew.current = true; openNew(); window.history.replaceState(null, "", window.location.pathname); }
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [rows]);

	const set = (key: string, value: unknown) => setEditing((e) => (e ? { ...e, values: { ...e.values, [key]: value } } : e));
	// Details that have no value are left out to keep the form short; the "Add" chips bring one back.
	const [revealed, setRevealed] = useState<Set<string>>(new Set());
	useEffect(() => { setRevealed(new Set()); }, [editing?.id]);
	const urlKey = kind === "opportunity" ? "source_url" : "link";
	const coreKeys = new Set([cfg.titleKey, cfg.subKey, "status", "kind", urlKey, dueKey(kind), ownerKey(kind), "currency"]);
	const hasValue = (v: unknown) => !(v == null || v === "" || (Array.isArray(v) && v.length === 0));
	const shownField = (key: string) => coreKeys.has(key) || revealed.has(key) || hasValue(editing?.values[key]);
	const hiddenFields = cfg.fields.filter((f) => !shownField(f.key));

	const save = async () => {
		if (!editing) return;
		setSaving(true);
		try {
			const payload: Record<string, unknown> = {};
			for (const f of cfg.fields) payload[f.key] = editing.values[f.key] === "" ? null : editing.values[f.key];
			if (!editing.id) payload.visibility = editing.values.visibility === "restricted" ? "restricted" : "team";
			const row = await saveEntity(kind, editing.id, payload);
			lastSaved.current = JSON.stringify(payloadOf(row as Record<string, any>));
			await load();
			setEditing({ id: row.id, values: { ...row } }); // stay open so documents can be added
			toast({ title: editing.id ? "Saved" : `${cfg.noun[0].toUpperCase()}${cfg.noun.slice(1)} created`, description: editing.id ? undefined : "You can now add its documents." });
		} catch (e) {
			toast({ title: "Could not save", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setSaving(false);
		}
	};

	const [confirmingDelete, setConfirmingDelete] = useState(false);
	// A link that was read again changes the details; the tags and to-dos that depend on it are redone after saving.
	const [linkVersion, setLinkVersion] = useState(0);
	const [pendingRefresh, setPendingRefresh] = useState(false);
	const remove = async () => {
		if (!editing?.id) return;
		setConfirmingDelete(false);
		try {
			await deleteEntity(kind, editing.id);
			invalidate(R.documents.key);
			setEditing(null);
			if (pageId) { router.push(listHref); return; }
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

	useEffect(() => {
		if (!pendingRefresh || !editing?.id || saving) return;
		setPendingRefresh(false);
		const id = editing.id;
		void (async () => {
			try {
				await save();
				await unwrap(autoTagItem(kind, id));
				setLinkVersion((v) => v + 1);
				await load();
			} catch {
				toast({ title: "Saved, but the tags could not be refreshed", description: "Use Suggest tags to try again.", variant: "destructive" });
			}
		})();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [pendingRefresh, editing, saving]);

	// On the full page, edits save themselves a moment after typing stops; there is no Save button to forget.
	const [tab, setTab] = useState<"overview" | "work" | "files" | "activity" | "settings">("overview");
	// Server actions run one at a time in the browser, so a tab that is not on screen waits until it is first opened.
	const [seen, setSeen] = useState<Set<string>>(() => new Set(["overview"]));
	useEffect(() => { setSeen((cur) => (cur.has(tab) ? cur : new Set(cur).add(tab))); }, [tab]);
	const [glanceOpen, setGlanceOpen] = useState<Set<string>>(new Set());
	const [autoState, setAutoState] = useState<"idle" | "saving" | "saved" | "error">("idle");
	const lastSaved = useRef("");
	const payloadOf = useCallback((v: Record<string, any>) => {
		const p: Record<string, unknown> = {};
		for (const f of cfg.fields) p[f.key] = v[f.key] === "" ? null : v[f.key];
		return p;
	}, [cfg]);
	const savedKey = editing?.id ?? null;
	useEffect(() => {
		if (editing?.id) lastSaved.current = JSON.stringify(payloadOf(editing.values));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [savedKey]);
	const dirty = !!pageId && !!editing?.id && JSON.stringify(payloadOf(editing.values)) !== lastSaved.current;
	useEffect(() => {
		if (!pageId || !editing?.id || saving || !dirty) return;
		const id = editing.id;
		const payload = payloadOf(editing.values);
		const key = JSON.stringify(payload);
		const t = setTimeout(async () => {
			if (key === lastSaved.current) return;
			setAutoState("saving");
			try { await saveEntity(kind, id, payload); lastSaved.current = key; setAutoState("saved"); void load(); } catch { setAutoState("error"); }
		}, 1200);
		return () => clearTimeout(t);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [editing?.values, pageId, saving, dirty]);
	useEffect(() => {
		if (!dirty) return;
		const h = (e: BeforeUnloadEvent) => e.preventDefault();
		window.addEventListener("beforeunload", h);
		return () => window.removeEventListener("beforeunload", h);
	}, [dirty]);
	const goBack = async () => {
		if (dirty && editing?.id) {
			try { await saveEntity(kind, editing.id, payloadOf(editing.values)); lastSaved.current = JSON.stringify(payloadOf(editing.values)); }
			catch (e) { toast({ title: "Could not save before leaving", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); return; }
		}
		router.push(listHref);
	};

	if (!rows) {
		return <MjengoLoader label="Loading" />;
	}

	const eid = editing?.id ?? null;
	const gridFor = (omit: Set<string>) => editing ? (
		<div className="grid gap-4 sm:grid-cols-2">
			{cfg.fields.filter((f) => shownField(f.key) && !omit.has(f.key)).map((f) => (
				<div key={f.key} className={cn("space-y-1.5", f.wide && "sm:col-span-2")}>
					<Label htmlFor={`f-${f.key}`} className="text-xs font-semibold text-serene-neutral-600">{f.label}</Label>
					{((editing.values._hidden as string[] | undefined) ?? []).includes(f.key)
						? <p className="flex h-10 items-center gap-2 rounded-md border border-dashed border-amber-200 bg-amber-50/60 px-3 text-sm text-amber-800"><EyeOff className="h-4 w-4" /> Hidden by whoever added it</p>
						: <FieldInput f={f} value={editing.values[f.key]} onChange={(v) => set(f.key, v)} admins={admins} grants={grants} />}
				</div>
			))}
		</div>
	) : null;
	const addChips = editing && hiddenFields.length > 0 ? (
		<div className="flex flex-wrap items-center gap-1.5">
			<span className="text-xs text-serene-neutral-500">Add:</span>
			{hiddenFields.map((f) => (
				<button key={f.key} type="button" onClick={() => setRevealed((r) => new Set(r).add(f.key))} className="flex h-7 items-center gap-1 rounded-full border border-serene-neutral-200 px-2.5 text-xs font-medium text-serene-neutral-700 hover:bg-serene-neutral-50"><Plus className="h-3 w-3" />{f.label}</button>
			))}
		</div>
	) : null;
	const fundEl = editing && (kind === "grant" || kind === "opportunity" || kind === "fellowship") ? (
		<FundFromLink
			url={String(editing.values[urlKey] ?? "")}
			values={editing.values}
			existing={!!editing.id}
			onRefreshed={() => setPendingRefresh(true)}
			onFill={(patch) => Object.entries(patch).forEach(([k, v]) => set(k, v))}
		/>
	) : null;
	const previewEl = editing && kind === "grant" ? (
		<LinkPreviewCard
			url={String(editing.values.link ?? "")}
			values={editing.values}
			onFill={(patch) => Object.entries(patch).forEach(([k, v]) => v != null && v !== "" && set(k, v))}
		/>
	) : null;
	const verifyEl = editing && kind === "opportunity" ? (
		<OpportunityVerifyCard
			id={editing.id ?? null}
			values={editing.values}
			onFill={(patch) => Object.entries(patch).forEach(([k, v]) => v != null && v !== "" && set(k, v))}
			onChanged={load}
		/>
	) : null;
	const fieldsPart = editing ? (
		<div className="space-y-6">{gridFor(new Set())}{addChips}{fundEl}{previewEl}{verifyEl}</div>
	) : null;

	const extrasEl = editing && eid ? (
		<>
			{kind === "project" && <ProjectMoney v={editing.values} />}
			{kind === "fellowship" && <FellowshipAssignments fellowshipId={eid} />}
			{kind === "opportunity" && editing.values.converted_to_type && (
				<Link href={`/dashboard/mjengo/${editing.values.converted_to_type}s`} className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-medium text-emerald-800 hover:bg-emerald-100">Won, and now a {String(editing.values.converted_to_type)}. Open it <ExternalLink className="ml-auto h-3.5 w-3.5" /></Link>
			)}
		</>
	) : null;
	const tasksEl = eid ? <EntityTasks kind={kind} id={eid} version={linkVersion} noun={cfg.noun} /> : null;
	const tagsEl = eid && editing ? (
		<div className="rounded-xl border border-serene-neutral-100 p-3">
			<p className="mb-2 text-sm font-semibold text-serene-neutral-900">Tags</p>
			<TagEditor key={`tags-${linkVersion}`} type={kind} id={eid} tags={(editing.values.tags as string[] | undefined) ?? []} onChange={(t) => { set("tags", t); void load(); }} />
		</div>
	) : null;
	const docsEl = eid ? <DocumentsPanel kind={kind} entityId={eid} entityName={String(editing?.values[cfg.titleKey] ?? "")} onChange={load} /> : null;
	const remindersEl = eid ? (
		<div className="rounded-xl border border-serene-neutral-100 p-3">
			<p className="mb-2 text-sm font-semibold text-serene-neutral-900">Reminders</p>
			<EntityReminders type={kind} id={eid} />
		</div>
	) : null;
	const timelineEl = eid ? <EntityTimeline kind={kind} id={eid} /> : null;
	const reportEl = eid ? <ProgressReport kind={kind} id={eid} /> : null;
	const agentEl = eid ? (kind === "grant" || kind === "opportunity")  : null;
	const similarEl = eid ? <SimilarItems type={kind} id={eid} /> : null;
	const accessEl = eid ? <EntityAccessPanel kind={kind} id={eid} /> : null;
	const panelsPart = editing ? (
		<div className="space-y-6">
			{eid ? (
				<>{extrasEl}{tasksEl}{tagsEl}{docsEl}{remindersEl}{timelineEl}{reportEl}{agentEl}{similarEl}{accessEl}</>
			) : (
				<>
					<div className="rounded-xl border border-serene-neutral-100 p-3">
						<p className="mb-2 text-sm font-semibold text-serene-neutral-900">Who can open this {cfg.noun}</p>
						<div className="grid grid-cols-2 gap-2">
							{([["team", "Whole team", "Every teammate can open it.", Users], ["restricted", "Only me", "Private. You choose who else can open it.", Lock]] as const).map(([v, label, hint, Icon]) => {
								const on = (editing.values.visibility === "restricted" ? "restricted" : "team") === v;
								return (
									<button key={v} type="button" aria-pressed={on} onClick={() => set("visibility", v)} className={cn("flex items-start gap-2 rounded-xl border p-3 text-left", on ? "border-sauti-teal bg-sauti-teal-light/50" : "border-serene-neutral-200 hover:bg-serene-neutral-50")}>
										<Icon className="mt-0.5 h-4 w-4 shrink-0 text-sauti-teal" />
										<span><span className="block text-sm font-medium text-serene-neutral-900">{label}</span><span className="block text-xs text-serene-neutral-500">{hint}</span></span>
									</button>
								);
							})}
						</div>
					</div>
					<p className="flex items-start gap-2 rounded-xl bg-sauti-teal-light/40 p-3 text-sm text-sauti-dark"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> Save first, then add the documents this {cfg.noun} needs.</p>
				</>
			)}
		</div>
	) : null;
	const footerBar = (
					<div className="sticky bottom-0 flex items-center gap-2 border-t bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
						{editing?.id && (confirmingDelete ? (
							<span className="flex items-center gap-1" role="group" aria-label={`Confirm deleting this ${cfg.noun}`}>
								<Button variant="ghost" className="gap-1.5 text-red-700 hover:bg-red-50" onClick={remove}><Trash2 className="h-4 w-4" /> Yes, delete it</Button>
								<Button variant="ghost" onClick={() => setConfirmingDelete(false)}>Keep</Button>
							</span>
						) : (
							<Button variant="ghost" className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirmingDelete(true)}><Trash2 className="h-4 w-4" /> Delete</Button>
						))}
						<div className="flex-1" />
						<Button variant="ghost" onClick={() => (pageId ? router.push(listHref) : setEditing(null))}>{pageId ? "Back" : "Close"}</Button>
						<Button onClick={save} disabled={saving} className="gap-1.5 bg-sauti-teal hover:bg-sauti-dark">{saving && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
					</div>
	);

	if (pageId) {
		const row = rows.find((r) => r.id === pageId);
		const v = editing?.values ?? {};
		const title = String(v[cfg.titleKey] ?? row?.[cfg.titleKey] ?? cfg.noun);
		const ownerK = ownerKey(kind);
		const dueK = dueKey(kind);
		const finished = ["awarded", "declined", "closed", "won", "lost", "passed", "completed", "cancelled"].includes(String(v.status));
		const railKeys = [ownerK, dueK, cfg.amountKey, "currency", urlKey].filter(Boolean) as string[];
		const headKeys = [cfg.titleKey, "status", ...(kind !== "project" ? [cfg.subKey] : [])];
		const omit = new Set<string>([...railKeys, ...headKeys]);
		const field = (key: string) => cfg.fields.find((f) => f.key === key);
		const railField = (key: string) => {
			const f = field(key);
			if (!f || !editing) return null;
			return (
				<div key={key} className="space-y-1">
					<Label htmlFor={`f-${key}`} className="text-[11px] font-semibold uppercase tracking-wide text-serene-neutral-500">{f.label}</Label>
					<FieldInput f={f} value={editing.values[key]} onChange={(x) => set(key, x)} admins={admins} grants={grants} />
				</div>
			);
		};
		const nudges: { label: string; tab?: typeof tab }[] = [];
		const missing = row?.docs?.missing ?? 0;
		if (missing > 0) nudges.push({ label: `${missing} document${missing === 1 ? "" : "s"} still needed`, tab: "files" });
		if ((row?.openTodos ?? 0) > 0) nudges.push({ label: `${row?.openTodos} open to-do${row?.openTodos === 1 ? "" : "s"}`, tab: "work" });
		if (!finished && !v[ownerK]) nudges.push({ label: "Nobody is responsible yet" });
		if (!finished && !v[dueK]) nudges.push({ label: "No deadline set" });
		if (kind === "opportunity" && row?.verification && ["suspicious", "repost"].includes(row.verification.trust)) nudges.push({ label: "Check where this came from", tab: "files" });
		const tabs = [
			{ id: "overview", label: "Overview", badge: 0 },
			{ id: "work", label: "To-dos and reminders", badge: row?.openTodos ?? 0 },
			{ id: "files", label: kind === "opportunity" ? "Application" : "Pages and copies", badge: missing },
			{ id: "activity", label: "Activity", badge: 0 },
			{ id: "settings", label: "Sharing", badge: 0 },
		] as const;
		const showTab = (t: string) => (t === tab ? undefined : true);
		const card = "rounded-2xl border border-serene-neutral-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]";
		return (
			<div className="mx-auto max-w-6xl space-y-4">
				{!editing && (
					<div className="flex items-center gap-3">
						<button type="button" onClick={() => void goBack()} className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium text-serene-neutral-600 hover:bg-white"><ArrowLeft className="h-4 w-4" /> {cfg.plural}</button>
					</div>
				)}
				{!editing ? (
					<div className="rounded-2xl border border-dashed border-serene-neutral-200 bg-white p-12 text-center">
						<p className="font-semibold text-serene-neutral-900">This {cfg.noun} is not here</p>
						<p className="mt-1 text-sm text-serene-neutral-500">It may have been deleted, or it is kept to a few people.</p>
					</div>
				) : (
					<>
						<div className="sticky top-0 z-20 -mx-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-serene-neutral-200/70 bg-white/90 px-2 py-1.5 backdrop-blur">
							<Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => void goBack()} aria-label={`Back to ${cfg.plural}`} title={`Back to ${cfg.plural}`}><ArrowLeft className="h-4 w-4" /></Button>
							<Input aria-label={`${cfg.noun} name`} value={v[cfg.titleKey] ?? ""} onChange={(e) => set(cfg.titleKey, e.target.value)} className="h-9 min-w-0 flex-1 basis-48 truncate border-0 bg-transparent px-1 text-lg font-bold text-sauti-dark shadow-none focus-visible:ring-0" placeholder={`Name this ${cfg.noun}`} />
							{kind !== "project" && <Input aria-label={cfg.subLabel} value={v[cfg.subKey] ?? ""} onChange={(e) => set(cfg.subKey, e.target.value)} className="h-9 min-w-0 basis-full border-0 bg-transparent px-1 text-sm text-serene-neutral-600 shadow-none focus-visible:ring-0 sm:w-44 sm:flex-none sm:basis-auto" placeholder={cfg.subLabel} />}
							<Select value={v.status ?? undefined} onValueChange={(x) => set("status", x)}>
								<SelectTrigger aria-label="Stage" className="h-8 w-auto gap-2 rounded-full px-3 text-xs font-medium"><SelectValue placeholder="Stage" /></SelectTrigger>
								<SelectContent>{statuses.map((st) => <SelectItem key={st.value} value={st.value}><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full" style={{ background: st.color }} aria-hidden />{st.label}</span></SelectItem>)}</SelectContent>
							</Select>
							<DeadlineChip date={v[dueK]} done={finished} />
							{nudges.length > 0 && (
								<Popover>
									<PopoverTrigger asChild><button type="button" className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900 hover:bg-amber-200">{nudges.length} to check</button></PopoverTrigger>
									<PopoverContent align="end" className="w-64 p-1.5">
										<ul aria-label="What needs attention">
											{nudges.map((n) => (
												<li key={n.label}>{n.tab ? <button type="button" onClick={() => setTab(n.tab as typeof tab)} className="w-full rounded-md px-2.5 py-1.5 text-left text-sm text-serene-neutral-900 hover:bg-serene-neutral-100">{n.label}</button> : <span className="block px-2.5 py-1.5 text-sm text-serene-neutral-700">{n.label}</span>}</li>
											))}
										</ul>
									</PopoverContent>
								</Popover>
							)}
							<p className="flex min-w-[6.5rem] items-center justify-end gap-1.5 text-xs text-serene-neutral-500" aria-live="polite">
								{autoState === "saving" || saving ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Saving…</> : autoState === "error" ? <span className="text-red-700">Not saved. <button type="button" className="font-medium underline" onClick={() => setAutoState("idle")}>Dismiss</button></span> : dirty ? "Unsaved" : autoState === "saved" ? "Saved" : ""}
							</p>
						</div>

						<div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
							<div className="min-w-0 space-y-4">
								<div role="tablist" aria-label="Sections" className="flex gap-1 overflow-x-auto rounded-xl bg-serene-neutral-100/70 p-1">
									{tabs.map((t) => (
										<button key={t.id} role="tab" type="button" id={`tab-${t.id}`} aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} onClick={() => setTab(t.id)} className={cn("flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-colors", tab === t.id ? "bg-white text-sauti-dark shadow-sm" : "text-serene-neutral-600 hover:text-serene-neutral-900")}>
											{t.label}{t.badge > 0 && <span className="rounded-full bg-amber-100 px-1.5 text-[11px] font-semibold text-amber-900">{t.badge}</span>}
										</button>
									))}
								</div>

								{/* A tab loads the first time it is opened and stays mounted after that, so going back is instant. */}
								<div role="tabpanel" id="panel-overview" aria-labelledby="tab-overview" hidden={showTab("overview")} className="space-y-4">
									{verifyEl}
									<section className={cn(card, "space-y-5")}>
										{gridFor(omit)}
										{addChips}
										{fundEl}
										{previewEl}
									</section>
									{extrasEl}
								</div>
								<div role="tabpanel" id="panel-work" aria-labelledby="tab-work" hidden={showTab("work")} className="space-y-4">
									{seen.has("work") && <>{tasksEl}{remindersEl}{kind === "opportunity" ? similarEl : agentEl}</>}
								</div>
								<div role="tabpanel" id="panel-files" aria-labelledby="tab-files" hidden={showTab("files")} className="space-y-4">
									{seen.has("files") && (kind === "opportunity" && eid ? (
										<>
											<ApplicationStudio kind="opportunity" id={eid} title={title} sourceUrl={((): string | null => { const ver = (v.verification ?? null) as Verification | null; const ok = (u?: string | null) => (u && /^https?:\/\//i.test(u.trim()) ? u.trim() : null); return ok(ver?.finalUrl) ?? ok(ver?.applyUrl) ?? ok(String(v[urlKey] ?? "")); })()} onChange={load} />
											{agentEl}
										</>
									) : <>{docsEl}{similarEl}</>)}
								</div>
								<div role="tabpanel" id="panel-activity" aria-labelledby="tab-activity" hidden={showTab("activity")} className="space-y-4">
									{seen.has("activity") && <>{timelineEl}{reportEl}</>}
								</div>
								<div role="tabpanel" id="panel-settings" aria-labelledby="tab-settings" hidden={showTab("settings")} className="space-y-4">
									{seen.has("settings") && accessEl}
									<section className={cn(card, "space-y-2")}>
										<p className="text-sm font-semibold text-serene-neutral-900">Delete this {cfg.noun}</p>
										<p className="text-xs text-serene-neutral-600">This removes it for everyone. Its documents stay in Documents so they can be reused.</p>
										{confirmingDelete ? (
											<span className="flex items-center gap-1" role="group" aria-label={`Confirm deleting this ${cfg.noun}`}>
												<Button variant="ghost" className="gap-1.5 text-red-700 hover:bg-red-50" onClick={remove}><Trash2 className="h-4 w-4" /> Yes, delete it</Button>
												<Button variant="ghost" onClick={() => setConfirmingDelete(false)}>Keep</Button>
											</span>
										) : (
											<Button variant="outline" className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirmingDelete(true)}><Trash2 className="h-4 w-4" /> Delete</Button>
										)}
									</section>
								</div>
							</div>

								{(() => {
									const has = (k: string) => v[k] != null && String(v[k]).trim() !== "";
									const host = (u: string) => { try { return new URL(u).host.replace(/^www\./, ""); } catch { return u; } };
									const ver = (v.verification ?? null) as Verification | null;
									const web = (u: string | null | undefined) => (u && /^https?:\/\//i.test(u.trim()) ? u.trim() : null);
									const applyUrl = web(ver?.applyUrl);
									const siteUrl = web(ver?.website?.url);
									const facts = [
										{ id: "deadline", key: dueK, label: "Deadline", show: () => new Date(`${String(v[dueK]).slice(0, 10)}T12:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" }) },
										{ id: "owner", key: ownerK, label: "Owner", show: () => admins.find((x) => x.id === v[ownerK])?.name ?? "Assigned" },
										...(cfg.amountKey ? [{ id: "amount", key: cfg.amountKey, label: "Amount", show: () => `${String(v.currency ?? "").trim()} ${Number(v[cfg.amountKey as string]).toLocaleString()}`.trim() }] : []),
										{ id: "source", key: urlKey, label: "Source link", show: () => host(String(v[urlKey])) },
									];
									const links = [
										{ id: "apply", label: "Where to apply", url: applyUrl },
										{ id: "site", label: "Organisation", url: siteUrl },
									].filter((l) => l.url);
									const editingKey = (k: string) => glanceOpen.has(k);
									const filled = facts.filter((f) => has(f.key) && !editingKey(f.key));
									const open = facts.filter((f) => editingKey(f.key));
									const empty = facts.filter((f) => !has(f.key) && !editingKey(f.key));
									const toggle = (k: string, on: boolean) => setGlanceOpen((cur) => { const n = new Set(cur); if (on) n.add(k); else n.delete(k); return n; });
									const chips = empty.length > 0 && (
										<div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Add details">
											{filled.length + open.length + links.length === 0 && <span className="mr-0.5 text-xs text-serene-neutral-500">No details yet</span>}
											{empty.map((f) => <button key={f.key} type="button" onClick={() => toggle(f.key, true)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-serene-neutral-300 px-2.5 py-1 text-xs text-serene-neutral-600 hover:border-sauti-teal hover:text-sauti-teal"><Plus className="h-3 w-3" aria-hidden /> {f.label}</button>)}
										</div>
									);
									const tagsShown = tagsEl;
									if (filled.length + open.length + links.length === 0) return <aside className="space-y-3 px-1" aria-label="Key facts">{chips}{tagsShown}</aside>;
									return (
										<aside className="space-y-4 lg:sticky lg:top-16" aria-label="Key facts">
											<section className={cn(card, "space-y-2.5")}>
												<div className="flex items-center justify-between gap-2">
													<h2 className="text-sm font-semibold text-serene-neutral-900">Details</h2>
													<DeadlineChip date={v[dueK]} done={finished} />
												</div>
												<dl className="divide-y divide-serene-neutral-200">
													{filled.map((f) => (
														<div key={f.key} className="group flex items-center gap-2 py-1.5 first:pt-0">
															<dt className="w-20 shrink-0 text-xs text-serene-neutral-500">{f.label}</dt>
															<dd className="min-w-0 flex-1 truncate text-sm font-medium text-serene-neutral-900">{f.key === urlKey && String(v[urlKey]).startsWith("http") ? <a href={String(v[urlKey])} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sauti-teal hover:underline">{f.show()} <ExternalLink className="h-3 w-3" aria-hidden /></a> : f.show()}</dd>
															<button type="button" onClick={() => toggle(f.key, true)} aria-label={`Edit ${f.label.toLowerCase()}`} className="rounded-md p-1 text-serene-neutral-400 opacity-60 hover:bg-serene-neutral-100 hover:opacity-100 focus-visible:opacity-100 group-hover:opacity-100"><Pencil className="h-3.5 w-3.5" /></button>
														</div>
													))}
													{links.map((l) => (
														<div key={l.id} className="group flex items-center gap-2 py-1.5">
															<dt className="w-20 shrink-0 text-xs text-serene-neutral-500">{l.label}</dt>
															<dd className="min-w-0 flex-1 truncate text-sm font-medium"><a href={l.url as string} target="_blank" rel="noreferrer" className="inline-flex max-w-full items-center gap-1 text-sauti-teal hover:underline"><span className="truncate">{host(l.url as string)}</span> <ExternalLink className="h-3 w-3 shrink-0" aria-hidden /></a></dd>
														</div>
													))}
												</dl>
												{open.map((f) => (
													<div key={f.key} className="space-y-1.5">
														{f.key === cfg.amountKey ? <div className="grid grid-cols-[1fr_92px] gap-2">{railField(cfg.amountKey)}{railField("currency")}</div> : railField(f.key)}
														<button type="button" onClick={() => toggle(f.key, false)} className="inline-flex items-center gap-1 text-xs font-medium text-sauti-teal hover:underline"><Check className="h-3 w-3" /> Done</button>
													</div>
												))}
												{chips}
											</section>
											{tagsShown}
										</aside>
									);
								})()}
						</div>
					</>
				)}
			</div>
		);
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

			{kind === "opportunity" && (
				<p className="px-1 text-xs text-serene-neutral-500">
					When an opportunity is won it becomes a grant, project or fellowship, and those sections appear in the menu. Already working on one? Start it directly:{" "}
					{([["grants", "a grant"], ["projects", "a project"], ["fellowships", "a fellowship"]] as const).map(([path, label], i) => <span key={path}>{i > 0 && " · "}<Link href={`/dashboard/mjengo/${path}?new=1`} className="font-medium text-sauti-teal hover:underline">{label}</Link></span>)}
				</p>
			)}

			{rows.length > 0 && (
				<div className="flex flex-wrap items-center gap-2">
					<MemberFilter value={memberFilter} onChange={setMemberFilter} label={kind === "project" ? "Any lead" : "Anyone responsible"} />
				</div>
			)}

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
										<Card key={r.id} fullHref={`${listHref}/${r.id}`} kind={kind} r={r} admins={admins} onOpen={() => openRow(r)} onDragStart={() => setDragId(r.id)} onDragEnd={() => setDragId(null)} dragging={dragId === r.id} />
									))}
									{col.length === 0 && <p className="px-2 py-6 text-center text-xs text-serene-neutral-400">Nothing here</p>}
								</div>
							</div>
						);
					})}
				</div>
			) : (
				<div className="overflow-hidden rounded-2xl border border-serene-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
					<ul className="divide-y divide-serene-neutral-50">
						{filtered.map((r) => (
							<li key={r.id} className="group relative"><Link href={`${listHref}/${r.id}`} aria-label={`Open ${cfg.noun} as a full page`} title="Open the full page" className="absolute right-2 top-2 z-10 hidden rounded-md bg-white p-1.5 text-serene-neutral-500 shadow-sm ring-1 ring-serene-neutral-200 hover:text-sauti-teal group-hover:block"><Maximize2 className="h-3.5 w-3.5" /></Link>
								<button onClick={() => openRow(r)} className="flex w-full touch-manipulation flex-wrap items-center gap-x-4 gap-y-1 p-3 text-left hover:bg-serene-neutral-50 sm:flex-nowrap">
									<div className="min-w-0 flex-1">
										<p className="flex items-center gap-1.5 truncate text-sm font-semibold text-serene-neutral-900"><span className="truncate">{r[cfg.titleKey]}</span>{r.visibility === "restricted" && <Lock className="h-3 w-3 shrink-0 text-serene-neutral-400" aria-label="Private" />}{kind === "opportunity" && r.verification?.trust === "verified" && <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-label="Verified source" />}{kind === "opportunity" && r.verification && ["suspicious", "repost"].includes(r.verification.trust) && <AlertCircle className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-label="Check the source" />}</p>
										<p className="truncate text-xs text-serene-neutral-500">{r[cfg.subKey] || cfg.subLabel}</p>
									</div>
									<StatusPill kind={kind} value={r.status} />
									{cfg.amountKey && <span className="w-24 text-right text-sm tabular-nums text-serene-neutral-700">{money(r[cfg.amountKey], r.currency)}</span>}
									<DeadlineChip date={r[dueKey(kind)]} done={["awarded", "declined", "closed", "won", "lost", "passed", "completed", "cancelled"].includes(r.status)} />
									<Avatars ids={accessIds(r, admins)} admins={admins} />
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
						{editing?.id && <Link href={`${listHref}/${editing.id}`} className="inline-flex w-fit items-center gap-1.5 rounded-full border border-serene-neutral-200 px-3 py-1 text-xs font-medium text-sauti-teal hover:bg-serene-neutral-50"><Maximize2 className="h-3.5 w-3.5" /> Open the full page</Link>}
					</SheetHeader>
					{editing && <div className="flex-1 space-y-6 p-4">{fieldsPart}{panelsPart}</div>}
					<div className="sticky bottom-0 flex items-center gap-2 border-t bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
						{editing?.id && (confirmingDelete ? (
							<span className="flex items-center gap-1" role="group" aria-label={`Confirm deleting this ${cfg.noun}`}>
								<Button variant="ghost" className="gap-1.5 text-red-700 hover:bg-red-50" onClick={remove}><Trash2 className="h-4 w-4" /> Yes, delete it</Button>
								<Button variant="ghost" onClick={() => setConfirmingDelete(false)}>Keep</Button>
							</span>
						) : (
							<Button variant="ghost" className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setConfirmingDelete(true)}><Trash2 className="h-4 w-4" /> Delete</Button>
						))}
						<div className="flex-1" />
						<Button variant="ghost" onClick={() => (pageId ? router.push(listHref) : setEditing(null))}>{pageId ? "Back" : "Close"}</Button>
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

function Card({ fullHref, kind, r, admins, onOpen, onDragStart, onDragEnd, dragging }: { fullHref: string; kind: Kind; r: Row; admins: AdminLite[]; onOpen: () => void; onDragStart: () => void; onDragEnd: () => void; dragging: boolean }) {
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
			<div className="flex items-start gap-1.5"><p className="line-clamp-2 min-w-0 flex-1 text-sm font-semibold text-serene-neutral-900">{r[cfg.titleKey]}</p><Link href={fullHref} onClick={(e) => e.stopPropagation()} onKeyDown={(e) => e.stopPropagation()} draggable={false} aria-label={`Open ${cfg.noun} as a full page`} title="Open the full page" className="-mr-1 -mt-0.5 shrink-0 rounded-md p-1 text-serene-neutral-400 hover:bg-serene-neutral-100 hover:text-sauti-teal"><Maximize2 className="h-3.5 w-3.5" /></Link></div>
			{r[cfg.subKey] && kind !== "project" && <p className="mt-0.5 truncate text-xs text-serene-neutral-500">{r[cfg.subKey]}</p>}
			{kind === "project" && typeof r.progress === "number" && <Progress value={r.progress} className="mt-2 h-1.5" />}
			{cfg.amountKey && r[cfg.amountKey] != null && <p className="mt-2 text-sm font-bold tabular-nums text-serene-neutral-800">{money(r[cfg.amountKey], r.currency)}</p>}
			<div className="mt-2 flex flex-wrap items-center gap-1.5">
				<DeadlineChip date={r[dueKey(kind)]} done={finished} />
				{r.docs.missing > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800"><FileWarning className="h-3 w-3" />{r.docs.missing} doc{r.docs.missing === 1 ? "" : "s"} needed</span>}
				{r.openTodos > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-sauti-teal-light px-2 py-0.5 text-xs font-medium text-sauti-dark"><CheckSquare className="h-3 w-3" />{r.openTodos}</span>}
			</div>
			<div className="mt-2"><Avatars ids={accessIds(r, admins)} admins={admins} /></div>
		</div>
	);
}

function LinkPreviewCard({ url, values, onFill }: { url: string; values: Record<string, any>; onFill: (patch: Record<string, unknown>) => void }) {
	const [pv, setPv] = useState<LinkPreview | null>(null);
	const [err, setErr] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	useEffect(() => {
		setPv(null); setErr(null);
		if (!/^https?:\/\/[^\s.]+\.[^\s]+/i.test(url.trim())) return;
		setBusy(true);
		let live = true;
		const t = setTimeout(() => {
			unwrap(linkPreview(url.trim())).then((r) => live && setPv(r)).catch((e) => live && setErr(e instanceof Error ? e.message : "Could not read that link.")).finally(() => live && setBusy(false));
		}, 700);
		return () => { live = false; clearTimeout(t); setBusy(false); };
	}, [url]);
	if (!url.trim() || (!busy && !pv && !err)) return null;
	if (busy) return <div className="flex items-center gap-2 rounded-xl border border-dashed border-serene-neutral-200 p-3 text-xs text-serene-neutral-500"><Loader2 className="h-4 w-4 animate-spin" /> Reading the link...</div>;
	if (err) return <p className="rounded-xl border border-dashed border-serene-neutral-200 p-3 text-xs text-serene-neutral-500">{err}</p>;
	if (!pv) return null;
	const canFill = !!pv.title || !!pv.organisation || !!pv.description;
	return (
		<div className="overflow-hidden rounded-xl border border-serene-neutral-200 bg-white">
			{pv.image && <img src={pv.image} alt="" loading="lazy" className="aspect-[1.91/1] w-full bg-serene-neutral-50 object-cover" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />}
			<div className="space-y-1.5 p-3">
				<div className="flex items-center gap-2 text-xs text-serene-neutral-500">
					{pv.favicon && <img src={pv.favicon} alt="" className="h-4 w-4 rounded-sm" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />}
					<span className="truncate">{pv.organisation ?? pv.siteName}</span>
				</div>
				{pv.title && <p className="line-clamp-2 text-sm font-semibold text-serene-neutral-900">{pv.title}</p>}
				{pv.description && <p className="line-clamp-3 text-xs text-serene-neutral-600">{pv.description}</p>}
				<div className="flex flex-wrap items-center gap-2 pt-1">
					{canFill && (
						<Button type="button" size="sm" variant="outline" onClick={() => onFill({
							title: values.title || pv.title || values.title,
							organisation: values.organisation || pv.organisation || values.organisation,
							description: values.description || pv.description || values.description,
							deadline: values.deadline || pv.deadline || values.deadline,
						})}>Fill empty fields</Button>
					)}
					<a href={pv.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-sauti-teal hover:underline">Open <ExternalLink className="h-3 w-3" /></a>
				</div>
			</div>
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
		case "tags":
			return <TagsInput id={id} value={Array.isArray(value) ? value : []} onChange={onChange} />;
		case "sdgs":
			return <SdgPicker value={Array.isArray(value) ? value : []} onChange={onChange} />;
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

function TagsInput({ id, value, onChange }: { id: string; value: string[]; onChange: (v: unknown) => void }) {
	const [draft, setDraft] = useState("");
	const add = () => { const t = draft.trim(); if (t && !value.includes(t)) onChange([...value, t]); setDraft(""); };
	return (
		<div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input px-2 py-1.5">
			{value.map((t) => (
				<span key={t} className="flex items-center gap-1 rounded-full bg-sauti-teal-light py-0.5 pl-2.5 pr-1 text-xs font-medium text-sauti-dark">{t}<button type="button" aria-label={`Remove ${t}`} onClick={() => onChange(value.filter((x) => x !== t))} className="rounded-full px-1 hover:bg-black/10">×</button></span>
			))}
			<input id={id} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } else if (e.key === "Backspace" && !draft && value.length) onChange(value.slice(0, -1)); }} onBlur={add} placeholder={value.length ? "" : "Type and press Enter"} className="min-w-[8rem] flex-1 bg-transparent py-0.5 text-sm outline-none" />
		</div>
	);
}

const SDG_NAMES = ["No poverty", "Zero hunger", "Good health and well-being", "Quality education", "Gender equality", "Clean water and sanitation", "Affordable and clean energy", "Decent work and economic growth", "Industry, innovation and infrastructure", "Reduced inequalities", "Sustainable cities and communities", "Responsible consumption and production", "Climate action", "Life below water", "Life on land", "Peace, justice and strong institutions", "Partnerships for the goals"];
const SDG_COLOURS = ["#E5243B", "#DDA63A", "#4C9F38", "#C5192D", "#FF3A21", "#26BDE2", "#FCC30B", "#A21942", "#FD6925", "#DD1367", "#FD9D24", "#BF8B2E", "#3F7E44", "#0A97D9", "#56C02B", "#00689D", "#19486A"];

function SdgPicker({ value, onChange }: { value: number[]; onChange: (v: unknown) => void }) {
	const toggle = (n: number) => onChange(value.includes(n) ? value.filter((x) => x !== n) : [...value, n].sort((a, b) => a - b));
	return (
		<div>
			<div className="flex flex-wrap gap-1.5">
				{SDG_NAMES.map((name, i) => {
					const n = i + 1, on = value.includes(n);
					return <button key={n} type="button" aria-pressed={on} aria-label={`Goal ${n}: ${name}`} title={`${n}. ${name}`} onClick={() => toggle(n)} className={cn("flex h-8 w-8 items-center justify-center rounded-md text-xs font-bold transition", on ? "text-white shadow-sm" : "bg-serene-neutral-100 text-serene-neutral-500 hover:bg-serene-neutral-200")} style={on ? { background: SDG_COLOURS[i] } : undefined}>{n}</button>;
				})}
			</div>
			{value.length > 0 && <p className="mt-1.5 text-xs text-serene-neutral-600">{value.map((n) => `${n}. ${SDG_NAMES[n - 1]}`).join(" · ")}</p>}
		</div>
	);
}

/** Reads the call's page and fills the details that are still empty: what it funds, sectors, themes, SDGs, who can apply. */
function FundFromLink({ url, values, onFill, existing = false, onRefreshed }: { url: string; values: Record<string, any>; onFill: (patch: Record<string, unknown>) => void; existing?: boolean; onRefreshed?: () => void }) {
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState<string | null>(null);
	const [done, setDone] = useState<{ site: string; filled: string[] } | null>(null);
	// What a refresh replaced, so it can be put back.
	const [undo, setUndo] = useState<Record<string, unknown> | null>(null);
	const onRefreshedRef = useRef(onRefreshed);
	onRefreshedRef.current = onRefreshed;
	// An item that is already saved is not read again just by opening it; only a changed link, or the button, does that.
	const lastUrl = useRef(existing ? url.trim() : "");
	const valuesRef = useRef(values);
	valuesRef.current = values;
	const onFillRef = useRef(onFill);
	onFillRef.current = onFill;
	const LABELS: Record<string, string> = { title: "name", organisation: "funder", description: "details", amount: "amount", deadline: "deadline", sectors: "sectors", themes: "themes", sdgs: "SDGs", regions: "regions", eligibility: "eligibility" };

	const read = useCallback(async (overwrite = false) => {
		setErr(null);
		setBusy(true);
		try {
			const r = await unwrap(extractFundDetails(url.trim()));
			const cur = valuesRef.current;
			const empty = (v: unknown) => v == null || v === "" || (Array.isArray(v) && v.length === 0);
			// The funder or host goes to whichever field this kind uses; a grant's amount is "amount", an opportunity's "value".
			const orgKey = "funder" in cur ? "funder" : "host" in cur ? "host" : "organisation";
			const amountKey = "amount" in cur ? "amount" : "stipend" in cur ? "stipend" : "value";
			const targets: Record<string, string> = { title: "title", organisation: orgKey, description: "description", amount: amountKey, deadline: "deadline", sectors: "sectors", themes: "themes", sdgs: "sdgs", regions: "regions", eligibility: "eligibility" };
			const patch: Record<string, unknown> = {};
			const prev: Record<string, unknown> = {};
			const filled: string[] = [];
			let gotAmount = false;
			for (const [k, v] of Object.entries(r)) {
				const key = targets[k];
				if (!key || v == null || (Array.isArray(v) && !v.length)) continue;
				if (!empty(cur[key]) && !(overwrite && JSON.stringify(cur[key]) !== JSON.stringify(v))) continue;
				if (overwrite && !empty(cur[key])) prev[key] = cur[key];
				patch[key] = v;
				filled.push(LABELS[k] ?? k);
				if (k === "amount") gotAmount = true;
			}
			if (gotAmount && r.currency) patch.currency = r.currency;
			if (Object.keys(patch).length) onFillRef.current(patch);
			setDone({ site: r.sourceSite ?? "", filled });
			setUndo(overwrite && Object.keys(prev).length ? prev : null);
			// On a saved record, new details mean its tags and to-dos should be redone too.
			if (existing && filled.length) onRefreshedRef.current?.();
		} catch (e) {
			setErr(e instanceof Error ? e.message : "Could not read that link.");
		} finally {
			setBusy(false);
		}
	}, [url, existing]);

	// A new link is read once, a moment after it stops changing.
	useEffect(() => {
		const u = url.trim();
		if (!/^https?:\/\/[^\s.]+\.[^\s]+/i.test(u) || u === lastUrl.current) return;
		const t = setTimeout(() => { lastUrl.current = u; void read(); }, 1200);
		return () => clearTimeout(t);
	}, [url, read]);

	if (!/^https?:\/\//i.test(url.trim()) || (!busy && !done && !err && !existing)) return null;
	return (
		<div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-serene-neutral-200 px-3 py-2 text-xs text-serene-neutral-600">
			{busy ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Reading the page and filling in the details…</> : err ? <span>{err}</span> : done && (
				<span>{done.filled.length ? <>{undo ? "Updated" : "Filled"} from {done.site || "the link"}: {done.filled.join(", ")}.{existing ? " Tags and to-dos were refreshed." : ""}</> : <>Read {done.site || "the link"}. Nothing new to fill in.</>}</span>
			)}
			{!busy && undo && <button type="button" onClick={() => { onFillRef.current(undo); setUndo(null); onRefreshedRef.current?.(); }} className="font-medium text-serene-neutral-700 hover:underline">Undo</button>}
			{!busy && <button type="button" onClick={() => void read(existing)} className="font-medium text-sauti-teal hover:underline">{existing ? "Refresh from link" : "Read again"}</button>}
		</div>
	);
}
