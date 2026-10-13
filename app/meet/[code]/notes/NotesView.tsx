"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { CheckCircle2, ChevronDown, ListChecks, Loader2, Lock, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { emailMeetingSummary, getMyNotes, type MyNotes } from "@/app/actions/meeting-notes";

/** What came out of a call, for the person reading: one line, their own actions first, then the rest. */
export function NotesView({ code }: { code: string }) {
	const { toast } = useToast();
	const [n, setN] = useState<MyNotes | null>(null);
	const [error, setError] = useState("");
	const [showAll, setShowAll] = useState(false);
	const [transcript, setTranscript] = useState(false);
	const [emails, setEmails] = useState("");
	const [busy, setBusy] = useState(false);

	useEffect(() => { unwrap(getMyNotes(code)).then(setN).catch((e) => setError(e instanceof Error ? e.message : "Could not open the notes.")); }, [code]);

	if (error) return <div className="mx-auto max-w-lg p-8 text-center"><Lock className="mx-auto mb-3 h-8 w-8 text-serene-neutral-300" /><p className="text-sm text-serene-neutral-600">{error}</p><Link href="/dashboard" className="mt-4 inline-block text-sm font-medium text-sauti-teal hover:underline">Back to the dashboard</Link></div>;
	if (!n) return <div className="flex justify-center p-16 text-serene-neutral-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;

	return (
		<div className="mx-auto max-w-3xl space-y-5 px-4 py-6">
			<header>
				<p className="text-xs font-semibold uppercase tracking-widest text-serene-neutral-400">Call notes</p>
				<h1 className="mt-1 text-2xl font-bold tracking-tight text-sauti-dark">{n.title}</h1>
				<p className="text-sm text-serene-neutral-500">{format(new Date(n.date), "EEEE d MMMM yyyy, h:mm a")}</p>
			</header>

			{!n.ready ? (
				<p className="rounded-2xl border border-dashed border-serene-neutral-200 bg-white p-10 text-center text-sm text-serene-neutral-500">There is not enough said in this call to write notes.</p>
			) : (
				<>
					<section className="rounded-2xl border border-sauti-teal/20 bg-sauti-teal-light/30 p-5">
						<p className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-sauti-teal"><Sparkles className="h-3.5 w-3.5" /> In short</p>
						<p className="text-lg font-medium leading-snug text-[#0b2228]">{n.tldr}</p>
					</section>

					<section className="rounded-2xl border border-serene-neutral-200/70 bg-white p-5">
						<h2 className="mb-3 flex items-center gap-2 text-sm font-bold text-sauti-dark"><ListChecks className="h-4 w-4 text-sauti-teal" /> Your action items</h2>
						{n.mine.length === 0 ? <p className="text-sm text-serene-neutral-500">Nothing was assigned to you by name.</p> : (
							<ul className="space-y-2">{n.mine.map((a, i) => <li key={i} className="flex gap-2.5 text-sm"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-sauti-teal" /><span>{a.text}{a.owner?.toLowerCase() === "everyone" && <span className="ml-1.5 rounded-full bg-serene-neutral-100 px-1.5 py-0.5 text-[10px] text-serene-neutral-500">everyone</span>}</span></li>)}</ul>
						)}
						{n.others.length > 0 && (
							<>
								<button onClick={() => setShowAll((v) => !v)} className="mt-3 flex items-center gap-1 text-xs font-medium text-sauti-teal hover:underline"><ChevronDown className={cn("h-3.5 w-3.5 transition", showAll && "rotate-180")} /> {showAll ? "Hide" : "Show"} {n.others.length} for others</button>
								{showAll && <ul className="mt-2 space-y-1.5 border-t border-serene-neutral-100 pt-2">{n.others.map((a, i) => <li key={i} className="text-sm text-serene-neutral-600">{a.text}{a.owner && <span className="ml-1.5 text-xs text-serene-neutral-400">{a.owner}</span>}</li>)}</ul>}
							</>
						)}
					</section>

					{n.summary && <section className="rounded-2xl border border-serene-neutral-200/70 bg-white p-5"><h2 className="mb-2 text-sm font-bold text-sauti-dark">Summary</h2><p className="text-sm leading-relaxed text-serene-neutral-700">{n.summary}</p></section>}
					{n.decisions.length > 0 && <section className="rounded-2xl border border-serene-neutral-200/70 bg-white p-5"><h2 className="mb-2 text-sm font-bold text-sauti-dark">Decisions</h2><ul className="list-disc space-y-1 pl-5 text-sm text-serene-neutral-700">{n.decisions.map((d, i) => <li key={i}>{d}</li>)}</ul></section>}
					{n.questions.length > 0 && <section className="rounded-2xl border border-serene-neutral-200/70 bg-white p-5"><h2 className="mb-2 text-sm font-bold text-sauti-dark">Still open</h2><ul className="list-disc space-y-1 pl-5 text-sm text-serene-neutral-700">{n.questions.map((d, i) => <li key={i}>{d}</li>)}</ul></section>}
				</>
			)}

			{n.guests.length > 0 && (
				<section className="rounded-2xl border border-serene-neutral-200/70 bg-white p-5">
					<h2 className="mb-1 flex items-center gap-2 text-sm font-bold text-sauti-dark"><Mail className="h-4 w-4 text-sauti-teal" /> Guests who joined</h2>
					<p className="text-sm text-serene-neutral-600">{n.guests.join(", ")}</p>
					{n.emailed ? (
						<p className="mt-3 rounded-xl bg-serene-neutral-50 p-3 text-xs text-serene-neutral-500">A summary was emailed on {format(new Date(n.emailed.at), "d MMM, h:mm a")} to {n.emailed.to.join(", ")}.</p>
					) : n.canEmail ? (
						<div className="mt-3 space-y-2">
							<p className="text-xs text-serene-neutral-500">Send them the summary only, without the transcript. This can be done once.</p>
							<div className="flex flex-col gap-2 sm:flex-row">
								<input value={emails} onChange={(e) => setEmails(e.target.value)} placeholder="their email addresses, separated by commas" aria-label="Guest emails" className="h-10 flex-1 rounded-lg border border-serene-neutral-200 px-3 text-sm outline-none focus:border-sauti-teal" />
								<Button disabled={busy || !emails.trim()} className="gap-1.5 bg-sauti-teal hover:bg-sauti-dark" onClick={async () => {
									setBusy(true);
									try { const r = await unwrap(emailMeetingSummary(code, emails.split(/[,;\s]+/).filter(Boolean))); toast({ title: `Summary sent to ${r.sent}` }); setN(await unwrap(getMyNotes(code))); } catch (e) { toast({ title: "Could not send it", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setBusy(false); }
								}}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />} Email the summary</Button>
							</div>
						</div>
					) : null}
				</section>
			)}

			<section className="rounded-2xl border border-serene-neutral-200/70 bg-white">
				<button onClick={() => setTranscript((v) => !v)} className="flex w-full items-center justify-between px-5 py-4 text-left"><span className="text-sm font-bold text-sauti-dark">Transcript <span className="font-normal text-serene-neutral-400">· {n.transcript.length} lines, only for the team</span></span><ChevronDown className={cn("h-4 w-4 text-serene-neutral-400 transition", transcript && "rotate-180")} /></button>
				{transcript && <div className="max-h-96 space-y-2 overflow-y-auto border-t border-serene-neutral-100 px-5 py-4 text-sm">{n.transcript.length === 0 ? <p className="text-serene-neutral-500">No transcript was kept.</p> : n.transcript.map((l) => <p key={l.id}><span className="font-medium text-sauti-teal">{l.name}</span> {l.text}</p>)}</div>}
			</section>
		</div>
	);
}
