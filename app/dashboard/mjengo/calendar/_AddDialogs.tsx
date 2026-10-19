"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { BellRing, CheckSquare, Clock, Flag, Loader2, Megaphone, Video, CalendarDays } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { addCalendarTodo, deadlineTargets, setRecordDeadline, type DeadlineTarget } from "@/app/actions/mjengo-calendar-add";
import { savePost } from "@/app/actions/mjengo-content";
import { CHANNELS, CHANNEL_INFO, type Channel } from "@/lib/mjengo/channels";

export type AddKind = "meeting" | "event" | "reminder" | "block" | "todo" | "content" | "deadline";
export interface Slot { date: Date; from?: string; to?: string }

const TILES: { kind: AddKind; label: string; hint: string; icon: typeof Video; tone: string }[] = [
	{ kind: "meeting", label: "Meeting", hint: "A video call with guests and a link", icon: Video, tone: "bg-sky-100 text-sky-700" },
	{ kind: "event", label: "Event", hint: "Something on a day, with or without guests", icon: CalendarDays, tone: "bg-sauti-teal-light text-sauti-teal" },
	{ kind: "reminder", label: "Reminder", hint: "A nudge at a time, just for you", icon: BellRing, tone: "bg-violet-100 text-violet-700" },
	{ kind: "block", label: "Blocked time", hint: "Keep time free, shown as busy", icon: Clock, tone: "bg-serene-neutral-200 text-serene-neutral-700" },
	{ kind: "todo", label: "To-do", hint: "A task with a due date", icon: CheckSquare, tone: "bg-emerald-100 text-emerald-700" },
	{ kind: "content", label: "Content", hint: "Schedule a post to your channels", icon: Megaphone, tone: "bg-rose-100 text-rose-700" },
	{ kind: "deadline", label: "Deadline", hint: "On a grant, opportunity or project", icon: Flag, tone: "bg-amber-100 text-amber-800" },
];

/** What to add to the calendar: anything that depends on a date or a time. */
export function AddChooser({ slot, onClose, onPick }: { slot: Slot | null; onClose: () => void; onPick: (k: AddKind) => void }) {
	return (
		<Dialog open={!!slot} onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-lg">
				<DialogHeader>
					<DialogTitle>Add to {slot ? format(slot.date, "EEEE d MMMM") : "the calendar"}{slot?.from ? `, ${slot.from}` : ""}</DialogTitle>
					<DialogDescription>What would you like to put on the calendar? It shows up here once it is saved.</DialogDescription>
				</DialogHeader>
				<div className="grid gap-2 sm:grid-cols-2">
					{TILES.map((t) => (
						<button key={t.kind} type="button" onClick={() => onPick(t.kind)} className="flex items-center gap-3 rounded-xl border border-serene-neutral-200 bg-white p-3 text-left transition hover:border-sauti-teal/50 hover:shadow-sm">
							<span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", t.tone)}><t.icon className="h-5 w-5" /></span>
							<span className="min-w-0"><span className="block text-sm font-semibold text-serene-neutral-900">{t.label}</span><span className="block text-xs text-serene-neutral-500">{t.hint}</span></span>
						</button>
					))}
				</div>
			</DialogContent>
		</Dialog>
	);
}

const dayStr = (d: Date) => format(d, "yyyy-MM-dd");

/** A task due on a day. */
export function TodoDialog({ slot, onClose, onDone }: { slot: Slot | null; onClose: () => void; onDone: () => Promise<void> }) {
	const { toast } = useToast();
	const [title, setTitle] = useState("");
	const [date, setDate] = useState("");
	const [notes, setNotes] = useState("");
	const [busy, setBusy] = useState(false);
	useEffect(() => { if (slot) { setTitle(""); setNotes(""); setDate(dayStr(slot.date)); } }, [slot]);
	const save = async () => {
		setBusy(true);
		try { await unwrap(addCalendarTodo({ title, date, notes })); toast({ title: "To-do added", description: "It is on your list and on the calendar." }); await onDone(); } catch (e) { toast({ title: "Could not add the to-do", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setBusy(false); }
	};
	return (
		<Dialog open={!!slot} onOpenChange={(o) => !o && !busy && onClose()}>
			<DialogContent className="max-w-md">
				<DialogHeader><DialogTitle>New to-do</DialogTitle><DialogDescription>It is assigned to you and appears on the day it is due.</DialogDescription></DialogHeader>
				<div className="space-y-3">
					<Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="What needs doing?" autoFocus aria-label="Task" />
					<div className="flex items-center gap-2"><span className="text-sm text-serene-neutral-600">Due</span><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-44" aria-label="Due date" /></div>
					<Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes (optional)" />
				</div>
				<DialogFooter>
					<Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
					<Button className="gap-2 bg-sauti-teal hover:bg-sauti-dark" disabled={busy || !title.trim() || !date} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Add</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/** A post scheduled for a day and time on the chosen channels. */
export function PostDialog({ slot, onClose, onDone }: { slot: Slot | null; onClose: () => void; onDone: () => Promise<void> }) {
	const { toast } = useToast();
	const [body, setBody] = useState("");
	const [channels, setChannels] = useState<Channel[]>(["linkedin"]);
	const [date, setDate] = useState("");
	const [time, setTime] = useState("09:00");
	const [busy, setBusy] = useState(false);
	useEffect(() => { if (slot) { setBody(""); setChannels(["linkedin"]); setDate(dayStr(slot.date)); setTime(slot.from ?? "09:00"); } }, [slot]);
	const save = async () => {
		setBusy(true);
		try {
			await unwrap(savePost(null, { body, channels, scheduledFor: new Date(`${date}T${time}:00`).toISOString() }));
			toast({ title: "Post scheduled", description: "It will go out at that time." });
			await onDone();
		} catch (e) { toast({ title: "Could not schedule the post", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setBusy(false); }
	};
	return (
		<Dialog open={!!slot} onOpenChange={(o) => !o && !busy && onClose()}>
			<DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
				<DialogHeader><DialogTitle>Schedule a post</DialogTitle><DialogDescription>Write it here, or <Link href="/dashboard/mjengo/design#schedule" className="font-medium text-sauti-teal underline">open the content studio</Link> for pictures and one wording per network.</DialogDescription></DialogHeader>
				<div className="space-y-3">
					<Textarea rows={5} value={body} onChange={(e) => setBody(e.target.value)} placeholder="What do you want to say?" autoFocus aria-label="Post" />
					<div className="flex flex-wrap gap-1.5">
						{CHANNELS.map((c) => {
							const on = channels.includes(c);
							return <button key={c} type="button" aria-pressed={on} onClick={() => setChannels((cur) => (on ? cur.filter((x) => x !== c) : [...cur, c]))} className={cn("rounded-full border px-3 py-1 text-xs font-medium", on ? "border-sauti-teal bg-sauti-teal-light text-sauti-teal" : "border-serene-neutral-200 text-serene-neutral-600 hover:bg-serene-neutral-50")}>{CHANNEL_INFO[c].label}</button>;
						})}
					</div>
					{channels.some((c) => CHANNEL_INFO[c].needsImage) && <p className="text-xs text-amber-700">Instagram and TikTok need a picture, which you can add in the content studio.</p>}
					<div className="flex flex-wrap items-center gap-2"><Clock className="h-4 w-4 text-serene-neutral-500" /><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-40" aria-label="Date" /><Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-9 w-28" aria-label="Time" /></div>
				</div>
				<DialogFooter>
					<Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
					<Button className="gap-2 bg-sauti-teal hover:bg-sauti-dark" disabled={busy || !body.trim() || !channels.length || !date} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Schedule</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

const KIND_LABEL = { grant: "Grant", opportunity: "Opportunity", project: "Project" } as const;

/** Put a deadline on a grant, an opportunity or a project. */
export function DeadlineDialog({ slot, onClose, onDone }: { slot: Slot | null; onClose: () => void; onDone: () => Promise<void> }) {
	const { toast } = useToast();
	const [targets, setTargets] = useState<DeadlineTarget[] | null>(null);
	const [q, setQ] = useState("");
	const [chosen, setChosen] = useState<DeadlineTarget | null>(null);
	const [date, setDate] = useState("");
	const [busy, setBusy] = useState(false);
	useEffect(() => {
		if (!slot) return;
		setQ(""); setChosen(null); setDate(dayStr(slot.date)); setTargets(null);
		unwrap(deadlineTargets()).then(setTargets).catch(() => setTargets([]));
	}, [slot]);
	const shown = (targets ?? []).filter((t) => !q.trim() || t.title.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 30);
	const save = async () => {
		if (!chosen) return;
		setBusy(true);
		try { await unwrap(setRecordDeadline(chosen.kind, chosen.id, date)); toast({ title: "Deadline set", description: `${chosen.title} is due ${format(new Date(`${date}T12:00:00`), "d MMMM")}.` }); await onDone(); } catch (e) { toast({ title: "Could not set the deadline", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setBusy(false); }
	};
	return (
		<Dialog open={!!slot} onOpenChange={(o) => !o && !busy && onClose()}>
			<DialogContent className="max-w-md">
				<DialogHeader><DialogTitle>Set a deadline</DialogTitle><DialogDescription>Choose the grant, opportunity or project and the day it is due.</DialogDescription></DialogHeader>
				<div className="space-y-3">
					<Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by name" aria-label="Search" />
					<ul className="max-h-56 space-y-1 overflow-y-auto">
						{targets === null && <li className="flex items-center gap-2 p-2 text-sm text-serene-neutral-500"><Loader2 className="h-4 w-4 animate-spin" /> Loading</li>}
						{targets && shown.length === 0 && <li className="p-2 text-sm text-serene-neutral-500">Nothing matches.</li>}
						{shown.map((t) => (
							<li key={`${t.kind}${t.id}`}>
								<button type="button" onClick={() => { setChosen(t); if (t.current) setDate(t.current); }} className={cn("flex w-full items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm", chosen?.id === t.id ? "border-sauti-teal bg-sauti-teal-light/50" : "border-transparent hover:bg-serene-neutral-50")}>
									<span className="min-w-0 flex-1 truncate font-medium">{t.title}</span>
									<span className="shrink-0 text-xs text-serene-neutral-500">{KIND_LABEL[t.kind]}{t.current ? `, now ${format(new Date(`${t.current}T12:00:00`), "d MMM")}` : ""}</span>
								</button>
							</li>
						))}
					</ul>
					<div className="flex items-center gap-2"><span className="text-sm text-serene-neutral-600">Due</span><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-44" aria-label="Deadline" /></div>
				</div>
				<DialogFooter>
					<Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
					<Button className="gap-2 bg-sauti-teal hover:bg-sauti-dark" disabled={busy || !chosen || !date} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Set deadline</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
