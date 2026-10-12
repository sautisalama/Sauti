"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDays, endOfDay, format, isSameDay, startOfDay, startOfWeek } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Keyboard, Link2, Phone, Plus, ShieldCheck, Video } from "lucide-react";
import { unwrap } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { meetHome, type MeetHomeItem } from "@/app/actions/mjengo-meet";
import { MeetChooser } from "@/app/dashboard/mjengo/_components/MeetChooser";

const CODE = /[a-z0-9]{3}-[a-z0-9]{4}-[a-z0-9]{3}/i;

/** The Meet home screen: join with a code, start something new, and see the day's meetings. */
export function MeetHome({ isAdmin }: { isAdmin: boolean }) {
	const [day, setDay] = useState(() => startOfDay(new Date()));
	const [items, setItems] = useState<MeetHomeItem[] | null>(null);
	const [code, setCode] = useState("");
	const [chooser, setChooser] = useState(false);
	const week = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(day, { weekStartsOn: 0 }), i)), [day]);
	const found = CODE.exec(code)?.[0]?.toLowerCase() ?? null;

	useEffect(() => {
		if (!isAdmin) return;
		let on = true;
		setItems(null);
		unwrap(meetHome(startOfDay(day).toISOString(), endOfDay(day).toISOString())).then((r) => on && setItems(r)).catch(() => on && setItems([]));
		return () => { on = false; };
	}, [day, isAdmin]);

	const join = () => { if (found) window.location.assign(`/meet/${found}`); };
	const today = isSameDay(day, new Date());

	return (
		<div className="flex min-h-dvh flex-col bg-white text-[#202124]">
			<header className="flex flex-wrap items-center gap-3 px-4 py-3 sm:px-6">
				<Link href="/dashboard/mjengo" className="flex items-center gap-2 text-[22px] text-[#5f6368]">
					<span className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#fbbc04] text-white"><Video className="h-5 w-5" /></span>
					<span><span className="font-medium text-[#202124]">Sauti</span> Meet</span>
				</Link>
				<form onSubmit={(e) => { e.preventDefault(); join(); }} className="order-3 flex w-full items-center gap-2 sm:order-none sm:mx-auto sm:w-auto sm:min-w-[24rem]">
					<div className="flex min-w-0 flex-1 items-center gap-2 rounded-full bg-[#f1f3f9] py-1.5 pl-4 pr-1.5">
						<Keyboard className="h-5 w-5 shrink-0 text-[#5f6368]" />
						<input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Enter a code or link" aria-label="Meeting code or link" className="h-9 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-[#5f6368]" />
						<button type="submit" disabled={!found} className="h-9 rounded-full px-4 text-sm font-medium text-[#1a73e8] disabled:text-[#9aa0a6]">Join</button>
					</div>
					{isAdmin && (
						<button type="button" onClick={() => setChooser(true)} className="flex h-11 shrink-0 items-center gap-2 rounded-full bg-[#c4eed0] px-5 text-sm font-medium text-[#0b3d1a] hover:bg-[#b2e5c2]"><Plus className="h-4 w-4" /> New</button>
					)}
				</form>
			</header>

			<div className="flex min-h-0 flex-1">
				{isAdmin && (
					<nav aria-label="Meet" className="hidden w-20 shrink-0 flex-col items-center gap-3 pt-4 sm:flex">
						<span className="flex flex-col items-center gap-1 text-xs font-medium text-[#0b57d0]"><span className="flex h-8 w-14 items-center justify-center rounded-full bg-[#d3e3fd]"><CalendarDays className="h-5 w-5" /></span>Meetings</span>
						<Link href="/dashboard/mjengo/meetings" className="flex flex-col items-center gap-1 text-xs text-[#444746]"><span className="flex h-8 w-14 items-center justify-center rounded-full hover:bg-black/5"><Phone className="h-5 w-5" /></span>Call notes</Link>
					</nav>
				)}

				<main className="mx-auto w-full max-w-5xl px-4 pb-10 sm:px-6">
					{isAdmin ? (
						<>
							<div className="mt-2 flex flex-wrap items-center gap-3">
								<h1 className="text-xl font-normal sm:text-2xl">{format(day, "EEE, MMM d")}</h1>
								{!today && <button onClick={() => setDay(startOfDay(new Date()))} className="rounded-full border border-[#dadce0] px-3 py-1 text-sm text-[#1a73e8]">Today</button>}
								<span className="flex-1" />
								<div className="flex items-center gap-1">
									<button onClick={() => setDay((d) => addDays(d, -7))} aria-label="Previous week" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5"><ChevronLeft className="h-5 w-5" /></button>
									{week.map((d) => (
										<button key={d.toISOString()} onClick={() => setDay(startOfDay(d))} aria-pressed={isSameDay(d, day)} className={cn("flex w-10 flex-col items-center rounded-full py-1.5 text-xs sm:w-11", isSameDay(d, day) ? "bg-[#c2e7ff] text-[#001d35]" : "hover:bg-black/5")}>
											<span className="text-[10px] uppercase tracking-wide">{format(d, "EEE")}</span>
											<span className="text-base">{format(d, "d")}</span>
										</button>
									))}
									<button onClick={() => setDay((d) => addDays(d, 7))} aria-label="Next week" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5"><ChevronRight className="h-5 w-5" /></button>
								</div>
							</div>

							<div className="mt-4 flex items-center gap-4 rounded-full bg-[#d3e3fd] px-5 py-3">
								<ShieldCheck className="h-8 w-8 shrink-0 text-[#0b57d0]" />
								<div className="min-w-0 flex-1"><p className="text-sm font-medium">Your meeting is safe</p><p className="text-sm text-[#444746]">Only people who have the link can join, and calls go directly between the people in them.</p></div>
							</div>

							{items === null ? (
								<p className="mt-16 text-center text-sm text-[#5f6368]">Loading meetings...</p>
							) : items.length === 0 ? (
								<div className="mt-14 flex flex-col items-center text-center">
									<span className="flex h-28 w-28 items-center justify-center rounded-full bg-[#f1f3f9] text-[#0b57d0]"><Video className="h-12 w-12" /></span>
									<h2 className="mt-6 text-2xl font-normal sm:text-3xl">No meetings scheduled for {today ? "today" : format(day, "EEEE")}</h2>
									<p className="mt-2 text-sm text-[#444746]">Schedule a meeting or enjoy the free time</p>
									<button onClick={() => setChooser(true)} className="mt-6 flex h-12 items-center gap-2 rounded-full bg-[#c4eed0] px-6 text-sm font-medium text-[#0b3d1a] hover:bg-[#b2e5c2]"><Plus className="h-4 w-4" /> New</button>
								</div>
							) : (
								<ul className="mt-6 space-y-2">
									{items.map((m) => (
										<li key={m.key} className="flex items-center gap-4 rounded-2xl border border-[#dadce0] p-4">
											<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#e8f0fe] text-[#1a73e8]">{m.kind === "link" ? <Link2 className="h-5 w-5" /> : <Video className="h-5 w-5" />}</span>
											<span className="min-w-0 flex-1">
												<span className="block truncate text-[15px] font-medium">{m.title}</span>
												<span className="block text-sm text-[#5f6368]">{m.kind === "link" ? "Link for later" : `${format(new Date(m.start), "h:mm a")}${m.end ? ` to ${format(new Date(m.end), "h:mm a")}` : ""}`}{m.code ? `  ·  ${m.code}` : ""}</span>
											</span>
											{m.code && <a href={`/meet/${m.code}`} className="h-10 shrink-0 rounded-full bg-[#0b57d0] px-5 text-sm font-medium leading-10 text-white hover:bg-[#0a4cb8]">Join</a>}
										</li>
									))}
								</ul>
							)}
						</>
					) : (
						<div className="mt-20 text-center">
							<h1 className="text-3xl font-normal">Join a meeting</h1>
							<p className="mt-2 text-sm text-[#444746]">Paste the code or link you were sent in the box above.</p>
						</div>
					)}
				</main>
			</div>
			{isAdmin && <MeetChooser open={chooser} onClose={() => setChooser(false)} />}
		</div>
	);
}
