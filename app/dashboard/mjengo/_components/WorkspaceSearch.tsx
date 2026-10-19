"use client";

import { Fragment, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Briefcase, CalendarDays, CheckSquare, FileText, FolderKanban, GraduationCap, Lightbulb, Loader2, Phone, Search, Shapes, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { searchAll, similarTo } from "@/app/actions/mjengo-search";
import { SEARCH_TYPE_LABEL, type SearchHit, type SearchResult, type SearchType } from "@/lib/mjengo/search-shared";
import { MemberFilter, TagFilter, tagLabel } from "./Facets";

const ICON: Record<SearchType, typeof FileText> = { file: FileText, meeting: Phone, todo: CheckSquare, event: CalendarDays, grant: Briefcase, opportunity: Lightbulb, project: FolderKanban, fellowship: GraduationCap };
const TYPE_CHIPS: SearchType[] = ["file", "meeting", "grant", "opportunity", "project", "fellowship", "todo", "event"];

/** The snippet with the typed fragment picked out. */
function Marked({ text, hit }: { text: string; hit: string | null }) {
	if (!hit) return <>{text}</>;
	const at = text.toLowerCase().indexOf(hit.toLowerCase());
	if (at < 0) return <>{text}</>;
	return <>{text.slice(0, at)}<mark className="rounded bg-yellow-200 px-0.5 text-inherit">{text.slice(at, at + hit.length)}</mark>{text.slice(at + hit.length)}</>;
}

function Row({ h, onTag, onSimilar, similarOpen }: { h: SearchHit; onTag: (t: string) => void; onSimilar: () => void; similarOpen: boolean }) {
	const Icon = ICON[h.type];
	return (
		<li className="rounded-xl border border-serene-neutral-200/70 bg-white p-3 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
			<div className="flex items-start gap-3">
				<span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sauti-teal-light text-sauti-teal"><Icon className="h-4 w-4" /></span>
				<div className="min-w-0 flex-1">
					<div className="flex flex-wrap items-baseline gap-x-2">
						{h.link ? <Link href={h.link} className="text-sm font-semibold text-serene-neutral-900 hover:underline">{h.title}</Link> : <span className="text-sm font-semibold text-serene-neutral-900">{h.title}</span>}
						<span className="text-[11px] text-serene-neutral-500">{SEARCH_TYPE_LABEL[h.type]}</span>
						<span className={cn("rounded-full px-1.5 py-px text-[10px] font-medium", h.via === "meaning" ? "bg-sky-50 text-sky-700" : h.via === "text" ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700")}>{h.via === "meaning" ? "by meaning" : h.via === "text" ? "exact words" : "words and meaning"}</span>
					</div>
					<p className="mt-1 text-sm leading-relaxed text-serene-neutral-700"><Marked text={h.snippet} hit={h.hit} /></p>
					<div className="mt-1.5 flex flex-wrap items-center gap-1.5">
						{h.tags.slice(0, 6).map((t) => <button key={t} type="button" onClick={() => onTag(t)} className="rounded-full bg-serene-neutral-100 px-2 py-0.5 text-[11px] text-serene-neutral-600 hover:bg-sauti-teal-light hover:text-sauti-teal">{tagLabel(t)}</button>)}
						{h.people.length > 0 && <span className="text-[11px] text-serene-neutral-500">{h.people.map((p) => p.name).join(", ")}</span>}
						<button type="button" onClick={onSimilar} aria-expanded={similarOpen} className="ml-auto flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium text-sauti-teal hover:bg-sauti-teal-light"><Shapes className="h-3 w-3" /> {similarOpen ? "Hide similar" : "Find similar"}</button>
					</div>
				</div>
			</div>
		</li>
	);
}

/**
 * Search everything the team has written: a question in your own words finds what it is about, and any fragment of a
 * sentence finds the document that holds it. Narrow by kind, tag and team member; "Find similar" shows things that read
 * like a result. You only ever see what you may open.
 */
export function WorkspaceSearch() {
	const [q, setQ] = useState("");
	const [types, setTypes] = useState<SearchType[]>([]);
	const [tags, setTags] = useState<string[]>([]);
	const [member, setMember] = useState<string | null>(null);
	const [res, setRes] = useState<SearchResult | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	const [similar, setSimilar] = useState<{ key: string; hits: SearchHit[] | null } | null>(null);
	const seq = useRef(0);
	const [tick, setTick] = useState(0);
	const retries = useRef(0);
	const isRetry = useRef(false);

	useEffect(() => {
		const text = q.trim();
		if (text.length < 2) { setRes(null); setError(""); return; }
		const mine = ++seq.current;
		const retry = isRetry.current;
		isRetry.current = false;
		if (!retry) retries.current = 0;
		setBusy(true);
		const t = setTimeout(() => {
			unwrap(searchAll(text, { types, tags, member }))
				.then((r) => { if (seq.current === mine) { setRes(r); setError(""); if (!retry) setSimilar(null); } })
				.catch((e) => { if (seq.current === mine) setError(e instanceof Error ? e.message : "Search is not available right now."); })
				.finally(() => { if (seq.current === mine) setBusy(false); });
		}, 350);
		return () => clearTimeout(t);
		// ... while things are still being read into the search, look again every few seconds (a few times).
	}, [q, types, tags, member, tick]);
	useEffect(() => {
		if (!res || res.pending <= 0 || retries.current >= 8) return;
		const t = setTimeout(() => { retries.current += 1; isRetry.current = true; setTick((n) => n + 1); }, 6000);
		return () => clearTimeout(t);
	}, [res]);

	const openSimilar = (h: SearchHit) => {
		const key = `${h.type}:${h.id}`;
		if (similar?.key === key) { setSimilar(null); return; }
		setSimilar({ key, hits: null });
		unwrap(similarTo(h.type, h.id, { tags, member })).then((hits) => setSimilar((s) => (s?.key === key ? { key, hits } : s))).catch(() => setSimilar((s) => (s?.key === key ? { key, hits: [] } : s)));
	};
	const filtered = types.length > 0 || tags.length > 0 || !!member;

	return (
		<section aria-label="Search" className="space-y-3">
			<div className="relative">
				<Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-serene-neutral-400" aria-hidden />
				<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search everything: a question, a name, or any words from inside a document" aria-label="Search everything" className="h-12 w-full rounded-2xl border border-serene-neutral-200 bg-white pl-12 pr-24 text-base shadow-[0_1px_2px_rgba(16,24,40,0.04)] outline-none focus:border-sauti-teal" />
				<div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-2">
					{busy && <Loader2 className="h-4 w-4 animate-spin text-serene-neutral-400" />}
					{q && <button type="button" onClick={() => setQ("")} aria-label="Clear the search" className="flex h-7 w-7 items-center justify-center rounded-full text-serene-neutral-500 hover:bg-black/5"><X className="h-4 w-4" /></button>}
				</div>
			</div>

			{(q.trim().length >= 2 || filtered) && (
				<div className="space-y-2">
					<div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filter by kind">
						{TYPE_CHIPS.map((t) => <button key={t} type="button" aria-pressed={types.includes(t)} onClick={() => setTypes((cur) => (cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t]))} className={cn("rounded-full border px-2.5 py-0.5 text-xs", types.includes(t) ? "border-sauti-teal bg-sauti-teal text-white" : "border-serene-neutral-200 bg-white text-serene-neutral-700 hover:bg-serene-neutral-50")}>{SEARCH_TYPE_LABEL[t]}s</button>)}
						<MemberFilter value={member} onChange={setMember} label="Anyone on the team" className="ml-auto" />
					</div>
					<TagFilter selected={tags} onChange={setTags} extra={res?.hits.flatMap((h) => h.tags) ?? []} />
				</div>
			)}

			{error && <p className="text-sm text-red-700">{error}</p>}
			{res && !error && (
				<div className="space-y-2">
					<p className="px-1 text-xs text-serene-neutral-500">
						{res.hits.length ? `${res.hits.length} ${res.hits.length === 1 ? "result" : "results"}` : "Nothing found"}
						{res.lexicalOnly ? ". Searching by exact words only right now." : ""}
						{res.pending > 0 ? `. Still reading ${res.pending} ${res.pending === 1 ? "item" : "items"} into the search, so more may appear.` : ""}
					</p>
					<ul className="space-y-2">
						{res.hits.map((h) => (
							<Fragment key={`${h.type}:${h.id}`}>
								<Row h={h} onTag={(t) => setTags((cur) => (cur.includes(t) ? cur : [...cur, t]))} onSimilar={() => openSimilar(h)} similarOpen={similar?.key === `${h.type}:${h.id}`} />
								{similar?.key === `${h.type}:${h.id}` && (
									<li className="ml-6 rounded-xl border border-dashed border-serene-neutral-200 bg-serene-neutral-50/60 p-3">
										<p className="mb-2 text-xs font-semibold text-serene-neutral-600">Similar to {h.title}</p>
										{similar.hits === null ? <Loader2 className="h-4 w-4 animate-spin text-serene-neutral-400" /> : similar.hits.length === 0 ? <p className="text-xs text-serene-neutral-500">Nothing else reads like this yet.</p> : (
											<ul className="space-y-1.5">{similar.hits.map((s) => <li key={`${s.type}:${s.id}`} className="text-sm"><Link href={s.link ?? "#"} className="font-medium text-sauti-teal hover:underline">{s.title}</Link> <span className="text-xs text-serene-neutral-500">{SEARCH_TYPE_LABEL[s.type]}</span><span className="block truncate text-xs text-serene-neutral-600">{s.snippet}</span></li>)}</ul>
										)}
									</li>
								)}
							</Fragment>
						))}
					</ul>
				</div>
			)}
		</section>
	);
}
