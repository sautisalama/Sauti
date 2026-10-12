"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { ChevronDown, LayoutGrid, List as ListIcon, Palette, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { deleteTemplate, listTemplates, type TemplateRow } from "@/app/actions/mjengo-templates";
import { listAssets, type AssetRow } from "@/app/actions/mjengo-ai";
import { MjengoLoader } from "../_components/MjengoLoader";
import { pinterestSearch, type Pin } from "@/app/actions/mjengo-assist";
import { inspireSearch } from "@/app/actions/mjengo-inspire";
import type { InspireSource } from "@/lib/mjengo/inspire-sources";
import { Input } from "@/components/ui/input";
import ContentPanel from "../content/page";
import { ASPECT, CATEGORIES, TEMPLATES } from "@/lib/mjengo/design-templates";
import { TemplatePreview } from "@/components/design/TemplatePreview";
import { SizeMock } from "@/components/design/SizeMock";
import { CONCEPTS, MOODS, conceptTemplate, generateTemplate } from "@/lib/mjengo/design-generator";
import type { SizeId } from "@/lib/mjengo/design-templates";

const SIZES = [
	{ id: "instagram", label: "Instagram post", note: "1080 x 1080", w: 1080, h: 1080 },
	{ id: "story", label: "Story or reel", note: "1080 x 1920", w: 1080, h: 1920 },
	{ id: "tiktok", label: "TikTok photo", note: "1080 x 1920", w: 1080, h: 1920 },
	{ id: "linkedin", label: "LinkedIn post", note: "1200 x 627", w: 1200, h: 627 },
	{ id: "facebook", label: "Facebook post", note: "1200 x 630", w: 1200, h: 630 },
	{ id: "x", label: "X post", note: "1600 x 900", w: 1600, h: 900 },
	{ id: "poster", label: "A4 poster", note: "1240 x 1754", w: 1240, h: 1754 },
];

function Fold({ id, title, count, right, open, onToggle, children }: { id: string; title: string; count?: number; right?: React.ReactNode; open: boolean; onToggle: (id: string, next: boolean) => void; children: React.ReactNode }) {
	return (
		<section aria-label={title} className="space-y-2">
			<div className="flex flex-wrap items-center gap-2">
				<button type="button" onClick={() => onToggle(id, !open)} aria-expanded={open} className="mr-auto flex items-center gap-1.5 rounded-lg px-1 py-0.5 text-base font-semibold text-sauti-dark hover:bg-serene-neutral-100">
					<ChevronDown className={cn("h-4 w-4 text-serene-neutral-500 transition-transform", !open && "-rotate-90")} />
					{title}
					{count !== undefined && <span className="rounded-full bg-serene-neutral-100 px-2 py-0.5 text-xs font-medium text-serene-neutral-600">{count}</span>}
				</button>
				{open && right}
			</div>
			{open && children}
		</section>
	);
}

/** Design: start from a size or template, pick up a saved design, and schedule what you make. */
export default function DesignHome() {
	const { toast } = useToast();
	const [rows, setRows] = useState<TemplateRow[] | null>(null);
	const [assets, setAssets] = useState<AssetRow[]>([]);
	const [view, setView] = useState<"grid" | "list">("grid");
	const [closed, setClosed] = useState<Record<string, boolean>>(() => {
		if (typeof window === "undefined") return {};
		try { return JSON.parse(localStorage.getItem("ss_design_fold") ?? "{}"); } catch { return {}; }
	});

	useEffect(() => {
		unwrap(listTemplates("design")).then(setRows).catch(() => setRows([]));
		unwrap(listAssets()).then(setAssets).catch(() => setAssets([]));
		try { const v = localStorage.getItem("ss_design_view"); if (v === "grid" || v === "list") setView(v); } catch { /* default */ }
	}, []);

	// Pinterest suggestions, when the site is connected to Pinterest.
	const [pins, setPins] = useState<Pin[] | null>(null);
	const [pinErr, setPinErr] = useState<string | null>(null);
	const [pinQ, setPinQ] = useState("");
	const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("All");
	const [ideas, setIdeas] = useState(12);
	const [shuffle, setShuffle] = useState(0);
	const [mood, setMood] = useState("All");
	const [src, setSrc] = useState<"pinterest" | InspireSource>("pinterest");
	const searchPins = (q: string, from: "pinterest" | InspireSource = src) => {
		setPins(null); setPinErr(null);
		const job = from === "pinterest"
			? unwrap(pinterestSearch(q))
			: unwrap(inspireSearch(from, q || "poster design")).then((r): Pin[] => r.map((x) => ({ id: x.id, title: x.title, image: x.full, link: x.link })));
		job.then(setPins).catch((e) => { setPins([]); setPinErr(e instanceof Error ? e.message : "Could not load suggestions."); });
	};
	useEffect(() => { searchPins("social media poster design"); }, []);

	const isOpen = (id: string) => !closed[id];
	const toggle = (id: string, next: boolean) => {
		const n = { ...closed, [id]: !next };
		setClosed(n);
		try { localStorage.setItem("ss_design_fold", JSON.stringify(n)); } catch { /* ignore */ }
	};
	const changeView = (v: "grid" | "list") => { setView(v); try { localStorage.setItem("ss_design_view", v); } catch { /* ignore */ } };

	// A link from a notification or the calendar: /design#schedule scrolls to the scheduling section.
	useEffect(() => {
		if (window.location.hash === "#schedule") setTimeout(() => document.getElementById("schedule")?.scrollIntoView({ behavior: "smooth" }), 400);
	}, [rows]);

	if (!rows) return <MjengoLoader label="Opening Design" />;
	const designs = rows.filter((r) => !(r.data as { template?: boolean }).template);
	const templates = rows.filter((r) => (r.data as { template?: boolean }).template);
	const remove = async (r: TemplateRow) => {
		if (!window.confirm(`Delete ${r.name}?`)) return;
		try { await unwrap(deleteTemplate(r.id)); setRows((cur) => cur?.filter((x) => x.id !== r.id) ?? cur); } catch (e) { toast({ title: "Could not delete", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); }
	};

	return (
		<div className="mx-auto max-w-6xl space-y-5">
			<div>
				<h2 className="text-xl font-bold tracking-tight text-sauti-dark">Design</h2>
				<p className="text-sm text-serene-neutral-500">Make posters, banners and social graphics, then schedule them to your networks.</p>
			</div>

			<Fold id="start" title="Start a design" open={isOpen("start")} onToggle={toggle}>
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
					{SIZES.map((s) => (
						<Link key={s.id} href={`/dashboard/mjengo/design/editor?size=${s.id}`} className="group flex flex-col items-center gap-2 rounded-2xl border border-serene-neutral-200/70 bg-[#F6F6F4] p-3 text-center transition hover:-translate-y-0.5 hover:border-[#7D2AE8]/50 hover:bg-white hover:shadow-md">
							<span className="flex h-[112px] w-full items-center justify-center rounded-xl bg-white/70">
								<SizeMock size={s.id as SizeId} className="transition-transform group-hover:scale-105" />
							</span>
							<span className="text-xs font-semibold text-serene-neutral-800">{s.label}</span>
							<span className="text-[11px] text-serene-neutral-500">{s.note}</span>
						</Link>
					))}
				</div>
			</Fold>

			<Fold id="templates" title="Templates" count={TEMPLATES.length - 1 + templates.length} open={isOpen("templates")} onToggle={toggle}>
				<div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
					{CATEGORIES.map((c) => (
						<button key={c} onClick={() => setCat(c)} aria-pressed={cat === c} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition", cat === c ? "border-[#7D2AE8] bg-[#7D2AE8] text-white" : "border-serene-neutral-200 bg-white text-serene-neutral-700 hover:border-[#7D2AE8]/50")}>{c}</button>
					))}
				</div>
				<div className="columns-2 gap-4 sm:columns-3 lg:columns-5">
					{TEMPLATES.filter((t) => t.id !== "plain" && (cat === "All" || t.category === cat)).map((t) => (
						<Link key={t.id} href={`/dashboard/mjengo/design/editor?template=${t.id}&size=${t.size}`} className="group mb-4 block break-inside-avoid">
							<span className="block transition group-hover:-translate-y-0.5 group-hover:[&>div]:ring-[#7D2AE8] group-hover:[&>div]:shadow-md"><TemplatePreview template={t} /></span>
							<span className="mt-1.5 block truncate text-sm font-medium text-serene-neutral-800">{t.name}</span>
							<span className="block text-xs text-serene-neutral-500">{t.category} · {ASPECT[t.size].w} x {ASPECT[t.size].h}</span>
						</Link>
					))}
					{Array.from({ length: ideas }).map((_, i) => {
						const t = generateTemplate(1000 + i + shuffle * 97, cat === "All" ? {} : { category: cat });
						return (
							<Link key={`${t.id}-${i}`} href={`/dashboard/mjengo/design/editor?template=${t.id}&size=${t.size}`} className="group mb-4 block break-inside-avoid">
								<span className="block transition group-hover:-translate-y-0.5 group-hover:[&>div]:ring-[#7D2AE8] group-hover:[&>div]:shadow-md"><TemplatePreview template={t} /></span>
								<span className="mt-1.5 block truncate text-sm font-medium text-serene-neutral-800">{t.name}</span>
								<span className="block text-xs text-serene-neutral-500">{t.category} · fresh idea</span>
							</Link>
						);
					})}
					{cat === "All" && templates.map((t) => (
						<div key={t.id} className="group relative mb-4 break-inside-avoid">
							<Link href={`/dashboard/mjengo/design/editor?id=${t.id}&copy=1`} className="block">
								{(t.data as { thumb?: string }).thumb ? <img src={(t.data as { thumb: string }).thumb} alt="" className="w-full rounded-lg bg-white shadow-sm ring-1 ring-black/5 transition group-hover:ring-[#7D2AE8]" /> : <span className="block aspect-square rounded-lg bg-serene-neutral-100" />}
								<span className="mt-1.5 block truncate text-sm font-medium text-serene-neutral-800">{t.name}</span>
								<span className="block text-xs text-serene-neutral-500">Your template</span>
							</Link>
							<button aria-label={`Delete ${t.name}`} onClick={() => remove(t)} className="absolute right-1.5 top-1.5 hidden h-7 w-7 items-center justify-center rounded-md bg-white text-red-600 shadow group-hover:flex"><Trash2 className="h-3.5 w-3.5" /></button>
						</div>
					))}
				</div>
				<div className="flex flex-wrap justify-center gap-2 pt-1">
					<Button variant="outline" onClick={() => setIdeas((n) => n + 12)}>Show more ideas</Button>
					<Button variant="ghost" onClick={() => { setShuffle((n) => n + 1); setIdeas(12); }}>Shuffle</Button>
				</div>
			</Fold>

			<Fold id="inspire" title="Inspiration" open={isOpen("inspire")} onToggle={toggle} right={
				<form className="flex flex-wrap items-center gap-1.5" onSubmit={(e) => { e.preventDefault(); searchPins(pinQ); }}>
					<select value={src} onChange={(e) => { const v = e.target.value as "pinterest" | InspireSource; setSrc(v); searchPins(pinQ || "social media poster design", v); }} aria-label="Source" className="h-8 rounded-md border border-serene-neutral-200 bg-white px-2 text-sm">
						<option value="pinterest">Pinterest</option><option value="unsplash">Unsplash</option><option value="pexels">Pexels</option><option value="pixabay">Pixabay</option><option value="openverse">Openverse</option>
					</select>
					<Input value={pinQ} onChange={(e) => setPinQ(e.target.value)} placeholder="Search ideas" aria-label="Search Pinterest" className="h-8 w-44 text-sm" />
					<Button type="submit" size="sm" variant="outline" className="h-8">Search</Button>
				</form>
			}>
				<div className="mb-5">
					<div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
						{MOODS.map((m) => (
							<button key={m} onClick={() => setMood(m)} aria-pressed={mood === m} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition", mood === m ? "border-[#7D2AE8] bg-[#7D2AE8] text-white" : "border-serene-neutral-200 bg-white text-serene-neutral-700 hover:border-[#7D2AE8]/50")}>{m}</button>
						))}
					</div>
					<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
						{CONCEPTS.filter((c) => mood === "All" || c.mood === mood).map((c, i) => (
							<Link key={c.id} href={`/dashboard/mjengo/design/editor?concept=${c.id}&variant=${i}&size=instagram`} className="group block">
								<span className="block transition group-hover:-translate-y-0.5 group-hover:[&>div]:ring-[#7D2AE8] group-hover:[&>div]:shadow-md"><TemplatePreview template={conceptTemplate(c.id, "instagram", i)} /></span>
								<span className="mt-1.5 flex items-center gap-1.5">
									<span className="truncate text-sm font-medium text-serene-neutral-800">{c.name}</span>
									<span className="ml-auto flex shrink-0">{[c.bg, c.accent, c.accent2, c.ink].map((col, k) => <i key={k} className="-ml-1 h-3 w-3 rounded-full ring-1 ring-white first:ml-0" style={{ background: col }} />)}</span>
								</span>
								<span className="block truncate text-xs text-serene-neutral-500">{c.mood} · {c.head}</span>
							</Link>
						))}
					</div>
				</div>
				<p className="mb-2 text-xs font-semibold uppercase tracking-wider text-serene-neutral-500">Photos and pins</p>
				{pinErr ? (
					<p className="rounded-2xl border border-dashed border-serene-neutral-200 bg-white p-4 text-center text-sm text-serene-neutral-500">{pinErr}</p>
				) : !pins ? <MjengoLoader compact label="Finding ideas" /> : pins.length === 0 ? (
					<p className="rounded-2xl border border-dashed border-serene-neutral-200 bg-white p-6 text-center text-sm text-serene-neutral-500">No suggestions for that search.</p>
				) : (
					<div className="columns-2 gap-3 sm:columns-3 lg:columns-5">
						{pins.map((p) => (
							<Link key={p.id} href={`/dashboard/mjengo/design/editor?inspire=${encodeURIComponent(p.image)}&size=instagram`} className="group mb-3 block break-inside-avoid overflow-hidden rounded-xl border border-serene-neutral-200/70 bg-white transition hover:border-[#7D2AE8]/50 hover:shadow-sm">
								<img src={p.image} alt={p.title} className="w-full" loading="lazy" />
								<span className="block truncate px-2 py-1.5 text-xs text-serene-neutral-600">Start from this: {p.title}</span>
							</Link>
						))}
					</div>
				)}
			</Fold>

			<Fold
				id="recent"
				title="Your designs"
				count={designs.length}
				open={isOpen("recent")}
				onToggle={toggle}
				right={
					<div className="inline-flex rounded-lg border border-serene-neutral-200 bg-white p-0.5" role="group" aria-label="View">
						<button onClick={() => changeView("list")} aria-pressed={view === "list"} aria-label="List" className={cn("flex h-7 w-7 items-center justify-center rounded-md", view === "list" ? "bg-sauti-teal text-white" : "text-serene-neutral-600")}><ListIcon className="h-4 w-4" /></button>
						<button onClick={() => changeView("grid")} aria-pressed={view === "grid"} aria-label="Grid" className={cn("flex h-7 w-7 items-center justify-center rounded-md", view === "grid" ? "bg-sauti-teal text-white" : "text-serene-neutral-600")}><LayoutGrid className="h-4 w-4" /></button>
					</div>
				}
			>
				{designs.length === 0 ? (
					<div className="rounded-2xl border border-dashed border-serene-neutral-200 bg-white p-10 text-center">
						<span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sauti-teal-light text-sauti-teal"><Palette className="h-6 w-6" /></span>
						<p className="text-sm font-medium text-sauti-dark">No designs yet</p>
						<p className="mt-1 text-sm text-serene-neutral-500">Pick a size above and save your work. It will be here.</p>
					</div>
				) : view === "grid" ? (
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
						{designs.map((d) => (
							<div key={d.id} className="group relative overflow-hidden rounded-2xl border border-serene-neutral-200/70 bg-white transition hover:border-[#7D2AE8]/50 hover:shadow-sm">
								<Link href={`/dashboard/mjengo/design/editor?id=${d.id}`} className="block">
									{(d.data as { thumb?: string }).thumb ? <img src={(d.data as { thumb: string }).thumb} alt="" className="aspect-square w-full bg-serene-neutral-50 object-contain" /> : <span className="block aspect-square bg-serene-neutral-100" />}
									<span className="block truncate px-3 pb-2 pt-2 text-sm font-medium">{d.name}</span>
								</Link>
								<button aria-label={`Delete ${d.name}`} onClick={() => remove(d)} className="absolute right-1.5 top-1.5 hidden h-7 w-7 items-center justify-center rounded-md bg-white text-red-600 shadow group-hover:flex"><Trash2 className="h-3.5 w-3.5" /></button>
							</div>
						))}
					</div>
				) : (
					<div className="overflow-hidden rounded-2xl border border-serene-neutral-200/70 bg-white">
						<ul className="divide-y divide-serene-neutral-50">
							{designs.map((d) => (
								<li key={d.id} className="flex items-center gap-3 p-3 hover:bg-serene-neutral-50/60">
									<Link href={`/dashboard/mjengo/design/editor?id=${d.id}`} className="flex min-w-0 flex-1 items-center gap-3">
										{(d.data as { thumb?: string }).thumb ? <img src={(d.data as { thumb: string }).thumb} alt="" className="h-12 w-12 rounded-lg object-cover" /> : <span className="h-12 w-12 rounded-lg bg-serene-neutral-100" />}
										<span className="truncate text-sm font-medium">{d.name}</span>
									</Link>
									<button aria-label={`Delete ${d.name}`} onClick={() => remove(d)} className="flex h-8 w-8 items-center justify-center rounded-md text-serene-neutral-400 hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
								</li>
							))}
						</ul>
					</div>
				)}
			</Fold>

			<Fold id="studio" title="Pictures in Studio" count={assets.length} open={isOpen("studio")} onToggle={toggle}>
				{assets.length === 0 ? <p className="rounded-2xl border border-dashed border-serene-neutral-200 bg-white p-8 text-center text-sm text-serene-neutral-500">Pictures from the assistant and saved designs collect here.</p> : (
					<ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
						{assets.slice(0, 16).map((a) => <li key={a.id} className="overflow-hidden rounded-xl border border-serene-neutral-200/70 bg-white">{a.url ? <img src={a.url} alt={a.name} className="aspect-square w-full object-cover" /> : <span className="block aspect-square bg-serene-neutral-100" />}<span className="block truncate px-2 py-1 text-[11px] text-serene-neutral-500">{format(new Date(a.created_at), "d MMM")}</span></li>)}
					</ul>
				)}
			</Fold>

			<div id="schedule" />
			<Fold id="schedule" title="Schedule content" open={isOpen("schedule")} onToggle={toggle} right={<span className="text-xs text-serene-neutral-500">Posts, accounts and the calendar of what goes out</span>}>
				<ContentPanel />
			</Fold>
		</div>
	);
}
