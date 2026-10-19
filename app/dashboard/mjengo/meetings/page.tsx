"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { format } from "date-fns";
import { ClipboardCopy, Loader2, Mic, Sparkles, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { listMeetings, makeMeetingNotes, meetingDetail, type MeetingDetail, type MeetingRow } from "@/app/actions/mjengo-meet";
import { Markdown } from "../_components/Markdown";
import { MjengoLoader } from "../_components/MjengoLoader";
import { MemberFilter, SimilarItems, TagEditor, TagFilter, tagLabel } from "../_components/Facets";

function Meetings() {
	const { toast } = useToast();
	const params = useSearchParams();
	const [list, setList] = useState<MeetingRow[] | null>(null);
	const [code, setCode] = useState<string | null>(params.get("code"));
	const [detail, setDetail] = useState<MeetingDetail | null>(null);
	const [busy, setBusy] = useState(false);
	const [tagFilter, setTagFilter] = useState<string[]>([]);
	const [memberFilter, setMemberFilter] = useState<string | null>(null);

	useEffect(() => { unwrap(listMeetings()).then(setList).catch(() => setList([])); }, []);
	const open = useCallback(async (c: string) => {
		setCode(c);
		setDetail(null);
		try { setDetail(await unwrap(meetingDetail(c))); } catch (e) { toast({ title: "Could not open the call", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); }
	}, [toast]);
	useEffect(() => { if (code) open(code); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

	if (!list) return <MjengoLoader label="Loading calls" />;
	const shown = list.filter((m) => (!tagFilter.length || tagFilter.some((t) => (m.tags ?? []).includes(t))) && (!memberFilter || m.created_by === memberFilter || (m.participants ?? []).includes(memberFilter)));

	return (
		<div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-[320px_1fr]">
			<aside>
				<h2 className="mb-1 text-xl font-bold tracking-tight text-sauti-dark">Calls</h2>
				<p className="mb-3 text-sm text-serene-neutral-500">Transcripts and notes from your calls. Notes are written when a call goes quiet and shared with everyone who took part.</p>
				<div className="mb-3 space-y-2"><MemberFilter value={memberFilter} onChange={setMemberFilter} label="Anyone on the call" className="w-full" /><TagFilter selected={tagFilter} onChange={setTagFilter} extra={list.flatMap((m) => m.tags ?? [])} limit={8} /></div>
				<ul className="space-y-1.5">
					{shown.length === 0 && list.length > 0 && <li className="rounded-xl border border-dashed border-serene-neutral-200 p-6 text-center text-sm text-serene-neutral-500">No calls match.</li>}
					{list.length === 0 && <li className="rounded-xl border border-dashed border-serene-neutral-200 p-6 text-center text-sm text-serene-neutral-500">No calls yet.</li>}
					{shown.map((m) => (
						<li key={m.id}>
							<button onClick={() => open(m.code)} className={cn("flex w-full items-center gap-3 rounded-xl border p-3 text-left transition", code === m.code ? "border-sauti-teal bg-sauti-teal-light/40" : "border-serene-neutral-200/70 bg-white hover:border-sauti-teal/40")}>
								<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sauti-teal-light text-sauti-teal">{m.mode === "voice" ? <Mic className="h-4 w-4" /> : <Video className="h-4 w-4" />}</span>
								<span className="min-w-0"><span className="block truncate text-sm font-semibold">{m.title || (m.mode === "voice" ? "Voice call" : "Video call")}</span><span className="block text-xs text-serene-neutral-500">{format(new Date(m.created_at), "d MMM, h:mm a")} · {m.lines} lines</span></span>
							</button>
						</li>
					))}
				</ul>
			</aside>

			<section className="min-w-0 rounded-2xl border border-serene-neutral-200/70 bg-white p-5">
				{!code ? <p className="py-16 text-center text-sm text-serene-neutral-500">Choose a call to read its notes and transcript.</p> : !detail ? <MjengoLoader compact label="Opening the call" /> : (
					<div className="space-y-5">
						<header className="flex flex-wrap items-start justify-between gap-3">
							<div>
								<h3 className="text-lg font-semibold text-sauti-dark">{detail.title || (detail.mode === "voice" ? "Voice call" : "Video call")}</h3>
								<p className="text-sm text-serene-neutral-500">{format(new Date(detail.created_at), "EEEE d MMMM yyyy, h:mm a")}</p>
							</div>
							<div className="flex gap-2">
								<Button variant="outline" size="sm" className="gap-1.5" disabled={busy || detail.transcript.length < 3} onClick={async () => {
									setBusy(true);
									try { const notes = await unwrap(makeMeetingNotes(detail.code)); setDetail({ ...detail, notes }); toast({ title: "Notes written and shared" }); } catch (e) { toast({ title: "Could not write the notes", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setBusy(false); }
								}}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} {detail.notes ? "Write again" : "Write notes now"}</Button>
								<Button variant="outline" size="sm" className="gap-1.5" onClick={() => navigator.clipboard.writeText([detail.notes ?? "", "", ...detail.transcript.map((l) => `${l.name}: ${l.text}`)].join("\n")).then(() => toast({ title: "Copied" }))}><ClipboardCopy className="h-4 w-4" /> Copy</Button>
							</div>
						</header>

						<div className="space-y-3">
							<TagEditor type="meeting" id={detail.code} tags={detail.tags ?? []} onChange={(t) => { setDetail({ ...detail, tags: t }); setList((cur) => (cur ? cur.map((m) => (m.code === detail.code ? { ...m, tags: t } : m)) : cur)); }} />
							<SimilarItems type="meeting" id={detail.code} />
						</div>

						<div>
							<h4 className="mb-1 text-sm font-semibold">Notes</h4>
							{detail.notes ? <div className="rounded-xl bg-serene-neutral-50 p-4 text-sm leading-6"><Markdown text={detail.notes} /></div> : <p className="text-sm text-serene-neutral-500">{detail.transcript.length < 3 ? "There is not enough in the transcript to write notes." : "Notes appear here a few minutes after the call goes quiet, or write them now."}</p>}
						</div>

						<div>
							<h4 className="mb-1 text-sm font-semibold">Transcript</h4>
							{detail.transcript.length === 0 ? <p className="text-sm text-serene-neutral-500">Nothing was transcribed.</p> : (
								<ul className="max-h-[420px] space-y-2 overflow-y-auto rounded-xl border border-serene-neutral-100 p-3 text-sm">
									{detail.transcript.map((l) => <li key={l.id}><span className="font-semibold text-sauti-teal">{l.name}</span> <span className="text-serene-neutral-800">{l.text}</span></li>)}
								</ul>
							)}
						</div>
					</div>
				)}
			</section>
		</div>
	);
}

export default function MeetingsPage() {
	return <Suspense fallback={<MjengoLoader label="Loading calls" />}><Meetings /></Suspense>;
}
