"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, ListPlus, Loader2, MoreVertical, Pencil, Plus, Trash2, UserCheck } from "lucide-react";
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

type Board = Awaited<ReturnType<typeof getTodoBoard>>;
const DOTS: Record<string, string> = { purple: "bg-sauti-teal", blue: "bg-sky-500", green: "bg-emerald-500", amber: "bg-amber-500", rose: "bg-rose-500" };
const COLORS = Object.keys(DOTS);

export default function TodosPage() {
	const { toast } = useToast();
	const [board, setBoard] = useState<Board | null>(null);
	const [filter, setFilter] = useState<"all" | "mine">("all");
	const [editing, setEditing] = useState<TodoRow | null>(null);
	const [newTrack, setNewTrack] = useState("");
	const [adding, setAdding] = useState(false);

	const load = useCallback(async () => setBoard(await getTodoBoard()), []);
	useEffect(() => {
		load().catch(() => toast({ title: "Could not load to-dos", variant: "destructive" }));
	}, [load, toast]);

	const fail = (title: string, e: unknown) => toast({ title, description: e instanceof Error ? e.message : undefined, variant: "destructive" });
	const run = async (fn: () => Promise<unknown>, errTitle: string) => {
		try {
			await fn();
			await load();
		} catch (e) {
			fail(errTitle, e);
		}
	};

	const tracks = useMemo(() => {
		if (!board) return [];
		return board.tracks.map((t) => (filter === "mine" ? { ...t, todos: t.todos.filter((x) => x.assignee_ids.includes(board.me)) } : t)).filter((t) => filter === "all" || t.todos.length > 0);
	}, [board, filter]);

	if (!board) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-serene-neutral-400" /></div>;

	const myOpen = board.tracks.flatMap((t) => t.todos).filter((x) => x.status !== "done" && x.assignee_ids.includes(board.me)).length;

	return (
		<div className="space-y-5">
			<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<h2 className="text-xl font-bold tracking-tight text-sauti-dark">To-dos</h2>
					<p className="text-sm text-serene-neutral-500">Everyone on the team can see every track. Give a task to one or more people to share the responsibility.</p>
				</div>
				<div className="inline-flex shrink-0 rounded-lg border border-serene-neutral-200 bg-white p-0.5">
					<button onClick={() => setFilter("all")} aria-pressed={filter === "all"} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold", filter === "all" ? "bg-sauti-teal text-white" : "text-serene-neutral-600")}>Everyone</button>
					<button onClick={() => setFilter("mine")} aria-pressed={filter === "mine"} className={cn("flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold", filter === "mine" ? "bg-sauti-teal text-white" : "text-serene-neutral-600")}>
						<UserCheck className="h-3.5 w-3.5" /> Mine{myOpen > 0 && <span className="rounded-full bg-white/25 px-1.5">{myOpen}</span>}
					</button>
				</div>
			</div>

			<form
				className="flex gap-2"
				onSubmit={async (e) => {
					e.preventDefault();
					if (!newTrack.trim()) return;
					setAdding(true);
					await run(() => createTrack(newTrack, COLORS[board.tracks.length % COLORS.length]), "Could not create the track");
					setNewTrack("");
					setAdding(false);
				}}
			>
				<Input value={newTrack} onChange={(e) => setNewTrack(e.target.value)} placeholder="Start a new track, e.g. Q4 grant applications" className="max-w-md" />
				<Button type="submit" disabled={adding || !newTrack.trim()} className="gap-1.5 bg-sauti-teal hover:bg-sauti-dark"><ListPlus className="h-4 w-4" /> New track</Button>
			</form>

			{tracks.length === 0 ? (
				<div className="rounded-2xl border border-dashed border-serene-neutral-200 bg-white p-12 text-center text-sm text-serene-neutral-500">
					{filter === "mine" ? "Nothing is assigned to you." : "No tracks yet. Start one above."}
				</div>
			) : (
				<div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
					{tracks.map((t) => (
						<TrackCard key={t.id} t={t} board={board} onEdit={setEditing} run={run} />
					))}
				</div>
			)}

			<TodoSheet todo={editing} board={board} onClose={() => setEditing(null)} onSaved={async () => { setEditing(null); await load(); }} fail={fail} />
		</div>
	);
}

function TrackCard({ t, board, onEdit, run }: { t: TrackRow; board: Board; onEdit: (t: TodoRow) => void; run: (fn: () => Promise<unknown>, e: string) => Promise<void> }) {
	const [title, setTitle] = useState("");
	const canManage = t.created_by === board.me || board.isSuper;
	const open = t.todos.filter((x) => x.status !== "done");
	const done = t.todos.filter((x) => x.status === "done");

	return (
		<section className="flex flex-col rounded-2xl border border-serene-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
			<header className="flex items-center gap-2 border-b border-serene-neutral-50 p-3">
				<span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", DOTS[t.color] ?? DOTS.purple)} />
				<div className="min-w-0 flex-1">
					<h3 className="truncate text-sm font-bold text-sauti-dark">{t.name}</h3>
					<p className="truncate text-xs text-serene-neutral-500">{t.created_by === board.me ? "Started by you" : t.created_by_name ? `Started by ${t.created_by_name}` : ""} · {open.length} open</p>
				</div>
				{canManage && (
					<DropdownMenu>
						<DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Track options"><MoreVertical className="h-4 w-4" /></Button></DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => { const n = window.prompt("Rename track", t.name); if (n?.trim()) run(() => renameTrack(t.id, n), "Could not rename"); }}><Pencil className="mr-2 h-4 w-4" /> Rename</DropdownMenuItem>
							<DropdownMenuItem className="text-red-600 focus:text-red-600" onClick={() => window.confirm(`Delete "${t.name}" and its ${t.todos.length} tasks?`) && run(() => deleteTrack(t.id), "Could not delete")}><Trash2 className="mr-2 h-4 w-4" /> Delete track</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				)}
			</header>

			<ul className="divide-y divide-serene-neutral-50">
				{[...open, ...done].map((x) => (
					<li key={x.id} className="flex items-start gap-3 p-3">
						<button
							onClick={() => run(() => saveTodo(x.id, { status: x.status === "done" ? "todo" : "done" }), "Could not update")}
							aria-label={x.status === "done" ? "Mark not done" : "Mark done"}
							className={cn("mt-0.5 flex h-5 w-5 shrink-0 touch-manipulation items-center justify-center rounded-md border-2 transition-colors", x.status === "done" ? "border-emerald-500 bg-emerald-500 text-white" : "border-serene-neutral-300 hover:border-sauti-teal")}
						>
							{x.status === "done" && <Check className="h-3.5 w-3.5" />}
						</button>
						<button onClick={() => onEdit(x)} className="min-w-0 flex-1 touch-manipulation text-left">
							<p className={cn("text-sm text-serene-neutral-900", x.status === "done" && "text-serene-neutral-400 line-through")}>{x.title}</p>
							<div className="mt-1.5 flex flex-wrap items-center gap-2">
								<DeadlineChip date={x.due_date} done={x.status === "done"} />
								{x.status === "doing" && <Badge className="bg-sky-100 text-sky-800 hover:bg-sky-100">In progress</Badge>}
								{x.entity_label && x.entity_type && <Badge variant="secondary" className="max-w-[160px] truncate">{KIND_LABEL[x.entity_type]}: {x.entity_label}</Badge>}
								<Avatars ids={x.assignee_ids} admins={board.admins} />
							</div>
						</button>
					</li>
				))}
				{t.todos.length === 0 && <li className="p-4 text-center text-xs text-serene-neutral-400">No tasks yet</li>}
			</ul>

			<form
				className="flex gap-2 border-t border-serene-neutral-50 p-2"
				onSubmit={async (e) => {
					e.preventDefault();
					if (!title.trim()) return;
					const v = title;
					setTitle("");
					await run(() => saveTodo(null, { trackId: t.id, title: v, assigneeIds: [board.me] }), "Could not add the task");
				}}
			>
				<Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a task" className="h-9 border-0 bg-serene-neutral-50" />
				<Button type="submit" size="icon" variant="ghost" className="h-9 w-9 shrink-0" disabled={!title.trim()} aria-label="Add task"><Plus className="h-4 w-4" /></Button>
			</form>
		</section>
	);
}

function TodoSheet({ todo, board, onClose, onSaved, fail }: { todo: TodoRow | null; board: Board; onClose: () => void; onSaved: () => Promise<void>; fail: (t: string, e: unknown) => void }) {
	const [v, setV] = useState<TodoRow | null>(todo);
	const [busy, setBusy] = useState(false);
	useEffect(() => setV(todo), [todo]);

	const toggle = (id: string) => setV((x) => (x ? { ...x, assignee_ids: x.assignee_ids.includes(id) ? x.assignee_ids.filter((a) => a !== id) : [...x.assignee_ids, id] } : x));

	const save = async () => {
		if (!v) return;
		setBusy(true);
		try {
			await saveTodo(v.id, { title: v.title, notes: v.notes, dueDate: v.due_date, assigneeIds: v.assignee_ids, status: v.status, entityType: v.entity_type, entityId: v.entity_id });
			await onSaved();
		} catch (e) {
			fail("Could not save", e);
		} finally {
			setBusy(false);
		}
	};

	return (
		<Sheet open={!!todo} onOpenChange={(o) => !o && onClose()}>
			<SheetContent className="flex w-full flex-col gap-0 overflow-y-auto p-0 sm:max-w-md">
				<SheetHeader className="border-b p-4 pt-[max(1rem,env(safe-area-inset-top))]"><SheetTitle>Task</SheetTitle></SheetHeader>
				{v && (
					<div className="flex-1 space-y-4 p-4">
						<div className="space-y-1.5"><Label className="text-xs font-semibold">What needs doing</Label><Input value={v.title} onChange={(e) => setV({ ...v, title: e.target.value })} /></div>
						<div className="grid grid-cols-2 gap-3">
							<div className="space-y-1.5">
								<Label className="text-xs font-semibold">Status</Label>
								<Select value={v.status} onValueChange={(s) => setV({ ...v, status: s as TodoRow["status"] })}>
									<SelectTrigger><SelectValue /></SelectTrigger>
									<SelectContent><SelectItem value="todo">To do</SelectItem><SelectItem value="doing">In progress</SelectItem><SelectItem value="done">Done</SelectItem></SelectContent>
								</Select>
							</div>
							<div className="space-y-1.5"><Label className="text-xs font-semibold">Due</Label><Input type="date" value={v.due_date ?? ""} onChange={(e) => setV({ ...v, due_date: e.target.value || null })} /></div>
						</div>
						<div className="space-y-1.5">
							<Label className="text-xs font-semibold">Responsible (pick one or more)</Label>
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
