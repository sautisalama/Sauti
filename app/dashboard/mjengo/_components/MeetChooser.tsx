"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { BellRing, CalendarPlus, Check, ChevronDown, Clock, Copy, FileText, Link2, Loader2, Paperclip, Plus, Trash2, UserPlus, Video, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { createMeeting, saveMeetingPlan, type MeetingResource } from "@/app/actions/mjengo-meet";
import { searchFiles } from "../vault/api";
import { createCalendarEvent } from "@/app/actions/mjengo-calendar";

type Step = "choose" | "later" | "ready" | "calendar" | "done";
type Section = "people" | "about" | "resources" | "calendar" | null;

/** Where each kind of file opens in the suite. */
const fileHref = (name: string, id: string) => {
	const ext = name.split(".").pop()?.toLowerCase() ?? "";
	if (["doc", "docx"].includes(ext)) return `/dashboard/mjengo/documents/editor?file=${id}`;
	if (["xls", "xlsx", "csv"].includes(ext)) return `/dashboard/mjengo/files/sheet?file=${id}`;
	if (ext === "pdf") return `/dashboard/mjengo/files/pdf?file=${id}`;
	if (["ppt", "pptx"].includes(ext)) return `/dashboard/mjengo/files/slides?file=${id}`;
	return "/dashboard/mjengo/vault";
};

const EVERY = [5, 10, 15, 30, 60, 120, 1440];
const everyLabel = (m: number) => (m === 1440 ? "1 day" : m >= 60 ? `${m / 60} hour${m > 60 ? "s" : ""}` : `${m} minutes`);

/** What to do with a new meeting: start it now, make a link for later, or put it on the calendar with alerts. */
export function MeetChooser({ open, onClose, initial }: { open: boolean; onClose: () => void; initial?: "now" | "later" | "calendar" }) {
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
	const [code, setCode] = useState("");
	const [section, setSection] = useState<Section>(null);
	const [description, setDescription] = useState("");
	const [resources, setResources] = useState<MeetingResource[]>([]);
	const [newLabel, setNewLabel] = useState("");
	const [newUrl, setNewUrl] = useState("");
	const [fileQ, setFileQ] = useState("");
	const [files, setFiles] = useState<{ id: string; name: string }[] | null>(null);
	const [saved, setSaved] = useState(false);
	const [onCalendar, setOnCalendar] = useState(false);

	useEffect(() => {
		if (!open) return;
		setStep(initial === "later" || initial === "calendar" ? initial : "choose"); setBusy(false); setTitle(""); setLink(""); setCopied(false); setGuests(""); setCode(""); setSection(null); setDescription(""); setResources([]); setNewLabel(""); setNewUrl(""); setFileQ(""); setFiles(null); setSaved(false); setOnCalendar(false);
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

	useEffect(() => { if (open && initial === "now") void now(); // eslint-disable-next-line react-hooks/exhaustive-deps
	}, [open]);

	const later = async () => {
		setBusy(true);
		try {
			const { code } = await unwrap(createMeeting("video", title || null));
			setCode(code);
			setLink(urlFor(code));
			copy(urlFor(code));
			setStep("ready");
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

	const loadFiles = async (q: string) => {
		try { setFiles((await searchFiles(q)).map((f) => ({ id: f.id, name: f.name }))); } catch { setFiles([]); }
	};
	const addResource = (label: string, url: string) => {
		if (!url.trim()) return;
		setResources((r) => (r.some((x) => x.url === url.trim()) ? r : [...r, { label: label.trim() || url.trim(), url: url.trim() }]));
		setNewLabel(""); setNewUrl(""); setSaved(false);
	};
	const savePlan = async () => {
		setBusy(true);
		try {
			await unwrap(saveMeetingPlan(code, { title: title.trim() || null, description, invitees: guests.split(/[,;\s]+/).filter(Boolean), resources }));
			setSaved(true);
			toast({ title: "Meeting details saved" });
		} catch (e) {
			toast({ title: "Could not save", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setBusy(false);
		}
	};
	const addToCalendar = async () => {
		setBusy(true);
		try {
			const start = new Date(`${date}T${from}:00`);
			const end = new Date(`${date}T${to}:00`);
			if (end <= start) throw new Error("The meeting has to end after it starts.");
			await unwrap(saveMeetingPlan(code, { title: title.trim() || null, description, invitees: guests.split(/[,;\s]+/).filter(Boolean), resources }));
			const extra = resources.length ? `Resources:\n${resources.map((r) => `${r.label}: ${r.url.startsWith("/") ? window.location.origin + r.url : r.url}`).join("\n")}` : "";
			await unwrap(createCalendarEvent({
				title: title.trim() || "Meeting",
				start: start.toISOString(), end: end.toISOString(),
				attendees: guests.split(/[,;\s]+/).filter(Boolean),
				description: [description.trim(), extra].filter(Boolean).join("\n\n") || null,
				meetingCode: code, alerts, alertEvery: every,
			}));
			setOnCalendar(true);
			setSaved(true);
			setSection(null);
			toast({ title: "Added to the calendar", description: `${format(start, "EEE d MMM, h:mm a")}` });
		} catch (e) {
			toast({ title: "Could not add it to the calendar", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
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
					<DialogTitle>{step === "choose" ? "New meeting" : step === "later" ? "Make a link for later" : step === "ready" ? "Your meeting is ready" : step === "calendar" ? "Schedule on the calendar" : "All set"}</DialogTitle>
					<DialogDescription>{step === "choose" ? "When do you want to meet?" : step === "done" || step === "ready" ? "The link is copied. Send it to anyone you want in the call." : "Add a title, then continue."}</DialogDescription>
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

				{step === "ready" && (
					<div className="space-y-3">
						<div className="flex items-center rounded-lg bg-[#f1f3f4] py-2 pl-3 pr-1 text-sm">
							<span className="min-w-0 flex-1 truncate">{link.replace(/^https?:\/\//, "")}</span>
							<button onClick={() => copy(link)} aria-label="Copy link" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5">{copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}</button>
						</div>
						<Button className="h-11 w-full gap-2 bg-sauti-teal hover:bg-sauti-dark" onClick={() => window.location.assign(link)}><Video className="h-4 w-4" /> Join now</Button>

						{([
							["people", <UserPlus key="p" className="h-4 w-4" />, "Add participants", guests.trim() ? `${guests.split(/[,;\s]+/).filter(Boolean).length} added` : ""],
							["about", <FileText key="a" className="h-4 w-4" />, "Add description", description.trim() ? "Added" : ""],
							["resources", <Paperclip key="r" className="h-4 w-4" />, "Add resources", resources.length ? `${resources.length} added` : ""],
							["calendar", <CalendarPlus key="c" className="h-4 w-4" />, "Add to calendar", onCalendar ? "On the calendar" : ""],
						] as [Exclude<Section, null>, React.ReactNode, string, string][]).map(([k, icon, label, note]) => (
							<div key={k} className="rounded-2xl border border-black/10">
								<button onClick={() => { setSection((cur) => (cur === k ? null : k)); if (k === "resources" && !files) void loadFiles(""); }} aria-expanded={section === k} className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium">
									<span className="text-sauti-teal">{icon}</span><span className="flex-1">{label}</span>
									{note && <span className="text-xs font-normal text-serene-neutral-500">{note}</span>}
									<ChevronDown className={cn("h-4 w-4 text-serene-neutral-400 transition", section === k && "rotate-180")} />
								</button>
								{section === k && (
									<div className="space-y-3 border-t border-black/[0.07] p-4">
										{k === "people" && (
											<>
												<Input value={guests} onChange={(e) => { setGuests(e.target.value); setSaved(false); }} placeholder="Emails, separated by commas" aria-label="Participants" />
												<a href={`mailto:${guests.split(/[,;\s]+/).filter(Boolean).join(",")}?subject=${encodeURIComponent(title || "Join the call")}&body=${encodeURIComponent(`${description ? description + "\n\n" : ""}Join the call: ${link}`)}`} className="inline-block text-sm font-medium text-sauti-teal hover:underline">Send them the link by email</a>
											</>
										)}
										{k === "about" && (
											<>
												<Input value={title} onChange={(e) => { setTitle(e.target.value); setSaved(false); }} placeholder="Meeting name" aria-label="Meeting name" />
												<textarea value={description} onChange={(e) => { setDescription(e.target.value); setSaved(false); }} rows={4} placeholder="What is this meeting about? Agenda, goals, what to prepare." aria-label="Description" className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring" />
											</>
										)}
										{k === "resources" && (
											<>
												{resources.length > 0 && (
													<ul className="space-y-1">
														{resources.map((r) => (
															<li key={r.url} className="flex items-center gap-2 rounded-lg bg-serene-neutral-50 px-2 py-1.5 text-sm"><Paperclip className="h-3.5 w-3.5 shrink-0 text-serene-neutral-500" /><span className="min-w-0 flex-1 truncate">{r.label}</span><button aria-label={`Remove ${r.label}`} onClick={() => { setResources((all) => all.filter((x) => x.url !== r.url)); setSaved(false); }} className="text-serene-neutral-400 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button></li>
														))}
													</ul>
												)}
												<div>
													<p className="mb-1 text-xs font-medium text-serene-neutral-600">From Files</p>
													<Input value={fileQ} onChange={(e) => { setFileQ(e.target.value); void loadFiles(e.target.value); }} placeholder="Search your files" aria-label="Search files" className="h-9" />
													<ul className="mt-1 max-h-36 space-y-0.5 overflow-y-auto">
														{(files ?? []).slice(0, 12).map((f) => <li key={f.id}><button onClick={() => addResource(f.name, fileHref(f.name, f.id))} className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-serene-neutral-100"><Plus className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{f.name}</span></button></li>)}
														{files && files.length === 0 && <li className="px-2 py-1 text-xs text-serene-neutral-500">No files found.</li>}
													</ul>
												</div>
												<div>
													<p className="mb-1 text-xs font-medium text-serene-neutral-600">A link</p>
													<div className="flex gap-1.5">
														<Input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="Name" aria-label="Link name" className="h-9 w-28" />
														<Input value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://" aria-label="Link address" className="h-9 min-w-0 flex-1" />
														<Button type="button" size="icon" variant="outline" className="h-9 w-9 shrink-0" aria-label="Add link" onClick={() => addResource(newLabel, newUrl)}><Plus className="h-4 w-4" /></Button>
													</div>
												</div>
											</>
										)}
										{k === "calendar" && (
											<>
												<div className="flex flex-wrap items-center gap-2">
													<Clock className="h-4 w-4 text-serene-neutral-500" />
													<Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 w-40" aria-label="Date" />
													<Input type="time" value={from} onChange={(e) => setFrom(e.target.value)} className="h-10 w-28" aria-label="Starts" />
													<span className="text-sm text-serene-neutral-500">to</span>
													<Input type="time" value={to} onChange={(e) => setTo(e.target.value)} className="h-10 w-28" aria-label="Ends" />
												</div>
												<div className="flex flex-wrap items-center gap-2 text-sm">
													<BellRing className="h-4 w-4 text-serene-neutral-500" />
													<select value={alerts} onChange={(e) => setAlerts(Number(e.target.value))} aria-label="Number of alerts" className="h-9 rounded-md border border-serene-neutral-200 bg-white px-2">{[0, 1, 2, 3, 4, 5, 8, 10].map((n) => <option key={n} value={n}>{n === 0 ? "No alerts" : `${n} alert${n === 1 ? "" : "s"}`}</option>)}</select>
													{alerts > 0 && <select value={every} onChange={(e) => setEvery(Number(e.target.value))} aria-label="Time between alerts" className="h-9 rounded-md border border-serene-neutral-200 bg-white px-2">{EVERY.map((m) => <option key={m} value={m}>every {everyLabel(m)}</option>)}</select>}
												</div>
												<p className="text-xs text-serene-neutral-500">Participants, the description and the resources go on the event too.</p>
												<Button className="gap-2 bg-sauti-teal hover:bg-sauti-dark" onClick={addToCalendar} disabled={busy || onCalendar}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />} {onCalendar ? "Added" : "Add to calendar"}</Button>
											</>
										)}
									</div>
								)}
							</div>
						))}

						<div className="flex justify-end gap-2 pt-1">
							<Button variant="ghost" onClick={onClose}><X className="mr-1 h-4 w-4" /> Close</Button>
							<Button variant="outline" onClick={savePlan} disabled={busy || saved}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : saved ? <Check className="h-4 w-4" /> : null}<span className="ml-1">{saved ? "Saved" : "Save details"}</span></Button>
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
