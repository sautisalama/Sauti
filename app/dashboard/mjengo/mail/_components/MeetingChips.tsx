"use client";

import { useMemo, useState } from "react";
import { BellPlus, CalendarPlus, Check, Loader2, X } from "lucide-react";
import { detectMeetingsAndDeadlines, type DetectedMeeting } from "@/lib/mail/meeting-detect";
import { createCalendarEvent } from "@/app/actions/mjengo-calendar";
import { unwrap } from "@/lib/action-result";

const HOUR = 3600_000;
/** Nairobi wall-clock "YYYY-MM-DDTHH:mm" for an instant, and back (Nairobi has no daylight saving). */
const toLocal = (ms: number) => new Date(ms + 3 * HOUR).toISOString().slice(0, 16);
const fromLocal = (s: string) => new Date(`${s}:00+03:00`).getTime();
const nice = (ms: number) => new Date(ms).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Africa/Nairobi" });
const PROVIDER: Record<string, string> = { meet: "Google Meet", zoom: "Zoom", teams: "Microsoft Teams", webex: "Webex", sauti: "Sauti Salama call", ics: "Invitation", other: "Meeting" };

const chip = "inline-flex items-center gap-1.5 rounded-full border border-black/10 px-3 py-1 text-xs font-medium text-[#787774] hover:bg-black/[0.03] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#068297]";
const pill = "rounded-full border border-black/10 bg-white px-2.5 py-1 text-xs text-[#37352f] hover:bg-[#F4FAFB] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#068297] disabled:opacity-50";

/**
 * "Add to calendar" and "Remind me" next to the summariser, shown only when the message holds a meeting link or
 * a deadline that could be read. Detection runs in the browser; nothing is saved until the person confirms.
 */
export function MeetingChips({ subject, text, html, sent, from }: { subject: string; text: string; html: string | null; sent: string | null; from: string }) {
	const found = useMemo(() => detectMeetingsAndDeadlines({ subject, text, html, sent }), [subject, text, html, sent]);
	const [panel, setPanel] = useState<null | "cal" | "rem">(null);
	const [done, setDone] = useState<string | null>(null);
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState("");
	const meeting: DetectedMeeting | undefined = found.meetings[0];
	const deadline = found.deadlines[0];
	const [title, setTitle] = useState(meeting?.title || subject || "Meeting");
	const [startStr, setStartStr] = useState(() => (meeting?.start ? toLocal(new Date(meeting.start).getTime()) : meeting?.dateOnly ? `${meeting.dateOnly}T09:00` : ""));
	const [custom, setCustom] = useState("");

	if (!meeting && !deadline) return null;

	const addEvent = async () => {
		const s = fromLocal(startStr);
		if (!startStr || Number.isNaN(s)) { setErr("Choose a date and time first."); return; }
		const e = meeting?.end && meeting.start && Math.abs(new Date(meeting.start).getTime() - s) < 60_000 ? new Date(meeting.end).getTime() : s + HOUR;
		setBusy(true); setErr("");
		try {
			// Sauti Salama links become an event that opens the call; other providers keep the link in the description.
			await unwrap(createCalendarEvent({
				title: title.trim() || "Meeting", start: new Date(s).toISOString(), end: new Date(e).toISOString(),
				description: [`From an email: ${subject}`, meeting?.url && !meeting.code ? `Join: ${meeting.url}` : ""].filter(Boolean).join("\n\n"),
				meetingCode: meeting?.code, reminders: [15],
			}));
			setDone("Added to your calendar."); setPanel(null);
		} catch (x) { setErr(x instanceof Error ? x.message : "Could not add it."); } finally { setBusy(false); }
	};

	const now = Date.now();
	const day = (add: number, hh = 9) => { const d = new Date(now + 3 * HOUR + add * 24 * HOUR); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), hh) - 3 * HOUR; };
	const deadlineAt = deadline ? new Date(`${deadline.date}T09:00:00+03:00`).getTime() : null;
	const dow = new Date(now + 3 * HOUR).getUTCDay();
	const pills: { label: string; at: number }[] = [
		{ label: "Later today", at: Math.ceil((now + 3 * HOUR) / (15 * 60_000)) * 15 * 60_000 },
		{ label: "Tomorrow morning", at: day(1) },
		{ label: "In 3 days", at: day(3) },
		...(deadlineAt && deadlineAt - 24 * HOUR > now ? [{ label: "A day before the deadline", at: deadlineAt - 24 * HOUR }] : []),
		{ label: "Next week", at: day(((8 - dow) % 7) || 7) },
	];

	const remind = async (when: number) => {
		if (!(when > Date.now())) { setErr("Choose a time in the future."); return; }
		setBusy(true); setErr("");
		try {
			// A reminder needs an item to hang on. The calendar event is the simplest one that already carries
			// reminders (minutes before the start), so it is created at the deadline with an offset when the
			// reminder falls inside the 28 days events allow, and otherwise at the reminder moment itself.
			const label = (subject || "from an email").slice(0, 120);
			const useDeadline = deadlineAt !== null && when < deadlineAt && Math.round((deadlineAt - when) / 60_000) <= 40320;
			const start = useDeadline ? deadlineAt! : when;
			await unwrap(createCalendarEvent({
				title: useDeadline ? `Deadline: ${label}` : `Reminder: ${label}`,
				start: new Date(start).toISOString(), end: new Date(start + 30 * 60_000).toISOString(),
				description: [`Reminder from an email from ${from || "someone"}: ${subject}`, deadline ? `Deadline: ${deadline.text}` : ""].filter(Boolean).join("\n\n"),
				reminders: [useDeadline ? Math.round((deadlineAt! - when) / 60_000) : 0], attendees: [],
			}));
			setDone(`Reminder set for ${nice(when)}.`); setPanel(null);
		} catch (x) { setErr(x instanceof Error ? x.message : "Could not set the reminder."); } finally { setBusy(false); }
	};

	return (
		<>
			{meeting && !done && (
				<button type="button" onClick={() => setPanel(panel === "cal" ? null : "cal")} aria-expanded={panel === "cal"} aria-label={`Add the ${(PROVIDER[meeting.provider] ?? "meeting").toLowerCase()} to the calendar`} className={`mt-3 ${chip}`}>
					<CalendarPlus className="h-3.5 w-3.5 text-[#068297]" /> Add to calendar?
				</button>
			)}
			{deadline && !done && (
				<button type="button" onClick={() => setPanel(panel === "rem" ? null : "rem")} aria-expanded={panel === "rem"} aria-label={`Set a reminder for the deadline: ${deadline.text}`} className={`mt-3 ${chip}`}>
					<BellPlus className="h-3.5 w-3.5 text-[#068297]" /> Remind me
				</button>
			)}
			{done && <span role="status" className="mt-3 inline-flex items-center gap-1.5 text-xs text-[#068297]"><Check className="h-3.5 w-3.5" /> {done}</span>}
			{panel && (
				<section aria-label={panel === "cal" ? "Add to calendar" : "Set a reminder"} className="basis-full rounded-2xl border border-black/10 bg-white p-3">
					<div className="flex items-start gap-2">
						<div className="min-w-0 flex-1">
							{panel === "cal" && meeting && (
								<>
									<p className="text-xs text-[#787774]">{PROVIDER[meeting.provider] ?? "Meeting"}{meeting.url && !meeting.code ? ` · ${meeting.url.replace(/^https?:\/\//, "").slice(0, 50)}` : ""}</p>
									<div className="mt-2 flex flex-wrap items-center gap-2">
										<input aria-label="Event title" value={title} onChange={(e) => setTitle(e.target.value)} className="min-w-[180px] flex-1 rounded-lg border border-black/10 px-2 py-1 text-sm" />
										<input aria-label="Date and time (Nairobi)" type="datetime-local" value={startStr} onChange={(e) => setStartStr(e.target.value)} className="rounded-lg border border-black/10 px-2 py-1 text-sm" />
										<button type="button" disabled={busy} onClick={() => void addEvent()} className={`${pill} inline-flex items-center gap-1 font-medium`}>
											{busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <CalendarPlus className="h-3 w-3" />} Add
										</button>
									</div>
									{!startStr && <p className="mt-1 text-xs text-[#787774]">No time was found in the email. Choose one to add it.</p>}
								</>
							)}
							{panel === "rem" && deadline && (
								<>
									<p className="text-xs text-[#787774]">Deadline found: {deadline.text}. When should we remind you?</p>
									<div className="mt-2 flex flex-wrap items-center gap-1.5" role="group" aria-label="Reminder time">
										{pills.map((p) => <button key={p.label} type="button" disabled={busy} onClick={() => void remind(p.at)} className={pill} title={nice(p.at)}>{p.label}</button>)}
										<input aria-label="Pick a time (Nairobi)" type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} className="rounded-full border border-black/10 px-2 py-0.5 text-xs" />
										<button type="button" disabled={busy || !custom} onClick={() => void remind(fromLocal(custom))} className={pill}>Pick a time</button>
									</div>
								</>
							)}
							{err && <p role="alert" className="mt-1 text-xs text-red-600">{err}</p>}
						</div>
						<button type="button" onClick={() => setPanel(null)} aria-label="Close" className="rounded p-0.5 text-[#9b9a97] hover:bg-black/5"><X className="h-3.5 w-3.5" /></button>
					</div>
				</section>
			)}
		</>
	);
}
