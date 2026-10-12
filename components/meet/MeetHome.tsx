"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDays, endOfDay, format, isSameDay, startOfDay, startOfWeek } from "date-fns";
import { CalendarClock, CalendarDays, ChevronLeft, ChevronRight, Clapperboard, History, Keyboard, Link2, NotebookText, Video, Zap } from "lucide-react";
import { unwrap } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { holidayOn } from "@/lib/mjengo/holidays-ke";
import { listMeetings, meetHome, type MeetHomeItem, type MeetingRow } from "@/app/actions/mjengo-meet";
import { MeetChooser } from "@/app/dashboard/mjengo/_components/MeetChooser";

const CODE = /[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}/i;

/** The Meet home: join with a code, start a meeting now, later or on the calendar, and see the day's meetings. */
export function MeetHome({ isAdmin }: { isAdmin: boolean }) {
	const [day, setDay] = useState(() => startOfDay(new Date()));
	const [items, setItems] = useState<MeetHomeItem[] | null>(null);
	const [code, setCode] = useState("");
	const [past, setPast] = useState<MeetingRow[] | null>(null);
	const [chooser, setChooser] = useState<{ initial?: "now" | "later" | "calendar" } | null>(null);
	const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(day, { weekStartsOn: 1 }), i)), [day]);
	const found = CODE.exec(code)?.[0]?.toLowerCase() ?? null;
	const today = isSameDay(day, new Date());

	useEffect(() => {
		if (!isAdmin) return;
		unwrap(listMeetings()).then(setPast).catch(() => setPast([]));
	}, [isAdmin]);

	useEffect(() => {
		if (!isAdmin) return;
		let on = true;
		setItems(null);
		unwrap(meetHome(startOfDay(day).toISOString(), endOfDay(day).toISOString())).then((r) => on && setItems(r)).catch(() => on && setItems([]));
		return () => { on = false; };
	}, [day, isAdmin]);

	const join = () => { if (found) window.location.assign(`/meet/${found}`); };

	return (
		<div className="mx-auto max-w-6xl space-y-6">
			<section className="relative overflow-hidden rounded-2xl border border-serene-blue-100 bg-gradient-to-br from-serene-blue-50 via-white to-sauti-teal-light/40 p-6 sm:p-8">
				<h1 className="text-2xl font-bold tracking-tight text-sauti-dark sm:text-3xl">Meet <span className="text-sauti-teal">Rooms</span></h1>
				<p className="mt-1 max-w-xl text-sm text-serene-neutral-600">Calls that stay inside Sauti Salama. Start one, plan one, or join with a code. Call notes are kept for you afterwards.</p>
				<form onSubmit={(e) => { e.preventDefault(); join(); }} className="mt-5 flex max-w-xl items-center gap-2 rounded-2xl border border-serene-neutral-200 bg-white p-1.5 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
					<Keyboard className="ml-2 h-5 w-5 shrink-0 text-serene-neutral-400" />
					<input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter a code or paste a link" aria-label="Meeting code or link" className="h-10 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-serene-neutral-400" />
					<button type="submit" disabled={!found} className="h-10 rounded-xl bg-sauti-teal px-5 text-sm font-semibold text-white transition hover:bg-sauti-dark disabled:opacity-40">Join</button>
				</form>
			</section>

			{isAdmin && (
				<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
					<Tile tint="bg-sauti-teal-light" icon={Zap} title="Start now" hint="Open a call right away and share the link." onClick={() => setChooser({ initial: "now" })} />
					<Tile tint="bg-sauti-yellow-light" icon={Link2} title="Meeting for later" hint="Get a link, add people, notes and resources." onClick={() => setChooser({ initial: "later" })} />
					<Tile tint="bg-serene-blue-50" icon={CalendarClock} title="Schedule on calendar" hint="Pick a time and choose how you are reminded." onClick={() => setChooser({ initial: "calendar" })} />
				</div>
			)}

			{isAdmin ? (
				<section className="rounded-2xl border border-serene-neutral-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-5">
					<div className="flex flex-wrap items-center gap-3">
						<h2 className="text-base font-bold text-sauti-dark">{today ? "Today" : format(day, "EEEE")}<span className="ml-2 text-sm font-normal text-serene-neutral-500">{format(day, "d MMMM")}</span></h2>
						<span className="flex-1" />
						<div className="flex items-center gap-1">
							<button onClick={() => setDay((d) => addDays(d, -7))} aria-label="Previous week" className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-serene-neutral-100"><ChevronLeft className="h-4 w-4" /></button>
							{week.map((d) => (
								<button key={d.toISOString()} onClick={() => setDay(startOfDay(d))} aria-pressed={isSameDay(d, day)} className={cn("relative flex w-10 flex-col items-center rounded-xl py-1.5 text-xs transition sm:w-12", isSameDay(d, day) ? "bg-sauti-teal text-white" : isSameDay(d, new Date()) ? "bg-sauti-teal-light text-sauti-dark" : "hover:bg-serene-neutral-100")}>
									<span className="text-[10px] uppercase tracking-wide opacity-80">{format(d, "EEE")}</span>
									<span className="text-base font-semibold">{format(d, "d")}</span>
									{holidayOn(d) && <span title={holidayOn(d) ?? ""} className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-amber-400" />}
								</button>
							))}
							<button onClick={() => setDay((d) => addDays(d, 7))} aria-label="Next week" className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-serene-neutral-100"><ChevronRight className="h-4 w-4" /></button>
						</div>
					</div>

					<div className="mt-4">
						{items === null ? (
							<p className="py-10 text-center text-sm text-serene-neutral-500">Loading meetings...</p>
						) : items.length === 0 ? (
							<div className="flex flex-col items-center rounded-2xl border border-dashed border-serene-neutral-200 py-10 text-center">
								<span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sauti-teal-light text-sauti-teal"><CalendarDays className="h-6 w-6" /></span>
								<p className="mt-3 text-sm font-semibold text-serene-neutral-900">Nothing booked {today ? "today" : `on ${format(day, "EEEE")}`}</p>
								<p className="text-sm text-serene-neutral-500">Schedule a meeting or enjoy the free time.</p>
							</div>
						) : (
							<ul className="space-y-2">
								{items.map((m) => (
									<li key={m.key} className="flex items-center gap-3 rounded-xl border border-serene-neutral-200/70 p-3">
										<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-sauti-teal-light text-sauti-teal">{m.kind === "link" ? <Link2 className="h-4 w-4" /> : <Video className="h-4 w-4" />}</span>
										<span className="min-w-0 flex-1">
											<span className="block truncate text-sm font-semibold text-serene-neutral-900">{m.title}</span>
											<span className="block text-xs text-serene-neutral-500">{m.kind === "link" ? "Link for later" : `${format(new Date(m.start), "h:mm a")}${m.end ? ` to ${format(new Date(m.end), "h:mm a")}` : ""}`}{m.code ? `  ·  ${m.code}` : ""}</span>
										</span>
										{m.code && <a href={`/meet/${m.code}`} className="shrink-0 rounded-xl bg-sauti-teal px-4 py-2 text-sm font-semibold text-white transition hover:bg-sauti-dark">Join</a>}
									</li>
								))}
							</ul>
						)}
					</div>
				</section>
			) : (
				<p className="rounded-2xl border border-dashed border-serene-neutral-200 bg-white p-6 text-center text-sm text-serene-neutral-500">Paste the code or link you were sent in the box above to join.</p>
			)}

			{isAdmin && (
				<section className="rounded-2xl border border-serene-neutral-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-5">
					<h2 className="mb-3 flex items-center gap-2 text-base font-bold text-sauti-dark"><History className="h-4 w-4 text-sauti-teal" /> Past meetings</h2>
					{past === null ? (
						<p className="py-6 text-center text-sm text-serene-neutral-500">Loading...</p>
					) : past.length === 0 ? (
						<p className="rounded-2xl border border-dashed border-serene-neutral-200 py-8 text-center text-sm text-serene-neutral-500">Meetings that were recorded or written down show up here, with their notes and recordings.</p>
					) : (
						<ul className="space-y-2">
							{past.map((m) => (
								<li key={m.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-serene-neutral-200/70 p-3">
									<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-serene-blue-50 text-sauti-teal"><Video className="h-4 w-4" /></span>
									<span className="min-w-0 flex-1">
										<span className="block truncate text-sm font-semibold text-serene-neutral-900">{m.title || "Meeting"}</span>
										<span className="block text-xs text-serene-neutral-500">{format(new Date(m.created_at), "EEE d MMM yyyy, h:mm a")}</span>
									</span>
									<span className="flex flex-wrap items-center gap-1.5">
										{m.recordingFileId && <Link href={`/dashboard/mjengo/vault?open=${m.recordingFileId}`} className="flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700 hover:bg-rose-100"><Clapperboard className="h-3 w-3" /> Recording</Link>}
										{(m.hasNotes || m.lines > 0) && <Link href={`/dashboard/mjengo/meetings?code=${m.code}`} className="flex items-center gap-1 rounded-full bg-sauti-teal-light px-2.5 py-1 text-xs font-medium text-sauti-dark hover:bg-sauti-teal-light/70"><NotebookText className="h-3 w-3" /> {m.hasNotes ? "Notes" : "Transcript"}</Link>}
									</span>
								</li>
							))}
						</ul>
					)}
				</section>
			)}

			{isAdmin && chooser && <MeetChooser open initial={chooser.initial} onClose={() => setChooser(null)} />}
		</div>
	);
}

function Tile({ icon: Icon, title, hint, tint, onClick }: { icon: typeof Video; title: string; hint: string; tint: string; onClick: () => void }) {
	return (
		<button onClick={onClick} className={cn("rounded-2xl border border-black/5 p-4 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:-translate-y-0.5 hover:shadow-md", tint)}>
			<span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 text-sauti-teal"><Icon className="h-4 w-4" /></span>
			<span className="block text-sm font-bold text-serene-neutral-900">{title}</span>
			<span className="block text-xs text-serene-neutral-600">{hint}</span>
		</button>
	);
}
