"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { CalendarClock, CheckCircle2, CircleDot, FileText, Link2, Loader2, Paperclip, PencilLine, Phone, Plus, Search, Sparkles, Unlink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { briefTimeline, getTimeline, linkItem, linkables, unlinkItem, type Linkable } from "@/app/actions/mjengo-timeline";
import { unwrap } from "@/lib/action-result";
import type { Timeline, TimelineItem, TimelineKind } from "@/lib/mjengo/timeline";
import { Markdown } from "./Markdown";
import type { Kind } from "./shared";

const ICON: Record<TimelineKind, typeof CircleDot> = {
	added: Plus, status: CircleDot, change: PencilLine, document: Paperclip, requirement: FileText, todo: CircleDot,
	done: CheckCircle2, call: Phone, file: FileText, event: CalendarClock, date: CalendarClock,
};
const TONE: Partial<Record<TimelineKind, string>> = { status: "text-sauti-teal", done: "text-emerald-600", requirement: "text-amber-600", date: "text-amber-600", call: "text-sky-600" };

const when = (iso: string) => { try { return format(parseISO(iso), "d MMM yyyy"); } catch { return iso.slice(0, 10); } };

/**
 * The story of one grant, opportunity, project or fellowship: what is coming on top, then everything that happened,
 * newest first. Calls and files can be linked by hand (calls that name the record are linked by themselves), and
 * Salama can brief someone who is catching up.
 */
export function EntityTimeline({ kind, id }: { kind: Kind; id: string }) {
	const { toast } = useToast();
	const [tl, setTl] = useState<Timeline | null>(null);
	const [error, setError] = useState("");
	const [brief, setBrief] = useState<string | null>(null);
	const [briefing, setBriefing] = useState(false);
	const [picking, setPicking] = useState(false);

	const load = useCallback(async () => {
		try { setTl(await unwrap(getTimeline(kind, id))); setError(""); } catch (e) { setError(e instanceof Error ? e.message : "The timeline could not be loaded."); }
	}, [kind, id]);
	useEffect(() => { setBrief(null); void load(); }, [load]);

	const runBrief = async () => {
		setBriefing(true);
		try { setBrief(await unwrap(briefTimeline(kind, id))); } catch (e) { toast({ title: "Salama could not write the brief", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setBriefing(false); }
	};
	const unlink = async (i: TimelineItem) => {
		if (!i.ref) return;
		try { await unwrap(unlinkItem(kind, id, i.ref.type, i.ref.id)); await load(); } catch (e) { toast({ title: "Could not unlink it", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); }
	};

	const upcoming = tl?.items.filter((i) => i.upcoming) ?? [];
	const past = tl?.items.filter((i) => !i.upcoming) ?? [];

	const row = (i: TimelineItem) => {
		const Icon = ICON[i.kind];
		const body = (
			<>
				<p className="text-sm font-medium text-serene-neutral-900">{i.title}</p>
				{i.detail && <p className="mt-0.5 text-xs text-serene-neutral-600">{i.detail}</p>}
				<p className="mt-0.5 text-[11px] text-serene-neutral-500">{when(i.at)}{i.who ? ` · ${i.who}` : ""}{i.auto ? " · linked by Salama" : ""}</p>
			</>
		);
		return (
			<li key={i.id} className="group relative flex gap-3 pb-4 last:pb-0">
				<span className="absolute left-[13px] top-7 h-[calc(100%-1.5rem)] w-px bg-serene-neutral-200 group-last:hidden" aria-hidden />
				<span className={cn("z-10 mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-serene-neutral-200 bg-white", TONE[i.kind] ?? "text-serene-neutral-500")}><Icon className="h-3.5 w-3.5" /></span>
				<div className="min-w-0 flex-1">
					{i.link ? <Link href={i.link} className="block hover:opacity-80">{body}</Link> : body}
				</div>
				{i.ref && <button onClick={() => void unlink(i)} aria-label={`Unlink ${i.title}`} title="Unlink from this timeline" className="h-7 w-7 shrink-0 rounded-full text-serene-neutral-400 opacity-0 hover:bg-black/5 hover:text-serene-neutral-700 focus:opacity-100 group-hover:opacity-100 max-md:opacity-100"><Unlink className="mx-auto h-3.5 w-3.5" /></button>}
			</li>
		);
	};

	return (
		<div className="rounded-xl border border-serene-neutral-100 p-3">
			<div className="mb-2 flex flex-wrap items-center gap-2">
				<p className="mr-auto text-sm font-semibold text-serene-neutral-900">Timeline</p>
				<Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 rounded-full text-xs" onClick={() => setPicking((v) => !v)}><Link2 className="h-3.5 w-3.5" /> Link a call or file</Button>
				<Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 rounded-full text-xs" onClick={() => void runBrief()} disabled={briefing || !tl}>{briefing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-sauti-teal" />} Brief me</Button>
			</div>

			{brief && (
				<div className="mb-3 rounded-lg border border-[#b6e0e6] bg-[#f1fafb] p-3 text-sm text-serene-neutral-800">
					<div className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-sauti-teal"><Sparkles className="h-3.5 w-3.5" /> Salama<button onClick={() => setBrief(null)} aria-label="Close the brief" className="ml-auto rounded-full p-0.5 text-serene-neutral-500 hover:bg-black/5"><X className="h-3.5 w-3.5" /></button></div>
					<Markdown text={brief} />
				</div>
			)}
			{picking && <Linker kind={kind} id={id} onDone={() => { void load(); }} />}

			{error ? <p className="text-sm text-red-700">{error}</p> : !tl ? <Loader2 className="h-4 w-4 animate-spin text-serene-neutral-400" /> : (
				<>
					{upcoming.length > 0 && (
						<div className="mb-3">
							<p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-amber-700">Coming up</p>
							<ul>{upcoming.map(row)}</ul>
						</div>
					)}
					<p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-serene-neutral-500">What happened</p>
					<ul>{past.map(row)}</ul>
				</>
			)}
		</div>
	);
}

/** Pick calls, files and events to put on the timeline. */
function Linker({ kind, id, onDone }: { kind: Kind; id: string; onDone: () => void }) {
	const { toast } = useToast();
	const [q, setQ] = useState("");
	const [list, setList] = useState<Linkable[] | null>(null);
	const [busy, setBusy] = useState<string | null>(null);
	const load = useCallback(async (text: string) => {
		try { setList(await unwrap(linkables(kind, id, text))); } catch { setList([]); }
	}, [kind, id]);
	useEffect(() => { const t = setTimeout(() => void load(q), 200); return () => clearTimeout(t); }, [q, load]);

	const toggle = async (l: Linkable) => {
		setBusy(`${l.type}:${l.id}`);
		try {
			await unwrap(l.linked ? unlinkItem(kind, id, l.type, l.id) : linkItem(kind, id, l.type, l.id));
			await load(q);
			onDone();
		} catch (e) { toast({ title: "Could not change the link", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setBusy(null); }
	};
	return (
		<div className="mb-3 rounded-lg border border-serene-neutral-100 bg-serene-neutral-50/50 p-2">
			<div className="relative mb-2"><Search className="absolute left-2.5 top-2.5 h-4 w-4 text-serene-neutral-400" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search calls, files and events" aria-label="Search calls, files and events" className="h-9 pl-8" /></div>
			<ul className="max-h-52 space-y-0.5 overflow-y-auto">
				{list === null && <li className="p-2"><Loader2 className="h-4 w-4 animate-spin text-serene-neutral-400" /></li>}
				{list?.length === 0 && <li className="p-2 text-xs text-serene-neutral-500">Nothing found.</li>}
				{list?.map((l) => (
					<li key={`${l.type}:${l.id}`}>
						<button type="button" onClick={() => void toggle(l)} disabled={busy === `${l.type}:${l.id}`} className="flex w-full items-center gap-2 rounded-md p-2 text-left text-sm hover:bg-white">
							<span className="min-w-0 flex-1"><span className="block truncate font-medium text-serene-neutral-900">{l.title}</span><span className="block text-xs text-serene-neutral-500">{l.hint}</span></span>
							<span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium", l.linked ? "bg-sauti-teal-light text-sauti-teal" : "border border-serene-neutral-200 text-serene-neutral-600")}>{busy === `${l.type}:${l.id}` ? "…" : l.linked ? "Linked" : "Link"}</span>
						</button>
					</li>
				))}
			</ul>
		</div>
	);
}
