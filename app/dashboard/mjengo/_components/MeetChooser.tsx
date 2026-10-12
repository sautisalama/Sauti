"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { BellRing, CalendarPlus, Check, Clock, Copy, Link2, Loader2, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { createMeeting } from "@/app/actions/mjengo-meet";
import { createCalendarEvent } from "@/app/actions/mjengo-calendar";

type Step = "choose" | "later" | "calendar" | "done";

const EVERY = [5, 10, 15, 30, 60, 120, 1440];
const everyLabel = (m: number) => (m === 1440 ? "1 day" : m >= 60 ? `${m / 60} hour${m > 60 ? "s" : ""}` : `${m} minutes`);

/** What to do with a new meeting: start it now, make a link for later, or put it on the calendar with alerts. */
export function MeetChooser({ open, onClose }: { open: boolean; onClose: () => void }) {
	const { toast } = useToast();
	const [step, setStep] = useState<Step>("choose");
	const [busy, setBusy] = useState(false);
	const [title, setTitle] = useState("");
	const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
	const [from, setFrom] = useState("09:00");
	const [to, setTo] = useState("09:30");
	const [guests, setGuests] = useState("");
	const [alerts, setAlerts] = useState(2);
	const [every, setEvery] = useState(10);
	const [link, setLink] = useState("");
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!open) return;
		setStep("choose"); setBusy(false); setTitle(""); setLink(""); setCopied(false); setGuests("");
		setDate(format(new Date(), "yyyy-MM-dd"));
		const n = new Date();
		n.setMinutes(n.getMinutes() < 30 ? 30 : 60, 0, 0);
		const e = new Date(n.getTime() + 30 * 60_000);
		setFrom(format(n, "HH:mm")); setTo(format(e, "HH:mm"));
	}, [open]);

	const urlFor = (code: string) => `${window.location.origin}/meet/${code}`;
	const copy = (text: string) => navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }).catch(() => undefined);

	const now = async () => {
		setBusy(true);
		try {
			const { code } = await unwrap(createMeeting("video", title || null));
			const url = urlFor(code);
			navigator.clipboard?.writeText(url).catch(() => undefined);
			window.location.assign(url);
		} catch (e) {
			toast({ title: "Could not start the meeting", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
			setBusy(false);
		}
	};

	const later = async () => {
		setBusy(true);
		try {
			const { code } = await unwrap(createMeeting("video", title || null));
			setLink(urlFor(code));
			copy(urlFor(code));
			setStep("done");
		} catch (e) {
			toast({ title: "Could not create the link", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setBusy(false);
		}
	};

	const schedule = async () => {
		setBusy(true);
		try {
			const start = new Date(`${date}T${from}:00`);
			const end = new Date(`${date}T${to}:00`);
			if (end <= start) throw new Error("The meeting has to end after it starts.");
			const item = await unwrap(createCalendarEvent({
				title: title.trim() || "Meeting",
				start: start.toISOString(),
				end: end.toISOString(),
				attendees: guests.split(/[,;\s]+/).filter(Boolean),
				videoCall: true,
				alerts,
				alertEvery: every,
			}));
			if (item.meetingCode) { setLink(urlFor(item.meetingCode)); copy(urlFor(item.meetingCode)); }
			setStep("done");
		} catch (e) {
			toast({ title: "Could not schedule the meeting", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setBusy(false);
		}
	};

	const Option = ({ icon, title: t, hint, onClick }: { icon: React.ReactNode; title: string; hint: string; onClick: () => void }) => (
		<button onClick={onClick} disabled={busy} className="flex w-full items-center gap-4 rounded-2xl border border-black/10 p-4 text-left transition hover:border-sauti-teal hover:bg-[#f7fbfc] disabled:opacity-60">
			<span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-sauti-teal-light text-sauti-teal">{icon}</span>
			<span><span className="block text-[15px] font-semibold text-[#37352f]">{t}</span><span className="block text-sm text-[#787774]">{hint}</span></span>
		</button>
	);

	return (
		<Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
			<DialogContent className="max-h-[92dvh] max-w-md overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{step === "choose" ? "New meeting" : step === "later" ? "Make a link for later" : step === "calendar" ? "Schedule on the calendar" : "All set"}</DialogTitle>
					<DialogDescription>{step === "choose" ? "When do you want to meet?" : step === "done" ? "The link is copied. Send it to anyone you want in the call." : "Add a title, then continue."}</DialogDescription>
				</DialogHeader>

				{step === "choose" && (
					<div className="space-y-2.5">
						<Option icon={busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Video className="h-5 w-5" />} title="Start a meeting now" hint="Opens the call right away and copies the link." onClick={now} />
						<Option icon={<Link2 className="h-5 w-5" />} title="Create a meeting for later" hint="Get a link now and use it whenever you are ready." onClick={() => setStep("later")} />
						<Option icon={<CalendarPlus className="h-5 w-5" />} title="Schedule on the calendar" hint="Pick a time, invite people and choose how you are reminded." onClick={() => setStep("calendar")} />
					</div>
				)}

				{step === "later" && (
					<div className="space-y-4">
						<Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Meeting name (optional)" aria-label="Meeting name" autoFocus />
						<div className="flex justify-end gap-2">
							<Button variant="ghost" onClick={() => setStep("choose")}>Back</Button>
							<Button className="gap-2 bg-sauti-teal hover:bg-sauti-dark" onClick={later} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} Create link</Button>
						</div>
					</div>
				)}

				{step === "calendar" && (
					<div className="space-y-4">
						<Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add title" aria-label="Title" autoFocus className="h-11 text-base" />
						<div className="flex flex-wrap items-center gap-2">
							<Clock className="h-4 w-4 text-serene-neutral-500" />
							<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 w-40" aria-label="Date" />
							<Input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 w-28" aria-label="Starts" />
							<span className="text-sm text-serene-neutral-500">to</span>
							<Input type="time" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 w-28" aria-label="Ends" />
						</div>
						<Input value={guests} onChange={(e) => setGuests(e.target.value)} placeholder="Guests' emails, separated by commas" aria-label="Guests" />
						<div className="rounded-2xl border border-black/10 p-3">
							<p className="mb-2 flex items-center gap-2 text-sm font-semibold"><BellRing className="h-4 w-4 text-sauti-teal" /> Alerts before it starts</p>
							<div className="flex flex-wrap items-center gap-2 text-sm">
								<label className="flex items-center gap-2">How many
									<select value={alerts} onChange={(e) => setAlerts(Number(e.target.value))} className="h-9 rounded-md border border-serene-neutral-200 bg-white px-2">
										{[0, 1, 2, 3, 4, 5, 8, 10].map((n) => <option key={n} value={n}>{n === 0 ? "None" : n}</option>)}
									</select>
								</label>
								<label className={cn("flex items-center gap-2", alerts === 0 && "opacity-40")}>How often
									<select value={every} disabled={alerts === 0} onChange={(e) => setEvery(Number(e.target.value))} className="h-9 rounded-md border border-serene-neutral-200 bg-white px-2">
										{EVERY.map((m) => <option key={m} value={m}>Every {everyLabel(m)}</option>)}
									</select>
								</label>
							</div>
							<p className="mt-2 text-xs text-serene-neutral-500">
								{alerts === 0 ? "No reminders will be sent." : `You and your guests get ${alerts} alert${alerts === 1 ? "" : "s"}, ${every >= 1440 ? "a day" : everyLabel(every)} apart. The last one comes ${everyLabel(every)} before the start.`}
							</p>
						</div>
						<div className="flex justify-end gap-2">
							<Button variant="ghost" onClick={() => setStep("choose")}>Back</Button>
							<Button className="gap-2 bg-sauti-teal hover:bg-sauti-dark" onClick={schedule} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />} Schedule</Button>
						</div>
					</div>
				)}

				{step === "done" && (
					<div className="space-y-4">
						{link && (
							<div className="flex items-center rounded-lg bg-[#f1f3f4] py-2 pl-3 pr-1 text-sm">
								<span className="min-w-0 flex-1 truncate">{link.replace(/^https?:\/\//, "")}</span>
								<button onClick={() => copy(link)} aria-label="Copy link" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5">{copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}</button>
							</div>
						)}
						<div className="flex justify-end gap-2">
							<Button variant="ghost" onClick={onClose}>Close</Button>
							{link && <Button className="gap-2 bg-sauti-teal hover:bg-sauti-dark" onClick={() => window.location.assign(link)}><Video className="h-4 w-4" /> Open the call</Button>}
						</div>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
