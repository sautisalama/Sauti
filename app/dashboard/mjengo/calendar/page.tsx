"use client";

import { RecipientField } from "../mail/_components/RecipientField";
import { ReminderList } from "@/components/mjengo/ReminderList";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import Link from "next/link";
import { addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek } from "date-fns";
import { BellRing, CalendarDays, CalendarPlus, Plus, ChevronLeft, ChevronRight, Clock, ExternalLink, Eye, FileText, Flag, GraduationCap, Loader2, MapPin, Megaphone, PenLine, Phone, Plane, Presentation, Settings, Sparkles, Target, Trash2, UserRound, Users, Utensils, Video, Wallet, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { calendarMonth, createCalendarEvent, eventIcons, removeCalendarEvent, type CalItem, type CalKind, type CalMonth } from "@/app/actions/mjengo-calendar";
import { MjengoLoader } from "../_components/MjengoLoader";
import { holidayOn } from "@/lib/mjengo/holidays-ke";
import { Markdown } from "../_components/Markdown";
import { meetingDetail, type MeetingDetail } from "@/app/actions/mjengo-meet";

const KIND: Record<CalKind, { label: string; chip: string; dot: string }> = {
	event: { label: "Event", chip: "bg-sauti-teal text-white", dot: "bg-sauti-teal" },
	meeting: { label: "Meeting", chip: "bg-sky-600 text-white", dot: "bg-sky-600" },
	block: { label: "Blocked time", chip: "bg-serene-neutral-200 text-serene-neutral-700", dot: "bg-serene-neutral-400" },
	google: { label: "Google Calendar", chip: "bg-[#e8f0fe] text-[#1a4fa3]", dot: "bg-[#4285F4]" },
	grant: { label: "Grant deadline", chip: "bg-amber-100 text-amber-900", dot: "bg-amber-500" },
	opportunity: { label: "Opportunity deadline", chip: "bg-orange-100 text-orange-900", dot: "bg-orange-500" },
	project: { label: "Project", chip: "bg-violet-100 text-violet-900", dot: "bg-violet-500" },
	todo: { label: "Task due", chip: "bg-emerald-100 text-emerald-900", dot: "bg-emerald-500" },
	post: { label: "Post", chip: "bg-rose-100 text-rose-900", dot: "bg-rose-500" },
};

const timeOf = (iso: string) => format(new Date(iso), "h:mm a").replace(":00", "");
const pad = (d: Date, t: string) => `${format(d, "yyyy-MM-dd")}T${t}`;

export default function CalendarPage() {
	const { toast } = useToast();
	const [cursor, setCursor] = useState(() => new Date());
	const month = useMemo(() => startOfMonth(cursor), [cursor]);
	const setMonth = (f: Date | ((m: Date) => Date)) => setCursor((c) => startOfMonth(typeof f === "function" ? f(startOfMonth(c)) : f));
	const [mode, setModeState] = useState<"month" | "week" | "day">("month");
	useEffect(() => { try { const m = localStorage.getItem("ss_cal_mode"); if (m === "month" || m === "week" || m === "day") setModeState(m); } catch { /* default */ } }, []);
	const setMode = (m: "month" | "week" | "day") => { setModeState(m); try { localStorage.setItem("ss_cal_mode", m); } catch { /* ignore */ } };
	/** Previous or next: a month, a week or a day, whichever is showing. */
	const step = (dir: 1 | -1) => setCursor((c) => (mode === "month" ? addMonths(c, dir) : mode === "week" ? addWeeks(c, dir) : addDays(c, dir)));
	const weekDays = useMemo(() => { const st = startOfWeek(cursor, { weekStartsOn: 1 }); return Array.from({ length: 7 }, (_, i) => addDays(st, i)); }, [cursor]);
	const [data, setData] = useState<CalMonth | null>(null);
	const [create, setCreate] = useState<{ date: Date; from?: string; to?: string } | null>(null);
	const [dayOpen, setDayOpen] = useState<Date | null>(null);
	const mobile = useIsMobile();
	const [smart, setSmart] = useState(true);
	const [icons, setIcons] = useState<Record<string, string>>({});
	useEffect(() => {
		try {
			setSmart(localStorage.getItem("ss_cal_smart") !== "0");
			setIcons(JSON.parse(localStorage.getItem("ss_cal_icons") ?? "{}"));
		} catch { /* defaults */ }
	}, []);
	const toggleSmart = (v: boolean) => { setSmart(v); try { localStorage.setItem("ss_cal_smart", v ? "1" : "0"); } catch { /* ignore */ } };
	const [view, setView] = useState<CalItem | null>(null);
	// On a phone the month is a compact grid with the chosen day listed underneath, like Google Calendar.
	useEffect(() => {
		if (!mobile) return;
		setDayOpen((cur) => (cur && isSameMonth(cur, month) ? cur : isSameMonth(new Date(), month) ? new Date() : month));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [mobile, month]);
	const [hidden, setHidden] = useState<Set<CalKind>>(new Set());

	const gridStart = useMemo(() => startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), [month]);
	const gridEnd = useMemo(() => endOfWeek(endOfMonth(month), { weekStartsOn: 1 }), [month]);
	const days = useMemo(() => eachDayOfInterval({ start: gridStart, end: gridEnd }), [gridStart, gridEnd]);

	const load = useCallback(async () => {
		try {
			setData(await unwrap(calendarMonth(gridStart.toISOString(), addDays(gridEnd, 1).toISOString())));
		} catch (e) {
			setData({ items: [], googleConnected: false, googleConfigured: false, googleError: null });
			toast({ title: "Could not load the calendar", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		}
	}, [gridStart, gridEnd, toast]);
	useEffect(() => { setData((d) => d && { ...d }); load(); }, [load]);

	// Ask the AI which icon fits each activity, once per title.
	useEffect(() => {
		if (!smart || !data) return;
		const missing = [...new Set(data.items.filter((i) => !i.allDay).map((i) => i.title))].filter((t) => !icons[t]).slice(0, 40);
		if (!missing.length) return;
		let on = true;
		unwrap(eventIcons(missing)).then((r) => {
			if (!on || !Object.keys(r).length) return;
			setIcons((cur) => { const n = { ...cur, ...r }; try { localStorage.setItem("ss_cal_icons", JSON.stringify(n)); } catch { /* ignore */ } return n; });
		}).catch(() => undefined);
		return () => { on = false; };
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [data, smart]);

	const items = (data?.items ?? []).filter((i) => !hidden.has(i.kind));
	const onDay = (d: Date) => items.filter((i) => {
		const s = new Date(i.start);
		const e = new Date(i.end);
		if (i.allDay) return d >= new Date(s.getFullYear(), s.getMonth(), s.getDate()) && d <= new Date(e.getFullYear(), e.getMonth(), e.getDate() - (e > s && e.getHours() === 0 && e.getMinutes() === 0 ? 1 : 0));
		return isSameDay(s, d);
	}).sort((a, b) => Number(b.allDay) - Number(a.allDay) || a.start.localeCompare(b.start));
	const upcoming = (data?.items ?? []).filter((i) => !hidden.has(i.kind) && new Date(i.end) >= new Date()).sort((a, b) => a.start.localeCompare(b.start)).slice(0, 8);

	return (
		<div className="mx-auto max-w-[1400px] space-y-3">
			<div className="flex min-h-9 flex-nowrap items-center gap-1">
				<h2 className="min-w-0 truncate pr-1 text-base font-semibold text-sauti-dark sm:text-lg">
					{mode === "month" ? format(month, mobile ? "MMMM" : "MMMM yyyy") : mode === "week" ? `${format(weekDays[0], "d MMM")} to ${format(weekDays[6], "d MMM yyyy")}` : format(cursor, mobile ? "EEE d MMM" : "EEEE d MMMM yyyy")}
					{mobile && mode === "month" && <span className="ml-1 font-normal text-serene-neutral-500">{format(month, "yyyy")}</span>}
				</h2>
				<Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Previous" onClick={() => step(-1)}><ChevronLeft className="h-4 w-4" /></Button>
				<Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Next" onClick={() => step(1)}><ChevronRight className="h-4 w-4" /></Button>
				{!data && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-serene-neutral-400" />}
				<span className="flex-1" />
				<div className="mr-1 inline-flex shrink-0 rounded-lg border border-serene-neutral-200 bg-white p-0.5" role="tablist" aria-label="Calendar view">
					{([["month", "Month"], ["week", "Week"], ["day", "Day"]] as const).map(([m, l]) => (
						<button key={m} role="tab" aria-selected={mode === m} onClick={() => setMode(m)} className={cn("rounded-md px-2.5 py-1 text-xs font-semibold", mode === m ? "bg-sauti-teal text-white" : "text-serene-neutral-600 hover:bg-serene-neutral-50")}>{l}</button>
					))}
				</div>
				<Button variant="outline" size="sm" className="h-8 shrink-0 px-3 text-xs" onClick={() => { setCursor(new Date()); if (mobile) setDayOpen(new Date()); }}>Today</Button>
				<Button asChild variant="ghost" size="icon" className="hidden h-8 w-8 shrink-0 sm:inline-flex" aria-label="Schedule content" title="Schedule content"><Link href="/dashboard/mjengo/design#schedule"><Megaphone className="h-4 w-4" /></Link></Button>
				<Button asChild variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label="Calendar settings" title="Calendar settings"><Link href="/dashboard/profile?section=calendar"><Settings className="h-4 w-4" /></Link></Button>
				<Button size="sm" className="hidden h-8 shrink-0 gap-1.5 bg-sauti-teal px-3 text-xs hover:bg-sauti-dark sm:inline-flex" onClick={() => setCreate({ date: dayOpen ?? new Date() })}><CalendarPlus className="h-3.5 w-3.5" /> Create</Button>
			</div>

			{data && !data.googleConnected && data.googleConfigured && (
				<p className="rounded-xl bg-[#e8f0fe] px-4 py-2.5 text-sm text-[#1a4fa3]">
					Google Calendar is not connected, so only events made here appear. <Link href="/dashboard/profile?section=calendar" className="font-semibold underline">Connect it in calendar settings</Link>.
				</p>
			)}
			{data?.googleError && <p className="rounded-xl bg-amber-50 px-4 py-2.5 text-sm text-amber-900">{data.googleError}</p>}

			<div className="grid gap-4 lg:grid-cols-[1fr_280px]">
				{mode === "week" && (
					<div className="overflow-hidden rounded-2xl border border-serene-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
						<div className="grid grid-cols-1 divide-y divide-serene-neutral-100 sm:grid-cols-7 sm:divide-x sm:divide-y-0">
							{weekDays.map((d) => {
								const list = onDay(d);
								const hol = holidayOn(d);
								return (
									<div key={d.toISOString()} className={cn("min-h-[120px] p-2 sm:min-h-[420px]", hol && "bg-amber-50/60")}>
										<button onClick={() => { setCursor(d); setMode("day"); }} className="mb-2 flex w-full items-center gap-2 text-left sm:flex-col sm:items-center sm:gap-0.5">
											<span className="text-[11px] font-semibold uppercase tracking-wider text-serene-neutral-500">{format(d, "EEE")}</span>
											<span className={cn("flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold", isToday(d) ? "bg-sauti-teal text-white" : "text-serene-neutral-800")}>{format(d, "d")}</span>
											{hol && <span className="truncate text-[10px] font-medium text-amber-700">{hol}</span>}
										</button>
										<div className="space-y-1">
											{list.map((i) => (
												<button key={i.id} onClick={() => setView(i)} className={cn("flex w-full items-start gap-1 rounded-lg px-1.5 py-1 text-left text-[11px] font-medium leading-tight", KIND[i.kind].chip)}>
													{i.kind === "post" && <Megaphone className="mt-0.5 h-3 w-3 shrink-0" />}
													<span className="min-w-0"><span className="block truncate">{i.title}</span>{!i.allDay && <span className="block opacity-80">{timeOf(i.start)}</span>}</span>
												</button>
											))}
											{list.length === 0 && <p className="hidden text-center text-[11px] text-serene-neutral-300 sm:block">Free</p>}
										</div>
									</div>
								);
							})}
						</div>
					</div>
				)}
				{mode === "day" && (
					<div>
						{holidayOn(cursor) && <p className="mb-2 rounded-xl bg-amber-50 px-3 py-2 text-sm font-medium text-amber-800">{holidayOn(cursor)}: a public holiday in Kenya</p>}
						<DayPanel
							day={cursor}
							items={onDay(cursor).filter((i) => i.kind !== "post")}
							posts={onDay(cursor).filter((i) => i.kind === "post")}
							icons={icons}
							smart={smart}
							onClose={() => setMode("month")}
							onSlot={(from, to) => setCreate({ date: cursor, from, to })}
							onOpen={setView}
						/>
					</div>
				)}
				<div className={cn("overflow-hidden rounded-2xl border border-serene-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]", mode !== "month" && "hidden")}>
					<div className="grid grid-cols-7 border-b border-serene-neutral-100 text-center text-[11px] font-semibold uppercase tracking-wider text-serene-neutral-500">
						{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-1.5 sm:py-2">{mobile ? d[0] : d}</div>)}
					</div>
					<div className={cn("grid grid-cols-7", mobile ? "auto-rows-[52px]" : days.length > 35 ? "auto-rows-[minmax(112px,1fr)]" : "auto-rows-[minmax(124px,1fr)]")}>
						{days.map((d) => {
							const list = onDay(d);
							return (
								<div
									key={d.toISOString()}
									onClick={() => setDayOpen(d)}
									className={cn("cursor-pointer border-serene-neutral-100 p-1 transition hover:bg-serene-neutral-50/70", mobile ? "border-t" : "border-b border-r", !isSameMonth(d, month) && !mobile && "bg-serene-neutral-50/50", holidayOn(d) && isSameMonth(d, month) && "bg-amber-50/60")}
								>
									<div className="mb-0.5 flex items-center justify-center gap-1">
										{!mobile && list.some((i) => i.kind === "post") && <Megaphone className="h-3 w-3 text-rose-500" aria-label="Content scheduled" />}
										<span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs", isToday(d) ? "bg-sauti-teal font-bold text-white" : mobile && dayOpen && isSameDay(d, dayOpen) ? "bg-sauti-teal-light font-bold text-sauti-teal ring-1 ring-sauti-teal" : isSameMonth(d, month) ? "text-serene-neutral-800" : "text-serene-neutral-300")}>{format(d, "d")}</span>
									</div>
									{holidayOn(d) && !mobile && <p className="mb-0.5 truncate px-1 text-center text-[10px] font-medium text-amber-700" title={holidayOn(d) ?? ""}>{holidayOn(d)}</p>}
									{mobile ? (
										<div className="flex justify-center gap-0.5">
											{holidayOn(d) && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />}
											{list.slice(0, 3).map((i) => <span key={i.id} className={cn("h-1.5 w-1.5 rounded-full", KIND[i.kind].dot)} />)}
										</div>
									) : (
									<div className="space-y-0.5">
										{list.slice(0, 3).map((i) => (
											<button key={i.id} onClick={(e) => { e.stopPropagation(); setView(i); }} className={cn("flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium", i.allDay || i.kind === "event" || i.kind === "meeting" ? KIND[i.kind].chip : "text-serene-neutral-800 hover:bg-serene-neutral-100")}>
												{!(i.allDay || i.kind === "event" || i.kind === "meeting") && <span className={cn("h-2 w-2 shrink-0 rounded-full", KIND[i.kind].dot)} />}
												{!i.allDay && <span className="shrink-0 opacity-80">{timeOf(i.start)}</span>}
												<span className="truncate">{i.title}</span>
											</button>
										))}
										{list.length > 3 && <button onClick={(e) => { e.stopPropagation(); setCreate(null); setView(list[3]); }} className="px-1.5 text-[11px] font-medium text-serene-neutral-500 hover:underline">+{list.length - 3} more</button>}
									</div>
									)}
								</div>
							);
						})}
					</div>
				</div>

				<aside className="space-y-4">
					{dayOpen && mode === "month" && (
						<DayPanel
							day={dayOpen}
							items={onDay(dayOpen).filter((i) => i.kind !== "post")}
							posts={onDay(dayOpen).filter((i) => i.kind === "post")}
							icons={icons}
							smart={smart}
							onClose={() => setDayOpen(null)}
							onSlot={(from, to) => setCreate({ date: dayOpen, from, to })}
							onOpen={setView}
						/>
					)}
					<section className="rounded-2xl border border-serene-neutral-200/70 bg-white p-3">
						<h3 className="mb-2 text-sm font-semibold text-sauti-dark">Calendars</h3>
						<label className="mb-2 flex cursor-pointer items-center gap-2 rounded-lg bg-serene-neutral-50 px-2 py-1.5 text-sm">
							<input type="checkbox" checked={smart} onChange={(e) => toggleSmart(e.target.checked)} className="h-4 w-4 accent-[#068297]" />
							<Sparkles className="h-3.5 w-3.5 text-sauti-teal" /> Smart icons for activities
						</label>
						<ul className="space-y-1">
							{(Object.keys(KIND) as CalKind[]).map((k) => (
								<li key={k}>
									<button onClick={() => setHidden((h) => { const n = new Set(h); if (n.has(k)) n.delete(k); else n.add(k); return n; })} className="flex w-full items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-serene-neutral-50">
										<span className={cn("flex h-4 w-4 items-center justify-center rounded border", hidden.has(k) ? "border-serene-neutral-300" : cn("border-transparent", KIND[k].dot))}>{!hidden.has(k) && <span className="text-[10px] text-white">✓</span>}</span>
										<span className={cn(hidden.has(k) && "text-serene-neutral-400")}>{KIND[k].label}</span>
									</button>
								</li>
							))}
						</ul>
					</section>
					<section className="rounded-2xl border border-serene-neutral-200/70 bg-white p-3">
						<h3 className="mb-2 text-sm font-semibold text-sauti-dark">Coming up</h3>
						{upcoming.length === 0 ? <p className="text-sm text-serene-neutral-500">Nothing coming up.</p> : (
							<ul className="space-y-2">
								{upcoming.map((i) => (
									<li key={i.id}>
										<button onClick={() => setView(i)} className="flex w-full items-start gap-2 text-left">
											<span className={cn("mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full", KIND[i.kind].dot)} />
											<span className="min-w-0"><span className="block truncate text-sm font-medium text-serene-neutral-900">{i.title}</span><span className="block text-xs text-serene-neutral-500">{format(new Date(i.start), "EEE d MMM")}{i.allDay ? "" : `, ${timeOf(i.start)}`}</span></span>
										</button>
									</li>
								))}
							</ul>
						)}
					</section>
				</aside>
			</div>

			{!data && <MjengoLoader compact label="Loading the calendar" />}

			{mobile && (
				<button onClick={() => setCreate({ date: dayOpen ?? new Date() })} aria-label="Create event" className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-2xl bg-sauti-teal text-white shadow-lg active:scale-95">
					<Plus className="h-6 w-6" />
				</button>
			)}

			<CreateDialog slot={create} onClose={() => setCreate(null)} onCreated={async () => { setCreate(null); await load(); }} />
			<ViewDialog item={view} onClose={() => setView(null)} onRemoved={async () => { setView(null); await load(); }} />
		</div>
	);
}

function CreateDialog({ slot, onClose, onCreated }: { slot: { date: Date; from?: string; to?: string } | null; onClose: () => void; onCreated: () => Promise<void> }) {
	const day = slot?.date ?? null;
	const { toast } = useToast();
	const [title, setTitle] = useState("");
	const [date, setDate] = useState("");
	const [from, setFrom] = useState("09:00");
	const [to, setTo] = useState("10:00");
	const [allDay, setAllDay] = useState(false);
	const [video, setVideo] = useState(true);
	const [block, setBlock] = useState(false);
	const [guests, setGuests] = useState("");
	const [place, setPlace] = useState("");
	const [notes, setNotes] = useState("");
	const [reminders, setReminders] = useState<number[]>([10]);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		if (!day) return;
		setTitle(""); setDate(format(day, "yyyy-MM-dd")); setFrom(slot?.from ?? "09:00"); setTo(slot?.to ?? "10:00"); setAllDay(false); setVideo(true); setBlock(false); setGuests(""); setPlace(""); setNotes(""); setReminders([10]);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [slot]);

	const save = async () => {
		setBusy(true);
		try {
			const start = allDay ? `${date}T00:00:00` : pad(new Date(date), `${from}:00`);
			const end = allDay ? `${date}T23:59:00` : pad(new Date(date), `${to}:00`);
			await unwrap(createCalendarEvent({
				title,
				start: new Date(start).toISOString(),
				end: new Date(end).toISOString(),
				allDay,
				description: notes || null,
				location: place || null,
				attendees: guests.split(/[,;\s]+/).filter(Boolean),
				videoCall: video && !block,
				block,
				reminders: block ? [] : reminders,
			}));
			toast({ title: "Event created" });
			await onCreated();
		} catch (e) {
			toast({ title: "Could not create the event", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setBusy(false);
		}
	};

	return (
		<Dialog open={!!day} onOpenChange={(o) => !o && !busy && onClose()}>
			<DialogContent className="max-h-[92vh] max-w-lg overflow-y-auto">
				<DialogHeader>
					<DialogTitle className="sr-only">New event</DialogTitle>
					<DialogDescription className="sr-only">Create an event or meeting</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add title" autoFocus className="h-12 border-0 border-b border-serene-neutral-200 px-0 text-xl shadow-none focus-visible:ring-0" aria-label="Title" />
					<div className="flex flex-wrap items-center gap-2">
						<Clock className="h-4 w-4 text-serene-neutral-500" />
						<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-40" aria-label="Date" />
						{!allDay && (
							<>
								<Input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-28" aria-label="Starts" />
								<span className="text-serene-neutral-400">to</span>
								<Input type="time" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-28" aria-label="Ends" />
							</>
						)}
						<label className="ml-auto flex items-center gap-2 text-sm"><Switch checked={allDay} onCheckedChange={setAllDay} /> All day</label>
					</div>
					<div className="flex items-center gap-2">
						<Clock className="h-4 w-4 text-serene-neutral-500" />
						<label className="flex flex-1 items-center justify-between text-sm">Block this time (shows as busy, no guests) <Switch checked={block} onCheckedChange={setBlock} /></label>
					</div>
					{!block && <div className="flex items-center gap-2">
						<Video className="h-4 w-4 text-serene-neutral-500" />
						<label className="flex flex-1 items-center justify-between text-sm">Add a video call with a shareable link <Switch checked={video} onCheckedChange={setVideo} /></label>
					</div>}
					{!block && <div className="flex items-start gap-2">
						<Users className="mt-2 h-4 w-4 text-serene-neutral-500" />
						<div className="flex-1 space-y-1">
							<div className="min-h-10 rounded-md border border-serene-neutral-200 bg-white px-2"><RecipientField value={guests} onChange={setGuests} placeholder="Add guests by name or email" /></div>
							<p className="text-xs text-serene-neutral-500">Guests are invited by Google Calendar when it is connected.</p>
						</div>
					</div>}
					{!block && (
						<div className="flex items-start gap-2">
							<BellRing className="mt-2 h-4 w-4 shrink-0 text-serene-neutral-500" />
							<ReminderList value={reminders} onChange={setReminders} emptyHint="No reminders" />
						</div>
					)}
					<div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-serene-neutral-500" /><Input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="Add location" aria-label="Location" /></div>
					<div className="space-y-1.5"><Label className="sr-only">Description</Label><Textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add description" /></div>
				</div>
				<DialogFooter>
					<Button variant="ghost" onClick={onClose} disabled={busy}>Cancel</Button>
					<Button className="gap-2 bg-sauti-teal hover:bg-sauti-dark" disabled={busy || !title.trim() || !date} onClick={save}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Save</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function ViewDialog({ item, onClose, onRemoved }: { item: CalItem | null; onClose: () => void; onRemoved: () => Promise<void> }) {
	const { toast } = useToast();
	const [busy, setBusy] = useState(false);
	const [call, setCall] = useState<MeetingDetail | null>(null);
	// A meeting that has been held shows what was written down from it.
	useEffect(() => {
		setCall(null);
		if (!item?.meetingCode) return;
		let on = true;
		unwrap(meetingDetail(item.meetingCode)).then((d) => on && setCall(d)).catch(() => undefined);
		return () => { on = false; };
	}, [item?.meetingCode]);
	if (!item) return null;
	const k = KIND[item.kind];
	return (
		<Dialog open onOpenChange={(o) => !o && onClose()}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-start gap-3"><span className={cn("mt-1.5 h-3 w-3 shrink-0 rounded-sm", k.dot)} /><span>{item.title}</span></DialogTitle>
					<DialogDescription>
						{format(new Date(item.start), "EEEE d MMMM yyyy")}{item.allDay ? ", all day" : `, ${timeOf(item.start)} to ${timeOf(item.end)}`}
					</DialogDescription>
				</DialogHeader>
				<div className="space-y-3 text-sm">
					<p className="text-xs font-semibold uppercase tracking-wide text-serene-neutral-500">{k.label}</p>
					{item.location && <p className="flex items-center gap-2"><MapPin className="h-4 w-4 text-serene-neutral-500" />{item.location}</p>}
					{item.attendees && item.attendees.length > 0 && <p className="flex items-start gap-2"><Users className="mt-0.5 h-4 w-4 shrink-0 text-serene-neutral-500" /><span className="break-all">{item.attendees.join(", ")}</span></p>}
					{item.description && <p className="whitespace-pre-wrap text-serene-neutral-700">{item.description}</p>}
					{call && (call.notes || call.transcript.length > 0) && (
						<div className="space-y-2 rounded-xl border border-serene-neutral-200 bg-serene-neutral-50 p-3">
							<p className="text-xs font-semibold uppercase tracking-wide text-serene-neutral-500">From the call</p>
							{call.notes ? <div className="text-sm leading-6"><Markdown text={call.notes} /></div> : <p className="text-sm text-serene-neutral-600">There is a transcript of {call.transcript.length} lines. Notes are written a few minutes after the call goes quiet.</p>}
							<Link href={`/dashboard/mjengo/meetings?code=${call.code}`} className="text-xs font-medium text-sauti-teal hover:underline">Open the full transcript</Link>
						</div>
					)}
				</div>
				<DialogFooter className="gap-2 sm:justify-between">
					{item.removable ? (
						<Button variant="ghost" className="text-red-600" disabled={busy} onClick={async () => { if (!window.confirm("Delete this event?")) return; setBusy(true); try { await unwrap(removeCalendarEvent(item.id)); await onRemoved(); } catch (e) { toast({ title: "Could not delete", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setBusy(false); } }}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button>
					) : <span />}
					<div className="flex gap-2">
						{item.href && (item.href.startsWith("/") ? <Button asChild variant="outline"><Link href={item.href}>Open</Link></Button> : <Button asChild variant="outline"><a href={item.href} target="_blank" rel="noopener noreferrer" className="gap-2"><ExternalLink className="h-4 w-4" /> Open in Google</a></Button>)}
						{item.meetingCode && <Button className="gap-2 bg-sauti-teal hover:bg-sauti-dark" onClick={() => { window.location.assign(`/meet/${item.meetingCode}`); }}><Video className="h-4 w-4" /> Join</Button>}
						<Button variant="ghost" size="icon" aria-label="Close" onClick={onClose}><X className="h-4 w-4" /></Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
const HOUR_H = 56;

const ICONS: Record<string, typeof Clock> = {
	meeting: Users, call: Phone, travel: Plane, deadline: Flag, writing: PenLine, review: Eye, workshop: Presentation,
	lunch: Utensils, training: GraduationCap, interview: UserRound, report: FileText, social: Megaphone, finance: Wallet, focus: Target, event: CalendarDays, other: Clock,
};

/** Without the AI (or offline) a few keywords still give a sensible icon. */
function guessIcon(title: string): string {
	const t = title.toLowerCase();
	const rules: [RegExp, string][] = [
		[/\b(call|phone|zoom|teams|meet link)\b/, "call"], [/\b(meeting|sync|stand-?up|catch ?up|check-?in|board)\b/, "meeting"],
		[/\b(flight|travel|trip|drive|train|airport)\b/, "travel"], [/\b(deadline|due|submit|submission|closing)\b/, "deadline"],
		[/\b(write|draft|proposal|concept note|edit)\b/, "writing"], [/\b(review|feedback|audit|evaluation)\b/, "review"],
		[/\b(workshop|webinar|conference|panel|session)\b/, "workshop"], [/\b(lunch|breakfast|dinner|coffee)\b/, "lunch"],
		[/\b(training|course|class|learning)\b/, "training"], [/\b(interview|candidate)\b/, "interview"],
		[/\b(report|donor report|narrative)\b/, "report"], [/\b(post|campaign|social|content)\b/, "social"],
		[/\b(budget|finance|invoice|payment|payroll)\b/, "finance"], [/\b(focus|deep work|plan)\b/, "focus"],
	];
	for (const [re, k] of rules) if (re.test(t)) return k;
	return "other";
}

function layout(list: CalItem[]) {
	const sorted = [...list].sort((a, b) => a.start.localeCompare(b.start));
	const cols: { end: number }[] = [];
	return sorted.map((i) => {
		const s = new Date(i.start).getTime();
		const e = Math.max(new Date(i.end).getTime(), s + 30 * 60_000);
		let c = cols.findIndex((x) => x.end <= s);
		if (c === -1) { c = cols.length; cols.push({ end: e }); } else cols[c].end = e;
		return { item: i, col: c, s, e };
	}).map((x, _, all) => {
		const overlapping = all.filter((y) => y.s < x.e && y.e > x.s);
		return { ...x, of: Math.max(...overlapping.map((y) => y.col)) + 1 };
	});
}

/** One day like Google's day view: a time rail, a line at the current time, and blocks for what is booked. */
function DayPanel({ day, items, posts, icons, smart, onClose, onSlot, onOpen }: {
	day: Date; items: CalItem[]; posts: CalItem[]; icons: Record<string, string>; smart: boolean;
	onClose: () => void; onSlot: (from: string, to: string) => void; onOpen: (i: CalItem) => void;
}) {
	const scroller = useRef<HTMLDivElement>(null);
	const [now, setNow] = useState(() => new Date());
	useEffect(() => { const t = setInterval(() => setNow(new Date()), 60_000); return () => clearInterval(t); }, []);
	useEffect(() => {
		const mins = isToday(day) ? now.getHours() * 60 + now.getMinutes() : 8 * 60;
		scroller.current?.scrollTo({ top: Math.max(0, (mins / 60) * HOUR_H - 120) });
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [day]);

	const allDay = items.filter((i) => i.allDay);
	const timed = layout(items.filter((i) => !i.allDay && i.kind !== "post"));
	const nowTop = ((now.getHours() * 60 + now.getMinutes()) / 60) * HOUR_H;

	return (
		<section className="overflow-hidden rounded-2xl border border-serene-neutral-200/70 bg-white" aria-label={format(day, "EEEE d MMMM")}>
			<header className="flex items-center gap-2 border-b border-serene-neutral-100 px-3 py-2">
				<div className="min-w-0 flex-1">
					<p className="text-xs font-semibold uppercase tracking-wider text-serene-neutral-500">{format(day, "EEEE")}</p>
					<p className="text-lg font-semibold text-sauti-dark">{format(day, "d MMMM")}</p>
				</div>
				<Button variant="ghost" size="icon" aria-label="Close day" onClick={onClose}><X className="h-4 w-4" /></Button>
			</header>

			{allDay.length > 0 && (
				<ul className="space-y-1 border-b border-serene-neutral-100 p-2">
					{allDay.map((i) => (
						<li key={i.id}><button onClick={() => onOpen(i)} className={cn("w-full truncate rounded px-2 py-1 text-left text-xs font-medium", KIND[i.kind].chip)}>{i.title}</button></li>
					))}
				</ul>
			)}

			<div ref={scroller} className="relative max-h-[560px] overflow-y-auto">
				<div className="relative" style={{ height: HOUR_H * 24 }}>
					{Array.from({ length: 24 }).map((_, h) => (
						<div key={h} className="absolute inset-x-0 border-t border-serene-neutral-100" style={{ top: h * HOUR_H, height: HOUR_H }}>
							<span className="absolute -top-2 left-1 bg-white px-0.5 text-[10px] text-serene-neutral-400">{h === 0 ? "" : format(new Date(2000, 0, 1, h), "h a")}</span>
						</div>
					))}
					{/* Click an empty hour to book it. */}
					<div
						className="absolute inset-y-0 left-12 right-0 cursor-pointer"
						onClick={(e) => {
							const r = e.currentTarget.getBoundingClientRect();
							const mins = Math.floor(((e.clientY - r.top) / HOUR_H) * 60 / 30) * 30;
							const f = `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
							const t = mins + 60;
							onSlot(f, `${String(Math.min(23, Math.floor(t / 60))).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`);
						}}
					/>
					{timed.map(({ item, col, of, s, e }) => {
						const d = new Date(s);
						const top = ((d.getHours() * 60 + d.getMinutes()) / 60) * HOUR_H;
						const height = Math.max(26, ((e - s) / 3_600_000) * HOUR_H - 2);
						const Icon = ICONS[smart ? icons[item.title] ?? guessIcon(item.title) : "event"] ?? Clock;
						return (
							<button
								key={item.id}
								onClick={(ev) => { ev.stopPropagation(); onOpen(item); }}
								className={cn("absolute overflow-hidden rounded-lg border border-white px-1.5 py-1 text-left text-xs leading-tight shadow-sm", KIND[item.kind].chip)}
								style={{ top, height, left: `calc(3rem + (100% - 3.25rem) * ${col / of})`, width: `calc((100% - 3.25rem) / ${of} - 2px)` }}
							>
								<span className="flex items-center gap-1 font-semibold">{smart && <Icon className="h-3 w-3 shrink-0" />}<span className="truncate">{item.title}</span></span>
								{height > 40 && <span className="block opacity-80">{timeOf(item.start)} to {timeOf(item.end)}</span>}
							</button>
						);
					})}
					{isToday(day) && (
						<div className="pointer-events-none absolute inset-x-0 z-10 flex items-center" style={{ top: nowTop }}>
							<span className="ml-9 h-2.5 w-2.5 -translate-y-px rounded-full bg-red-500" />
							<span className="h-px flex-1 bg-red-500" />
						</div>
					)}
				</div>
			</div>

			{posts.length > 0 && (
				<div className="border-t border-serene-neutral-100 p-3">
					<h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-serene-neutral-500"><Megaphone className="h-3.5 w-3.5" /> Content scheduled</h4>
					<ul className="space-y-1">
						{posts.map((p) => (
							<li key={p.id}><button onClick={() => onOpen(p)} className="flex w-full items-center gap-2 rounded-lg bg-rose-50 px-2 py-1.5 text-left text-xs text-rose-900"><span className="font-semibold">{timeOf(p.start)}</span><span className="truncate">{p.title.replace(/^Post: /, "")}</span></button></li>
						))}
					</ul>
				</div>
			)}
		</section>
	);
}
