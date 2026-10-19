"use client";

import { useEffect, useState } from "react";
import { Loader2, Shapes, Sparkles, Tag as TagIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { autoTagItem, facets, setTags, similarTo, type Facets } from "@/app/actions/mjengo-search";
import { SEARCH_TYPE_LABEL, type SearchHit, type SearchType } from "@/lib/mjengo/search-shared";

let cache: Promise<Facets> | null = null;
/** The tags in use and the team, loaded once and shared by every filter bar on the page. */
export function useFacets(): Facets | null {
	const [f, setF] = useState<Facets | null>(null);
	useEffect(() => {
		let on = true;
		(cache ??= unwrap(facets()).catch((e) => { cache = null; throw e; })).then((x) => on && setF(x)).catch(() => undefined);
		return () => { on = false; };
	}, []);
	return f;
}
/** After tags change anywhere, the next filter bar reads them again. */
export const forgetFacets = () => { cache = null; };

export const tagLabel = (t: string) => t.replace(/-/g, " ");

/** A row of tags to filter by: tap to select, tap again to clear. Only tags that exist are offered. */
export function TagFilter({ selected, onChange, limit = 14, extra = [], className }: { selected: string[]; onChange: (tags: string[]) => void; limit?: number; /** Tags seen on the results on screen, offered even if they are newer than the list loaded with the page. */ extra?: string[]; className?: string }) {
	const f = useFacets();
	const [all, setAll] = useState(false);
	const known = new Map((f?.tags ?? []).map((t) => [t.tag, t.count]));
	for (const t of [...selected, ...extra]) if (!known.has(t)) known.set(t, 1);
	const tags = [...known.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => Number(selected.includes(b.tag)) - Number(selected.includes(a.tag)) || b.count - a.count || a.tag.localeCompare(b.tag));
	if (!tags.length) return null;
	const f2 = { tags };
	const shown = all ? f2.tags : f2.tags.slice(0, limit);
	const toggle = (t: string) => onChange(selected.includes(t) ? selected.filter((x) => x !== t) : [...selected, t]);
	return (
		<div className={cn("flex flex-wrap items-center gap-1.5", className)} role="group" aria-label="Filter by tag">
			<TagIcon className="h-3.5 w-3.5 text-serene-neutral-400" aria-hidden />
			{shown.map(({ tag, count }) => (
				<button key={tag} type="button" aria-pressed={selected.includes(tag)} onClick={() => toggle(tag)} className={cn("rounded-full border px-2.5 py-0.5 text-xs transition-colors", selected.includes(tag) ? "border-sauti-teal bg-sauti-teal text-white" : "border-serene-neutral-200 bg-white text-serene-neutral-700 hover:bg-serene-neutral-50")}>
					{tagLabel(tag)} <span className={cn("tabular-nums", selected.includes(tag) ? "text-white/80" : "text-serene-neutral-400")}>{count}</span>
				</button>
			))}
			{f2.tags.length > limit && <button type="button" onClick={() => setAll((v) => !v)} className="rounded-full px-2 py-0.5 text-xs text-sauti-teal hover:underline">{all ? "Fewer" : `All ${f2.tags.length}`}</button>}
			{selected.length > 0 && <button type="button" onClick={() => onChange([])} className="rounded-full px-2 py-0.5 text-xs text-serene-neutral-500 hover:underline">Clear</button>}
		</div>
	);
}

/** A team member to filter by (owner, lead, assignee, someone it is shared with, someone who was on the call). */
export function MemberFilter({ value, onChange, label = "Anyone", className }: { value: string | null; onChange: (id: string | null) => void; label?: string; className?: string }) {
	const f = useFacets();
	if (!f) return null;
	return (
		<select value={value ?? ""} onChange={(e) => onChange(e.target.value || null)} aria-label="Filter by team member" className={cn("h-9 rounded-full border border-serene-neutral-200 bg-white px-3 text-sm text-serene-neutral-800 outline-none focus:border-sauti-teal", className)}>
			<option value="">{label}</option>
			{f.members.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
		</select>
	);
}

/** Tags on one item: shown, changed and suggested by the autotagger. Saves as you go. */
export function TagEditor({ type, id, tags, onChange, canEdit = true }: { type: SearchType; id: string; tags: string[]; onChange?: (tags: string[]) => void; canEdit?: boolean }) {
	const [list, setList] = useState(tags);
	const [draft, setDraft] = useState("");
	const [busy, setBusy] = useState<"save" | "auto" | null>(null);
	const [error, setError] = useState("");
	useEffect(() => setList(tags), [tags]);

	// A change shows at once and is put back if it could not be saved (saving waits behind other calls the page is making).
	const save = async (next: string[]) => {
		const before = list;
		setBusy("save"); setError(""); setList([...new Set(next)]);
		try { const saved = await unwrap(setTags(type, id, next)); setList(saved); onChange?.(saved); forgetFacets(); } catch (e) { setList(before); setError(e instanceof Error ? e.message : "Could not save the tags."); } finally { setBusy(null); }
	};
	const suggest = async () => {
		setBusy("auto"); setError("");
		try { const saved = await unwrap(autoTagItem(type, id)); setList(saved); onChange?.(saved); forgetFacets(); } catch (e) { setError(e instanceof Error ? e.message : "The autotagger could not read this."); } finally { setBusy(null); }
	};
	const add = () => { const t = draft.trim(); setDraft(""); if (t) void save([...list, t]); };

	return (
		<div>
			<div className="flex flex-wrap items-center gap-1.5">
				{list.map((t) => (
					<span key={t} className="flex items-center gap-1 rounded-full bg-sauti-teal-light py-0.5 pl-2.5 pr-1 text-xs font-medium text-sauti-teal">{tagLabel(t)}{canEdit && <button type="button" aria-label={`Remove the tag ${tagLabel(t)}`} onClick={() => void save(list.filter((x) => x !== t))} className="rounded-full p-0.5 hover:bg-black/10"><X className="h-3 w-3" /></button>}</span>
				))}
				{list.length === 0 && <span className="text-xs text-serene-neutral-500">No tags yet.</span>}
				{canEdit && (
					<>
						<input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); add(); } }} placeholder="Add a tag" aria-label="Add a tag" className="h-7 w-28 rounded-full border border-serene-neutral-200 px-2.5 text-xs outline-none focus:border-sauti-teal" />
						<button type="button" onClick={() => void suggest()} disabled={busy !== null} className="flex h-7 items-center gap-1 rounded-full border border-serene-neutral-200 px-2.5 text-xs text-sauti-teal hover:bg-serene-neutral-50 disabled:opacity-50">{busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />} Suggest tags</button>
					</>
				)}
			</div>
			{error && <p className="mt-1 text-xs text-red-700">{error}</p>}
		</div>
	);
}

/** Things that read like this one, on demand: other grants like this grant, documents like this document. */
export function SimilarItems({ type, id }: { type: SearchType; id: string }) {
	const [hits, setHits] = useState<SearchHit[] | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	useEffect(() => { setHits(null); setError(""); }, [type, id]);
	const run = async () => {
		setBusy(true); setError("");
		try { setHits(await unwrap(similarTo(type, id))); } catch (e) { setError(e instanceof Error ? e.message : "Could not look for similar things."); } finally { setBusy(false); }
	};
	return (
		<div className="rounded-xl border border-serene-neutral-100 p-3">
			<div className="flex items-center gap-2">
				<p className="mr-auto flex items-center gap-1.5 text-sm font-semibold text-serene-neutral-900"><Shapes className="h-4 w-4 text-sauti-teal" /> Similar</p>
				<button type="button" onClick={() => void run()} disabled={busy} className="flex h-8 items-center gap-1.5 rounded-full border border-serene-neutral-200 px-3 text-xs text-sauti-teal hover:bg-serene-neutral-50 disabled:opacity-50">{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} {hits ? "Look again" : "Find similar"}</button>
			</div>
			{error && <p className="mt-2 text-xs text-red-700">{error}</p>}
			{hits && (hits.length === 0 ? <p className="mt-2 text-xs text-serene-neutral-500">Nothing else reads like this yet.</p> : (
				<ul className="mt-2 space-y-1.5">{hits.map((h) => <li key={`${h.type}:${h.id}`} className="text-sm"><a href={h.link ?? "#"} className="font-medium text-sauti-teal hover:underline">{h.title}</a> <span className="text-xs text-serene-neutral-500">{SEARCH_TYPE_LABEL[h.type]}</span><span className="block truncate text-xs text-serene-neutral-600">{h.snippet}</span></li>)}</ul>
			))}
		</div>
	);
}
