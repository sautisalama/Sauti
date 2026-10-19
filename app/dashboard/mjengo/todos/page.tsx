"use client";

import { EntityReminders } from "@/components/mjengo/EntityReminders";
import { MjengoLoader } from "../_components/MjengoLoader";
import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO, addDays } from "date-fns";
import { Bell, Calendar, CalendarCheck, CalendarDays, Check, ChevronDown, ChevronRight, ListChecks, ListPlus, Loader2, MoreVertical, Pencil, Plus, Star, Sun, Trash2, UserCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { createTrack, deleteTodo, deleteTrack, getTodoBoard, renameTrack, saveTodo, type TodoRow, type TrackRow } from "@/app/actions/mjengo";
import { Avatars, DeadlineChip, KIND_LABEL } from "../_components/shared";
import { MemberFilter, SimilarItems, TagEditor, TagFilter, tagLabel } from "../_components/Facets";

type Board = Awaited<ReturnType<typeof getTodoBoard>>;
type Task = TodoRow & { trackName: string; trackColor: string };

const DOTS: Record<string, string> = { purple: "bg-sauti-teal", blue: "bg-sky-500", green: "bg-emerald-500", amber: "bg-amber-500", rose: "bg-rose-500" };
const COLORS = Object.keys(DOTS);
const iso = (d: Date) => format(d, "yyyy-MM-dd");

const SMART = [
	{ id: "myday", label: "My Day", icon: Sun, hint: "Yours, due today or overdue" },
	{ id: "important", label: "Important", icon: Star, hint: "Starred by the team" },
	{ id: "planned", label: "Planned", icon: CalendarDays, hint: "Anything with a due date" },
	{ id: "assigned", label: "Assigned to me", icon: UserCheck, hint: "Given to you" },
	{ id: "all", label: "Tasks", icon: ListChecks, hint: "Everything" },
] as const;

export default function TodosPage() {
	const { toast } = useToast();
	const [board, setBoard] = useState<Board | null>(null);
	const [view, setView] = useState<string>("myday");
	const [editing, setEditing] = useState<Task | null>(null);
	const [showDone, setShowDone] = useState(false);
	const [quick, setQuick] = useState("");
	const [newList, setNewList] = useState<string | null>(null);
	const [tagFilter, setTagFilter] = useState<string[]>([]);
	const [memberFilter, setMemberFilter] = useState<string | null>(null);

	const load = useCallback(async () => setBoard(await getTodoBoard()), []);
	useEffect(() => {
		load().catch(() => toast({ title: "Could not load to-dos", variant: "destructive" }));
	}, [load, toast]);

	// A reminder links here with ?task=<id>.
	useEffect(() => {
		if (!board) return;
		const id = new URLSearchParams(window.location.search).get("task");
		if (!id) return;
		const t = tasksOf(board).find((x) => x.id === id);
		if (t) setEditing(t);
		window.history.replaceState(null, "", window.location.pathname);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [board?.me]);

	const fail = (title: string, e: unknown) => toast({ title, description: e instanceof Error ? e.message : undefined, variant: "destructive" });
	const run = async (fn: () => Promise<unknown>, errTitle: string) => {
		try {
			await fn();
			await load();
		} catch (e) {
			fail(errTitle, e);
		}
	};

	const all = useMemo(() => (board ? tasksOf(board) : []), [board]);
	const today = iso(new Date());

	const inViewAll = useMemo(() => {
		if (!board) return [];
		const mine = (t: Task) => t.assignee_ids.includes(board.me) || (t.assignee_ids.length === 0 && t.created_by === board.me);
		switch (view) {
			case "myday": return all.filter((t) => mine(t) && t.due_date && t.due_date <= today);
			case "important": return all.filter((t) => t.important);
			case "planned": return all.filter((t) => t.due_date);
			case "assigned": return all.filter((t) => t.assignee_ids.includes(board.me));
			case "all": return all;
			default: return all.filter((t) => t.track_id === view);
		}
	}, [all, board, view, today]);
	// Tags and team member narrow whichever list or smart view is open.
	const inView = useMemo(() => inViewAll.filter((t) => (!tagFilter.length || tagFilter.some((x) => (t.tags ?? []).includes(x))) && (!memberFilter || t.assignee_ids.includes(memberFilter) || t.created_by === memberFilter)), [inViewAll, tagFilter, memberFilter]);

	const count = (id: string) => {
		if (!board) return 0;
		const open = all.filter((t) => t.status !== "done");
		const mine = (t: Task) => t.assignee_ids.includes(board.me) || (t.assignee_ids.length === 0 && t.created_by === board.me);
		switch (id) {
			case "myday": return open.filter((t) => mine(t) && t.due_date && t.due_date <= today).length;
			case "important": return open.filter((t) => t.important).length;
			case "planned": return open.filter((t) => t.due_date).length;
			case "assigned": return open.filter((t) => t.assignee_ids.includes(board.me)).length;
			case "all": return open.length;
			default: return open.filter((t) => t.track_id === id).length;
		}
	};

	if (!board) return <MjengoLoader label="Loading to-dos" />;

	const track = board.tracks.find((t) => t.id === view) ?? null;
	const smart = SMART.find((s) => s.id === view) ?? null;
	const title = track?.name ?? smart?.label ?? "Tasks";
	const open = inView.filter((t) => t.status !== "done").sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
	const done = inView.filter((t) => t.status === "done");

	/** Anyone on the team can add a task: it lands in the open list, or in the first list when a smart view is open. */
	const addTask = async () => {
		const text = quick.trim();
		if (!text) return;
		setQuick("");
		try {
			let trackId = track?.id ?? board.tracks[0]?.id;
			if (!trackId) trackId = await createTrack("Tasks", "purple");
			await saveTodo(null, {
				trackId,
				title: text,
				assigneeIds: [board.me],
				dueDate: view === "myday" || view === "planned" ? today : undefined,
				important: view === "important" ? true : undefined,
			});
			await load();
		} catch (e) {
			setQuick(text);
			fail("Could not add the task", e);
		}
	};

	return (
		<div className="mx-auto flex max-w-6xl flex-col gap-4 lg:flex-row">
			{/* Lists */}
			<aside className="lg:w-60 lg:shrink-0">
				<nav aria-label="Lists" className="flex gap-1 overflow-x-auto pb-1 scrollbar-hide lg:flex-col lg:overflow-visible">
					{SMART.map((s) => (
						<ListButton key={s.id} active={view === s.id} onClick={() => setView(s.id)} count={count(s.id)} title={s.hint}>
							<s.icon className={cn("h-[18px] w-[18px]", s.id === "important" && view === s.id && "fill-current")} /> {s.label}
						</ListButton>
					))}
					<div className="mx-2 my-1 hidden h-px bg-serene-neutral-200 lg:block" />
					{board.tracks.map((t) => (
						<ListButton key={t.id} active={view === t.id} onClick={() => setView(t.id)} count={count(t.id)}>
							<span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", DOTS[t.color] ?? DOTS.purple)} /> <span className="truncate">{t.name}</span>
						</ListButton>
					))}
					{newList === null ? (
						<button onClick={() => setNewList("")} className="flex shrink-0 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-sauti-teal hover:bg-serene-neutral-100">
							<ListPlus className="h-[18px] w-[18px]" /> New list
						</button>
					) : (
						<form
							className="flex shrink-0 items-center gap-1 px-1"
							onSubmit={async (e) => {
								e.preventDefault();
								const n = newList.trim();
								if (!n) return setNewList(null);
								await run(async () => { const id = await createTrack(n, COLORS[board.tracks.length % COLORS.length]); setView(id); }, "Could not create the list");
								setNewList(null);
							}}
						>
							<Input autoFocus value={newList} onChange={(e) => setNewList(e.target.value)} onBlur={() => !newList.trim() && setNewList(null)} placeholder="List name" className="h-9" />
						</form>
					)}
				</nav>
			</aside>

			{/* Tasks */}
			<section className="min-w-0 flex-1">
				<header className="mb-3 flex items-start gap-2">
					<div className="min-w-0 flex-1">
						<h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-sauti-dark">{smart && <smart.icon className="h-6 w-6 text-sauti-teal" />}{title}</h2>
						<p className="text-sm text-serene-neutral-500">
							{view === "myday" ? format(new Date(), "EEEE, d MMMM") : track ? (track.created_by === board.me ? "Started by you" : track.created_by_name ? `Started by ${track.created_by_name}` : "") : smart?.hint}
						</p>
					</div>
					{track && (track.created_by === board.me || board.isSuper) && (
						<DropdownMenu>
							<DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="List options"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem onClick={() => { const n = window.prompt("Rename list", track.name); if (n?.trim()) run(() => renameTrack(track.id, n), "Could not rename"); }}><Pencil className="mr-2 h-4 w-4" /> Rename</DropdownMenuItem>
								<DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => window.confirm(`Delete "${track.name}" and its ${track.todos.length} tasks?`) && run(async () => { await deleteTrack(track.id); setView("myday"); }, "Could not delete")}><Trash2 className="mr-2 h-4 w-4" /> Delete list</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					)}
				</header>

				<div className="mb-3 flex flex-wrap items-center gap-2">
					<MemberFilter value={memberFilter} onChange={setMemberFilter} label="Anyone" />
					<TagFilter selected={tagFilter} onChange={setTagFilter} extra={all.flatMap((t) => t.tags ?? [])} className="min-w-0 flex-1" />
				</div>

				<form
					onSubmit={(e) => { e.preventDefault(); addTask(); }}
					className="mb-3 flex items-center gap-2 rounded-xl border border-serene-neutral-200 bg-white px-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)] focus-within:border-sauti-teal/50"
				>
					<Plus className="h-5 w-5 shrink-0 text-sauti-teal" />
					<input value={quick} onChange={(e) => setQuick(e.target.value)} placeholder="Add a task" aria-label="Add a task" className="h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-serene-neutral-400" />
					{quick.trim() && <Button type="submit" size="sm" className="bg-sauti-teal hover:bg-sauti-dark">Add</Button>}
				</form>

				{open.length === 0 && done.length === 0 ? (
					<div className="rounded-2xl border border-dashed border-serene-neutral-200 bg-white p-12 text-center">
						<span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sauti-teal-light text-sauti-teal">{smart ? <smart.icon className="h-6 w-6" /> : <CalendarCheck className="h-6 w-6" />}</span>
						<p className="text-sm font-medium text-sauti-dark">{view === "myday" ? "Nothing due for you today" : "Nothing here yet"}</p>
						<p className="mt-1 text-sm text-serene-neutral-500">Add a task above. Anyone on the team can add tasks and give them to each other.</p>
					</div>
				) : (
					<ul className="space-y-1.5">
						{open.map((t) => <TaskRow key={t.id} t={t} board={board} showList={!track} onOpen={() => setEditing(t)} run={run} />)}
					</ul>
				)}

				{done.length > 0 && (
					<div className="mt-4">
						<button onClick={() => setShowDone((v) => !v)} className="flex items-center gap-1.5 rounded-md px-2 py-1 text-sm font-semibold text-serene-neutral-600 hover:bg-serene-neutral-100">
							{showDone ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />} Completed <span className="text-serene-neutral-400">{done.length}</span>
						</button>
						{showDone && <ul className="mt-2 space-y-1.5">{done.map((t) => <TaskRow key={t.id} t={t} board={board} showList={!track} onOpen={() => setEditing(t)} run={run} />)}</ul>}
					</div>
				)}
			</section>

			<TodoSheet todo={editing} board={board} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} fail={fail} />
		</div>
	);
}

function tasksOf(board: Board): Task[] {
	return board.tracks.flatMap((t: TrackRow) => t.todos.map((x) => ({ ...x, trackName: t.name, trackColor: t.color })));
}

function ListButton({ active, onClick, count, children, title }: { active: boolean; onClick: () => void; count: number; children: React.ReactNode; title?: string }) {
	return (
		<button
			onClick={onClick}
			title={title}
			aria-current={active ? "page" : undefined}
			className={cn("flex shrink-0 touch-manipulation items-center gap-3 rounded-lg px-3 py-2 text-left text-sm transition-colors", active ? "bg-sauti-teal-light/70 font-semibold text-sauti-dark" : "font-medium text-serene-neutral-700 hover:bg-serene-neutral-100")}
		>
			<span className="flex min-w-0 flex-1 items-center gap-3">{children}</span>
			{count > 0 && <span className="text-xs text-serene-neutral-500">{count}</span>}
		</button>
	);
}

function TaskRow({ t, board, showList, onOpen, run }: { t: Task; board: Board; showList: boolean; onOpen: () => void; run: (fn: () => Promise<unknown>, e: string) => Promise<void> }) {
	const done = t.status === "done";
	const steps = t.steps ?? [];
	const stepsDone = steps.filter((s) => s.done).length;
	return (
		<li className="group flex items-center gap-3 rounded-xl border border-serene-neutral-200/70 bg-white px-3 py-2.5 shadow-[0_1px_2px_rgba(16,24,40,0.03)] transition-colors hover:bg-serene-neutral-50/60">
			<button
				onClick={() => run(() => saveTodo(t.id, { status: done ? "todo" : "done" }), "Could not update")}
				aria-label={done ? "Mark not done" : "Mark done"}
				className={cn("flex h-5 w-5 shrink-0 touch-manipulation items-center justify-center rounded-full border-2 transition-colors", done ? "border-sauti-teal bg-sauti-teal text-white" : "border-serene-neutral-300 hover:border-sauti-teal")}
			>
				{done && <Check className="h-3 w-3" />}
			</button>
			<button onClick={onOpen} className="min-w-0 flex-1 touch-manipulation text-left">
				<p className={cn("truncate text-sm text-serene-neutral-900", done && "text-serene-neutral-400 line-through")}>{t.title}</p>
				<div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-serene-neutral-500">
					{showList && <span className="flex items-center gap-1"><span className={cn("h-2 w-2 rounded-full", DOTS[t.trackColor] ?? DOTS.purple)} />{t.trackName}</span>}
					{t.due_date && <DeadlineChip date={t.due_date} done={done} />}
					{t.remind_on && <span className="flex items-center gap-1"><Bell className="h-3 w-3" />{format(parseISO(t.remind_on), "d MMM")}</span>}
					{steps.length > 0 && <span>{stepsDone} of {steps.length}</span>}
					{t.entity_label && t.entity_type && <Badge variant="secondary" className="max-w-[160px] truncate">{KIND_LABEL[t.entity_type]}: {t.entity_label}</Badge>}
					{(t.tags ?? []).slice(0, 3).map((x) => <span key={x} className="rounded-full bg-serene-neutral-100 px-2 py-0.5 text-[10px] text-serene-neutral-600">{tagLabel(x)}</span>)}
				</div>
			</button>
			<Avatars ids={t.assignee_ids} admins={board.admins} />
			<button
				onClick={() => run(() => saveTodo(t.id, { important: !t.important }), "Could not update")}
				aria-label={t.important ? "Remove importance" : "Mark important"}
				aria-pressed={t.important}
				className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md hover:bg-serene-neutral-100", t.important ? "text-sauti-teal" : "text-serene-neutral-300 group-hover:text-serene-neutral-500")}
			>
				<Star className={cn("h-[18px] w-[18px]", t.important && "fill-current")} />
			</button>
		</li>
	);
}

function TodoSheet({ todo, board, onClose, onSaved, fail }: { todo: Task | null; board: Board; onClose: () => void; onSaved: () => Promise<void>; fail: (t: string, e: unknown) => void }) {
	const [v, setV] = useState<Task | null>(todo);
	const [busy, setBusy] = useState(false);
	const [step, setStep] = useState("");
	useEffect(() => setV(todo), [todo]);

	const toggle = (id: string) => setV((x) => (x ? { ...x, assignee_ids: x.assignee_ids.includes(id) ? x.assignee_ids.filter((a) => a !== id) : [...x.assignee_ids, id] } : x));

	const save = async () => {
		if (!v) return;
		setBusy(true);
		try {
			await saveTodo(v.id, { title: v.title, notes: v.notes, dueDate: v.due_date, assigneeIds: v.assignee_ids, status: v.status, entityType: v.entity_type, entityId: v.entity_id, important: v.important, remindOn: v.remind_on, steps: v.steps });
			await onSaved();
		} catch (e) {
			fail("Could not save", e);
		} finally {
			setBusy(false);
		}
	};

	const quickDue = (days: number) => setV((x) => (x ? { ...x, due_date: iso(addDays(new Date(), days)) } : x));

	return (
		<Sheet open={!!todo} onOpenChange={(o) => !o && onClose()}>
			<SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
				<SheetHeader className="border-b p-4 pt-[max(1rem,env(safe-area-inset-top))]"><SheetTitle>Task</SheetTitle></SheetHeader>
				{v && (
					<div className="flex-1 space-y-5 p-4">
						<div className="flex items-start gap-2">
							<Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} className="h-11 text-base font-medium" aria-label="Task" />
							<button type="button" onClick={() => setV({ ...v, important: !v.important })} aria-pressed={v.important} aria-label="Important" className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border", v.important ? "border-sauti-teal text-sauti-teal" : "border-serene-neutral-200 text-serene-neutral-400")}>
								<Star className={cn("h-5 w-5", v.important && "fill-current")} />
							</button>
						</div>

						<div className="space-y-2">
							<Label className="text-xs font-semibold">Steps</Label>
							<ul className="space-y-1">
								{(v.steps ?? []).map((s) => (
									<li key={s.id} className="flex items-center gap-2">
										<button type="button" onClick={() => setV({ ...v, steps: v.steps.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)) })} aria-label={s.done ? "Not done" : "Done"} className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded-full border", s.done ? "border-sauti-teal bg-sauti-teal text-white" : "border-serene-neutral-300")}>{s.done && <Check className="h-3 w-3" />}</button>
										<span className={cn("flex-1 text-sm", s.done && "text-serene-neutral-400 line-through")}>{s.title}</span>
										<button type="button" onClick={() => setV({ ...v, steps: v.steps.filter((x) => x.id !== s.id) })} aria-label="Remove step" className="text-serene-neutral-400 hover:text-red-600"><X className="h-4 w-4" /></button>
									</li>
								))}
							</ul>
							<form onSubmit={(e) => { e.preventDefault(); if (!step.trim()) return; setV({ ...v, steps: [...(v.steps ?? []), { id: Math.random().toString(36).slice(2, 10), title: step.trim(), done: false }] }); setStep(""); }}>
								<Input value={step} onChange={(e) => setStep(e.target.value)} placeholder="Add a step" className="h-9" />
							</form>
						</div>

						<div className="space-y-1.5">
							<Label className="text-xs font-semibold">Due</Label>
							<div className="flex flex-wrap gap-1.5">
								<Button type="button" size="sm" variant="outline" onClick={() => quickDue(0)}>Today</Button>
								<Button type="button" size="sm" variant="outline" onClick={() => quickDue(1)}>Tomorrow</Button>
								<Button type="button" size="sm" variant="outline" onClick={() => quickDue(7)}>Next week</Button>
								{v.due_date && <Button type="button" size="sm" variant="ghost" onClick={() => setV({ ...v, due_date: null })}>Clear</Button>}
							</div>
							<Input type="date" value={v.due_date ?? ""} onChange={(e) => setV({ ...v, due_date: e.target.value || null })} />
						</div>

						<div className="space-y-1.5">
							<Label className="flex items-center gap-1.5 text-xs font-semibold"><Bell className="h-3.5 w-3.5" /> Remind me on</Label>
							<Input type="date" value={v.remind_on ?? ""} onChange={(e) => setV({ ...v, remind_on: e.target.value || null })} />
							<p className="text-xs text-serene-neutral-500">Due tasks are always reminded the morning before, the day itself and the day after.</p>
							{v.id && <div className="pt-1"><p className="mb-1 text-xs font-semibold">More reminders before it is due</p><EntityReminders type="todo" id={v.id} /></div>}
						</div>

						<div className="space-y-1.5">
							<Label className="text-xs font-semibold">Status</Label>
							<Select value={v.status} onValueChange={(s) => setV({ ...v, status: s as TodoRow["status"] })}>
								<SelectTrigger><SelectValue /></SelectTrigger>
								<SelectContent><SelectItem value="todo">To do</SelectItem><SelectItem value="doing">In progress</SelectItem><SelectItem value="done">Done</SelectItem></SelectContent>
							</Select>
						</div>

						<div className="space-y-1.5">
							<Label className="text-xs font-semibold">Assigned to (pick one or more)</Label>
							<div className="flex flex-wrap gap-2">
								{board.admins.map((a) => {
									const on = v.assignee_ids.includes(a.id);
									return (
										<button key={a.id} type="button" onClick={() => toggle(a.id)} aria-pressed={on} className={cn("flex touch-manipulation items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors", on ? "border-sauti-teal bg-sauti-teal-light/40 text-sauti-dark" : "border-serene-neutral-200 text-serene-neutral-700 hover:bg-serene-neutral-50")}>
											{on && <Check className="h-3.5 w-3.5" />} {a.name}{a.id === board.me ? " (you)" : ""}
										</button>
									);
								})}
							</div>
						</div>

						<div className="space-y-1.5">
							<Label className="text-xs font-semibold">Linked to</Label>
							<Select value={v.entity_id ? `${v.entity_type}:${v.entity_id}` : "none"} onValueChange={(s) => { if (s === "none") setV({ ...v, entity_type: null, entity_id: null }); else { const [k, id] = s.split(":"); setV({ ...v, entity_type: k as TodoRow["entity_type"], entity_id: id }); } }}>
								<SelectTrigger><SelectValue placeholder="Nothing" /></SelectTrigger>
								<SelectContent className="max-h-72">
									<SelectItem value="none">Nothing</SelectItem>
									{board.links.map((l) => <SelectItem key={`${l.kind}:${l.id}`} value={`${l.kind}:${l.id}`}>{KIND_LABEL[l.kind]}: {l.label}</SelectItem>)}
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-1.5"><Label className="text-xs font-semibold">Notes</Label><Textarea rows={4} value={v.notes ?? ""} onChange={(e) => setV({ ...v, notes: e.target.value })} /></div>
						{v.id && (
							<div className="space-y-1.5"><Label className="text-xs font-semibold">Tags</Label><TagEditor type="todo" id={v.id} tags={v.tags ?? []} onChange={(t) => setV((x) => (x ? { ...x, tags: t } : x))} /></div>
						)}
						{v.id && <SimilarItems type="todo" id={v.id} />}
					</div>
				)}
				<div className="sticky bottom-0 flex items-center gap-2 border-t bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
					{v && <Button variant="ghost" className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={async () => { if (window.confirm("Delete this task?")) { try { await deleteTodo(v.id); await onSaved(); } catch (e) { fail("Could not delete", e); } } }}><Trash2 className="h-4 w-4" /> Delete</Button>}
					<div className="flex-1" />
					<Button variant="ghost" onClick={onClose}>Cancel</Button>
					<Button onClick={save} disabled={busy || !v?.title.trim()} className="gap-1.5 bg-sauti-teal hover:bg-sauti-dark">{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
				</div>
			</SheetContent>
		</Sheet>
	);
}
