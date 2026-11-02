"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, isToday, startOfMonth, startOfWeek } from "date-fns";
import { CalendarClock, ChevronLeft, ChevronRight, Clock, Loader2, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { myCalendar, type MyCalItem } from "@/app/actions/my-calendar";
import { useIsMobile } from "@/hooks/use-mobile";

const timeOf = (iso: string) => format(new Date(iso), "h:mm a").replace(":00", "");

const chipFor = (i: MyCalItem) =>
	i.kind === "block"
		? "bg-serene-neutral-200 text-serene-neutral-700"
		: i.status === "confirmed"
			? "bg-sauti-teal text-white"
			: i.status === "completed"
				? "bg-serene-neutral-100 text-serene-neutral-600"
				: "bg-amber-100 text-amber-900";

const statusText = (i: MyCalItem) =>
	i.kind === "block" ? "Blocked time" : i.status === "confirmed" ? "Confirmed" : i.status === "completed" ? "Done" : "Waiting to be confirmed";

/** Your own calendar: sessions and blocked time, as a month you can step through, with the chosen day listed beside it. */
export default function MyCalendarPage() {
	const mobile = useIsMobile();
	const [cursor, setCursor] = useState(() => new Date());
	const [mode, setMode] = useState<"month" | "week">("month");
	const [selected, setSelected] = useState(() => new Date());
	const [items, setItems] = useState<MyCalItem[] | null>(null);
	const [error, setError] = useState(false);

	const range = useMemo(() => {
		const from = mode === "month" ? startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }) : startOfWeek(cursor, { weekStartsOn: 1 });
		const to = mode === "month" ? endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }) : endOfWeek(cursor, { weekStartsOn: 1 });
		return { from, to, days: eachDayOfInterval({ start: from, end: to }) };
	}, [cursor, mode]);

	const load = useCallback(async () => {
		setError(false);
		try {
			setItems(await unwrap(myCalendar(range.from.toISOString(), addDays(range.to, 1).toISOString())));
		} catch {
			setError(true);
			setItems([]);
		}
	}, [range]);
	useEffect(() => { void load(); }, [load]);

	const onDay = (d: Date) => (items ?? []).filter((i) => isSameDay(new Date(i.start), d));
	const step = (dir: 1 | -1) => setCursor((c) => (mode === "month" ? addMonths(c, dir) : addWeeks(c, dir)));
	const upcoming = (items ?? []).filter((i) => i.kind === "appointment" && +new Date(i.end) >= Date.now()).slice(0, 4);
	const dayItems = onDay(selected);

	return (
		<div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
			<div className="flex flex-wrap items-center gap-2">
				<h1 className="mr-auto text-xl font-bold text-sauti-dark">Calendar</h1>
				<Button variant="outline" size="sm" onClick={() => { setCursor(new Date()); setSelected(new Date()); }}>Today</Button>
				<div className="flex items-center">
					<Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Previous" onClick={() => step(-1)}><ChevronLeft className="h-4 w-4" /></Button>
					<Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Next" onClick={() => step(1)}><ChevronRight className="h-4 w-4" /></Button>
				</div>
				<p className="min-w-[8.5rem] text-sm font-semibold text-serene-neutral-900" aria-live="polite">{mode === "month" ? format(cursor, "MMMM yyyy") : `${format(range.from, "d MMM")} – ${format(range.to, "d MMM")}`}</p>
				<div role="group" aria-label="View" className="inline-flex rounded-lg border border-serene-neutral-200 bg-white p-0.5">
					{(["month", "week"] as const).map((m) => (
						<Button key={m} size="sm" variant={mode === m ? "secondary" : "ghost"} className="h-8 capitalize" aria-pressed={mode === m} onClick={() => setMode(m)}>{m}</Button>
					))}
				</div>
				<Button asChild variant="ghost" size="icon" className="h-8 w-8" aria-label="Calendar settings" title="Calendar settings">
					<Link href="/dashboard/profile?section=calendar"><Settings className="h-4 w-4" /></Link>
				</Button>
			</div>

			<div className="grid items-start gap-4 lg:grid-cols-[1fr_320px]">
				<section aria-label="Calendar" className="overflow-hidden rounded-2xl border border-serene-neutral-200/70 bg-white">
					<div className="grid grid-cols-7 border-b border-serene-neutral-100 text-center text-xs font-semibold text-serene-neutral-500">
						{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-2">{d}</div>)}
					</div>
					<div className="grid grid-cols-7">
						{range.days.map((d) => {
							const list = onDay(d);
							const out = mode === "month" && !isSameMonth(d, cursor);
							const sel = isSameDay(d, selected);
							return (
								<button
									key={d.toISOString()}
									type="button"
									onClick={() => setSelected(d)}
									aria-pressed={sel}
									aria-label={`${format(d, "EEEE d MMMM")}, ${list.length} item${list.length === 1 ? "" : "s"}`}
									className={cn("flex min-h-[4.5rem] flex-col items-stretch gap-1 border-b border-r border-serene-neutral-100 p-1.5 text-left transition-colors hover:bg-serene-neutral-50", mode === "week" && "min-h-[11rem]", out && "bg-serene-neutral-50/60 text-serene-neutral-400", sel && "ring-2 ring-inset ring-sauti-teal")}
								>
									<span className={cn("flex h-6 w-6 items-center justify-center self-start rounded-full text-xs font-medium", isToday(d) ? "bg-sauti-teal text-white" : "text-serene-neutral-700")}>{format(d, "d")}</span>
									{mobile ? (
										list.length > 0 && <span className="flex gap-0.5">{list.slice(0, 3).map((i) => <span key={i.id} className={cn("h-1.5 w-1.5 rounded-full", i.kind === "block" ? "bg-serene-neutral-400" : i.status === "confirmed" ? "bg-sauti-teal" : "bg-amber-500")} />)}</span>
									) : (
										<>
											{list.slice(0, mode === "week" ? 6 : 2).map((i) => (
												<span key={i.id} className={cn("truncate rounded px-1.5 py-0.5 text-[11px] font-medium", chipFor(i))}>{timeOf(i.start)} {i.title}</span>
											))}
											{list.length > (mode === "week" ? 6 : 2) && <span className="px-1 text-[11px] text-serene-neutral-500">+{list.length - (mode === "week" ? 6 : 2)} more</span>}
										</>
									)}
								</button>
							);
						})}
					</div>
					{items === null && <div className="flex items-center justify-center gap-2 border-t border-serene-neutral-100 py-3 text-xs text-serene-neutral-500"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading</div>}
				</section>

				<aside className="space-y-4">
					<section className="rounded-2xl border border-serene-neutral-200/70 bg-white p-4">
						<h2 className="text-sm font-semibold text-serene-neutral-900">{isToday(selected) ? "Today" : format(selected, "EEEE d MMMM")}</h2>
						{error && <p className="mt-2 text-sm text-red-700">Could not load your calendar. <button type="button" className="font-medium underline" onClick={() => void load()}>Try again</button></p>}
						{!error && dayItems.length === 0 && <p className="mt-2 text-sm text-serene-neutral-600">{items === null ? "Loading…" : "Nothing planned this day."}</p>}
						<ul className="mt-2 space-y-2">
							{dayItems.map((i) => {
								const body = (
									<>
										<span className="flex items-center gap-1.5 text-xs text-serene-neutral-600"><Clock className="h-3 w-3" aria-hidden />{timeOf(i.start)} – {timeOf(i.end)}</span>
										<span className="mt-0.5 block text-sm font-semibold text-serene-neutral-900">{i.title}{i.detail ? <span className="font-normal text-serene-neutral-600"> · {i.detail}</span> : null}</span>
										<span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium", chipFor(i))}>{statusText(i)}</span>
									</>
								);
								return <li key={i.id}>{i.href ? <Link href={i.href} className="block rounded-xl border border-serene-neutral-100 p-3 hover:bg-serene-neutral-50">{body}</Link> : <div className="rounded-xl border border-serene-neutral-100 p-3">{body}</div>}</li>;
							})}
						</ul>
					</section>

					{upcoming.length > 0 && (
						<section className="rounded-2xl border border-serene-neutral-200/70 bg-white p-4">
							<h2 className="flex items-center gap-1.5 text-sm font-semibold text-serene-neutral-900"><CalendarClock className="h-4 w-4 text-sauti-teal" aria-hidden /> Coming up</h2>
							<ul className="mt-2 space-y-1.5">
								{upcoming.map((i) => (
									<li key={i.id}><button type="button" className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1 text-left text-sm hover:bg-serene-neutral-50" onClick={() => { setSelected(new Date(i.start)); setCursor(new Date(i.start)); }}>
										<span className="truncate text-serene-neutral-900">{i.title}</span>
										<span className="shrink-0 text-xs text-serene-neutral-600">{format(new Date(i.start), "EEE d MMM")}, {timeOf(i.start)}</span>
									</button></li>
								))}
							</ul>
						</section>
					)}

					<p className="px-1 text-xs text-serene-neutral-600">Sync with Google Calendar, block time off, or share a booking link in <Link href="/dashboard/profile?section=calendar" className="font-medium text-sauti-teal underline">calendar settings</Link>.</p>
				</aside>
			</div>
		</div>
	);
}
