"use client";

import { R, fromCache, fresh, held } from "@/lib/client/resources";
import { useEffect, useMemo, useState } from "react";
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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { DesignTemplate } from "@/lib/mjengo/design-templates";
import { Search as SearchIcon, X as XIcon } from "lucide-react";
import { CONCEPTS, MOODS, conceptTemplate, generateTemplate } from "@/lib/mjengo/design-generator";
import { ASPECT as ASPECTS, WEBSITE_PHOTOS, encodeSrc, type SizeId } from "@/lib/mjengo/design-templates";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Megaphone, Sparkles as SparklesIcon } from "lucide-react";

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
		const stops = [fromCache(R.templates("design"), setRows, { onError: () => setRows([]) }), fromCache(R.assets, setAssets, { onError: () => setAssets([]) })];
		try { const v = localStorage.getItem("ss_design_view"); if (v === "grid" || v === "list") setView(v); } catch { /* default */ }
		return () => stops.forEach((s) => s());
	}, []);

	// Pinterest suggestions, when the site is connected to Pinterest.
	const [pins, setPins] = useState<Pin[] | null>(null);
	const [pinErr, setPinErr] = useState<string | null>(null);
	const [pinQ, setPinQ] = useState("");
	const [cat, setCat] = useState<(typeof CATEGORIES)[number]>("All");
	const [ideas, setIdeas] = useState(12);
	const [shuffle, setShuffle] = useState(0);
	const [mood, setMood] = useState("All");
	const [src, setSrc] = useState<"pinterest" | "site" | "designs" | InspireSource>("designs");
	const [openAs, setOpenAs] = useState<"auto" | SizeId>("auto");
	const [section, setSection] = useState<"all" | "templates" | "inspire" | "yours" | "schedule">("all");
	const [ratios, setRatios] = useState<Record<string, number>>({});
	const [detail, setDetail] = useState<DesignTemplate | null>(null);
	const [query, setQuery] = useState("");
	const searchPins = (q: string, from: "pinterest" | "site" | "designs" | InspireSource = src) => {
		setPins(null); setPinErr(null);
		if (from === "site" || from === "designs") { setPins([]); return; }
		const job = from === "pinterest"
			? unwrap(pinterestSearch(q))
			: unwrap(inspireSearch(from, q || "poster design")).then((r): Pin[] => r.map((x) => ({ id: x.id, title: x.title, image: x.full, link: x.link })));
		job.then(setPins).catch((e) => { setPins([]); setPinErr(e instanceof Error ? e.message : "Could not load suggestions."); });
	};
	useEffect(() => { searchPins("social media poster design", "pinterest"); }, []);

	const sizeFor = (id: string): SizeId => {
		if (openAs !== "auto") return openAs;
		const r = ratios[id];
		if (!r) return "instagram";
		const choices: SizeId[] = ["instagram", "story", "linkedin", "x", "poster"];
		return choices.reduce((best, c) => (Math.abs(ASPECTS[c].w / ASPECTS[c].h - r) < Math.abs(ASPECTS[best].w / ASPECTS[best].h - r) ? c : best), "instagram" as SizeId);
	};
	const show = (k: typeof section) => section === "all" || section === k;
	const found = useMemo(() => {
		const q = query.trim().toLowerCase();
		if (!q) return null;
		const pool = [...TEMPLATES.filter((t) => t.id !== "plain"), ...Array.from({ length: 36 }, (_, i) => generateTemplate(5000 + i))];
		return pool.filter((t) => `${t.name} ${t.category} ${t.size}`.toLowerCase().includes(q)).slice(0, 24);
	}, [query]);
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
			<section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#CFF3F5] via-[#EADFFF] to-[#FFE4F0] px-5 py-8 text-center sm:py-10">
				<div className="absolute right-4 top-4 flex gap-2">
					<Button variant="outline" size="sm" className="gap-1.5 bg-white/80" onClick={() => { setSection("schedule"); setTimeout(() => document.getElementById("schedule")?.scrollIntoView({ behavior: "smooth" }), 50); }}><Megaphone className="h-4 w-4" /> <span className="hidden sm:inline">Schedule content</span></Button>
				</div>
				<h2 className="text-2xl font-bold tracking-tight text-sauti-dark sm:text-4xl"><span className="bg-gradient-to-r from-[#068297] to-[#7D2AE8] bg-clip-text text-transparent">What will you design today?</span></h2>
				<div className="mx-auto mt-5 flex max-w-2xl items-center gap-2 rounded-2xl bg-white p-1.5 shadow-[0_6px_24px_rgba(125,42,232,0.12)] ring-1 ring-black/5">
					<SearchIcon className="ml-2.5 h-5 w-5 shrink-0 text-serene-neutral-400" />
					<input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search templates: poster, quote, story, hiring..." aria-label="Search templates" className="h-11 min-w-0 flex-1 bg-transparent text-[15px] outline-none placeholder:text-serene-neutral-400" />
					{query && <button onClick={() => setQuery("")} aria-label="Clear" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-serene-neutral-100"><XIcon className="h-4 w-4" /></button>}
					<DropdownMenu>
						<DropdownMenuTrigger asChild><Button className="h-11 gap-2 rounded-xl bg-[#7D2AE8] px-4 hover:bg-[#6a22c9]"><Plus className="h-4 w-4" /> <span className="hidden sm:inline">Create blank</span></Button></DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-56">
							{SIZES.map((sz) => (
								<DropdownMenuItem key={sz.id} asChild><Link href={`/dashboard/mjengo/design/editor?size=${sz.id}`} className="flex items-center justify-between"><span>{sz.label}</span><span className="text-xs text-serene-neutral-400">{sz.note}</span></Link></DropdownMenuItem>
							))}
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
				<div className="mt-4 flex flex-wrap justify-center gap-2">
					{CATEGORIES.filter((c) => c !== "All").map((c) => (
						<button key={c} onClick={() => { setCat(c); setSection("templates"); setQuery(""); }} className="rounded-full border border-[#7D2AE8]/20 bg-white/70 px-3.5 py-1.5 text-sm font-medium text-serene-neutral-700 transition hover:border-[#7D2AE8] hover:bg-white">{c}</button>
					))}
				</div>
			</section>

			{found && (
				<section aria-label="Search results" className="space-y-3">
					<h3 className="text-base font-semibold text-sauti-dark">{found.length ? `Results for “${query}”` : `Nothing matches “${query}”`}</h3>
					<div className="columns-2 gap-4 sm:columns-3 lg:columns-5">
						{found.map((t, i) => (
							<button key={`${t.id}-${i}`} onClick={() => setDetail(t)} className="group mb-4 block w-full break-inside-avoid text-left">
								<span className="block transition group-hover:-translate-y-0.5 group-hover:[&>div]:ring-[#7D2AE8] group-hover:[&>div]:shadow-md"><TemplatePreview template={t} /></span>
								<span className="mt-1.5 block truncate text-sm font-medium text-serene-neutral-800">{t.name}</span>
							</button>
						))}
					</div>
				</section>
			)}

			<div className="flex flex-wrap items-center gap-3">
				<div className="inline-flex rounded-lg border border-serene-neutral-200 bg-white p-0.5" role="tablist" aria-label="Sections">
					{([["all", "Everything"], ["templates", "Templates"], ["inspire", "Inspiration"], ["yours", "Your designs"], ["schedule", "Schedule"]] as const).map(([v, l]) => (
						<button key={v} role="tab" aria-selected={section === v} onClick={() => setSection(v)} className={cn("touch-manipulation rounded-md px-3 py-1.5 text-xs font-semibold", section === v ? "bg-sauti-teal text-white" : "text-serene-neutral-600 hover:bg-serene-neutral-50")}>{l}</button>
					))}
				</div>
			</div>

			{section === "all" && (
			<Fold id="start" title="Popular" open={isOpen("start")} onToggle={toggle}>
				<div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
					{SIZES.map((s) => (
						<Link key={s.id} href={`/dashboard/mjengo/design/editor?size=${s.id}`} className="group flex flex-col gap-2 text-left">
							<span className="flex h-[132px] w-full items-center justify-center rounded-2xl bg-[#F1F1F4] transition group-hover:bg-[#E9E4F7]">
								<SizeMock size={s.id as SizeId} className="shadow-[3px_4px_0_rgba(0,0,0,0.08)] transition-transform group-hover:-translate-y-1 group-hover:scale-105" />
							</span>
							<span className="text-sm font-medium text-serene-neutral-800">{s.label}</span>
						</Link>
					))}
				</div>
			</Fold>
			)}

			<Dialog open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
				<DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto p-0">
					{detail && (
						<div className="grid gap-6 p-6 md:grid-cols-[minmax(0,1fr)_320px]">
							<div className="flex items-start justify-center rounded-2xl bg-[#F1F1F4] p-6"><div className="w-full max-w-[380px]"><TemplatePreview template={detail} className="shadow-xl" /></div></div>
							<div>
								<DialogHeader className="text-left">
									<DialogTitle className="text-2xl leading-tight">{detail.name}</DialogTitle>
									<DialogDescription>{detail.category} · {ASPECTS[detail.size].w} x {ASPECTS[detail.size].h} px</DialogDescription>
								</DialogHeader>
								<p className="mt-4 text-sm text-serene-neutral-600">Every part is editable: text, colours, fonts and pictures. Photos can be split into layers once they are on the page.</p>
								<Button asChild className="mt-5 h-12 w-full gap-2 rounded-xl bg-[#7D2AE8] text-base hover:bg-[#6a22c9]"><Link href={`/dashboard/mjengo/design/editor?template=${detail.id}&size=${detail.size}`}>Customise this template</Link></Button>
								<p className="mb-2 mt-6 text-xs font-semibold uppercase tracking-wider text-serene-neutral-500">More like this</p>
								<div className="grid grid-cols-3 gap-2">
									{Array.from({ length: 6 }, (_, i) => generateTemplate(detail.id.length * 97 + i * 13 + 7, { category: detail.category, size: detail.size })).map((t, i) => (
										<button key={`${t.id}-${i}`} onClick={() => setDetail(t)} className="text-left transition hover:-translate-y-0.5"><TemplatePreview template={t} /></button>
									))}
								</div>
							</div>
						</div>
					)}
				</DialogContent>
			</Dialog>

			{section === "all" && !found && (
				<section aria-label="Explore templates" className="space-y-2">
					<h3 className="text-base font-semibold text-sauti-dark">Explore templates</h3>
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
						{CATEGORIES.filter((c) => c !== "All").map((c, i) => {
							const sample = TEMPLATES.find((t) => t.category === c) ?? TEMPLATES[0];
							const tints = ["from-[#FFE9D9] to-[#FFD0C2]", "from-[#EADFFF] to-[#D5C6FF]", "from-[#D9F3F5] to-[#BDE8EC]", "from-[#FFF3C9] to-[#FFE08A]", "from-[#FFE0EC] to-[#FFC3D7]", "from-[#DDE8FF] to-[#C2D4FF]", "from-[#E2F7E1] to-[#C6EDC4]"];
							return (
								<button key={c} onClick={() => { setCat(c); setSection("templates"); }} className={cn("group relative flex h-24 items-center overflow-hidden rounded-2xl bg-gradient-to-r px-4 text-left transition hover:-translate-y-0.5 hover:shadow-md", tints[i % tints.length])}>
									<span className="text-[15px] font-semibold text-serene-neutral-900">{c}</span>
									<span className="absolute -right-2 top-3 w-20 rotate-6 transition-transform group-hover:rotate-3 group-hover:scale-105"><TemplatePreview template={sample} className="shadow-lg" /></span>
								</button>
							);
						})}
					</div>
				</section>
			)}

			{show("templates") && (
			<Fold id="templates" title="Templates" count={TEMPLATES.length - 1 + templates.length} open={isOpen("templates")} onToggle={toggle}>
				<div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
					{CATEGORIES.map((c) => (
						<button key={c} onClick={() => setCat(c)} aria-pressed={cat === c} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition", cat === c ? "border-[#7D2AE8] bg-[#7D2AE8] text-white" : "border-serene-neutral-200 bg-white text-serene-neutral-700 hover:border-[#7D2AE8]/50")}>{c}</button>
					))}
				</div>
				<div className="columns-2 gap-4 sm:columns-3 lg:columns-5">
					{TEMPLATES.filter((t) => t.id !== "plain" && (cat === "All" || t.category === cat)).map((t) => (
						<button key={t.id} onClick={() => setDetail(t)} className="group mb-4 block w-full break-inside-avoid text-left">
							<span className="block transition group-hover:-translate-y-0.5 group-hover:[&>div]:ring-[#7D2AE8] group-hover:[&>div]:shadow-md"><TemplatePreview template={t} /></span>
							<span className="mt-1.5 block truncate text-sm font-medium text-serene-neutral-800">{t.name}</span>
							<span className="block text-xs text-serene-neutral-500">{t.category} · {ASPECT[t.size].w} x {ASPECT[t.size].h}</span>
						</button>
					))}
					{Array.from({ length: ideas }).map((_, i) => {
						const t = generateTemplate(1000 + i + shuffle * 97, cat === "All" ? {} : { category: cat });
						return (
							<button key={`${t.id}-${i}`} onClick={() => setDetail(t)} className="group mb-4 block w-full break-inside-avoid text-left">
								<span className="block transition group-hover:-translate-y-0.5 group-hover:[&>div]:ring-[#7D2AE8] group-hover:[&>div]:shadow-md"><TemplatePreview template={t} /></span>
								<span className="mt-1.5 block truncate text-sm font-medium text-serene-neutral-800">{t.name}</span>
								<span className="block text-xs text-serene-neutral-500">{t.category} · fresh idea</span>
							</button>
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
			)}

			{show("inspire") && (
			<Fold id="inspire" title="Inspiration" open={isOpen("inspire")} onToggle={toggle} right={
				<label className="flex items-center gap-1.5 text-xs text-serene-neutral-600">Open as
					<select value={openAs} onChange={(e) => setOpenAs(e.target.value as "auto" | SizeId)} aria-label="Open inspiration as" className="h-8 rounded-md border border-serene-neutral-200 bg-white px-2 text-sm">
						<option value="auto">Best fit</option>
						{SIZES.map((sz) => <option key={sz.id} value={sz.id}>{sz.label}</option>)}
					</select>
				</label>
			}>
				<div className="mb-3 flex flex-wrap items-center gap-2">
					<div className="inline-flex flex-wrap rounded-lg border border-serene-neutral-200 bg-white p-0.5">
						{([["designs", "Designs"], ["pinterest", "Pinterest"], ["site", "Sauti Salama"], ["unsplash", "Unsplash"], ["pixabay", "Pixabay"], ["openverse", "Openverse"]] as const).map(([v, l]) => (
							<button key={v} onClick={() => { setSrc(v); if (v !== "designs" && v !== "site") searchPins(pinQ || "social media poster design", v); }} aria-pressed={src === v} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold", src === v ? "bg-sauti-teal text-white" : "text-serene-neutral-600 hover:bg-serene-neutral-50")}>{l}</button>
						))}
					</div>
					{src !== "designs" && src !== "site" && (
						<form className="flex gap-1.5" onSubmit={(e) => { e.preventDefault(); searchPins(pinQ); }}>
							<Input value={pinQ} onChange={(e) => setPinQ(e.target.value)} placeholder="Search ideas" aria-label="Search" className="h-8 w-48 text-sm" />
							<Button type="submit" size="sm" variant="outline" className="h-8">Search</Button>
						</form>
					)}
				</div>

				{src === "designs" ? (
					<>
						<div className="mb-3 flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
							{MOODS.map((m) => (
								<button key={m} onClick={() => setMood(m)} aria-pressed={mood === m} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-medium transition", mood === m ? "border-[#7D2AE8] bg-[#7D2AE8] text-white" : "border-serene-neutral-200 bg-white text-serene-neutral-700 hover:border-[#7D2AE8]/50")}>{m}</button>
							))}
						</div>
						<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
							{CONCEPTS.filter((c) => mood === "All" || c.mood === mood).map((c, i) => (
								<Link key={c.id} href={`/dashboard/mjengo/design/editor?concept=${c.id}&variant=${i}&size=${openAs === "auto" ? "instagram" : openAs}`} className="group block">
									<span className="block transition group-hover:-translate-y-0.5 group-hover:[&>div]:ring-[#7D2AE8] group-hover:[&>div]:shadow-md"><TemplatePreview template={conceptTemplate(c.id, openAs === "auto" ? "instagram" : openAs, i)} /></span>
									<span className="mt-1.5 flex items-center gap-1.5">
										<span className="truncate text-sm font-medium text-serene-neutral-800">{c.name}</span>
										<span className="ml-auto flex shrink-0">{[c.bg, c.accent, c.accent2, c.ink].map((col, k) => <i key={k} className="-ml-1 h-3 w-3 rounded-full ring-1 ring-white first:ml-0" style={{ background: col }} />)}</span>
									</span>
									<span className="block truncate text-xs text-serene-neutral-500">{c.mood} · {c.head}</span>
								</Link>
							))}
						</div>
					</>
				) : src === "site" ? (
					<div className="columns-2 gap-3 sm:columns-3 lg:columns-5">
						{WEBSITE_PHOTOS.map((p) => (
							<Link key={p.src} href={`/dashboard/mjengo/design/editor?inspire=${encodeURIComponent(encodeSrc(p.src))}&size=${sizeFor(p.src)}`} className="group mb-3 block break-inside-avoid overflow-hidden rounded-xl border border-serene-neutral-200/70 bg-white transition hover:border-[#7D2AE8]/50 hover:shadow-sm">
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img src={encodeSrc(p.src)} alt={p.label} loading="lazy" onLoad={(e) => { const im = e.currentTarget; if (im.naturalHeight) setRatios((r) => (r[p.src] ? r : { ...r, [p.src]: im.naturalWidth / im.naturalHeight })); }} className="w-full" />
								<span className="block truncate px-2 py-1.5 text-xs text-serene-neutral-600">{p.label}</span>
							</Link>
						))}
					</div>
				) : pinErr ? (
					<div className="rounded-2xl border border-dashed border-serene-neutral-200 bg-white p-6 text-center">
						<p className="text-sm text-serene-neutral-600">{pinErr}</p>
						<button onClick={() => setSrc("site")} className="mt-2 text-sm font-medium text-sauti-teal hover:underline">Browse pictures from the Sauti Salama website instead</button>
					</div>
				) : !pins ? <MjengoLoader compact label="Finding ideas" /> : pins.length === 0 ? (
					<p className="rounded-2xl border border-dashed border-serene-neutral-200 bg-white p-6 text-center text-sm text-serene-neutral-500">No suggestions for that search.</p>
				) : (
					<div className="columns-2 gap-3 sm:columns-3 lg:columns-5">
						{pins.map((p) => (
							<Link key={p.id} href={`/dashboard/mjengo/design/editor?inspire=${encodeURIComponent(p.image)}&size=${sizeFor(p.id)}`} className="group mb-3 block break-inside-avoid overflow-hidden rounded-xl border border-serene-neutral-200/70 bg-white transition hover:border-[#7D2AE8]/50 hover:shadow-sm">
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img src={p.image} alt={p.title} loading="lazy" onLoad={(e) => { const im = e.currentTarget; if (im.naturalHeight) setRatios((r) => (r[p.id] ? r : { ...r, [p.id]: im.naturalWidth / im.naturalHeight })); }} className="w-full" />
								<span className="block truncate px-2 py-1.5 text-xs text-serene-neutral-600">{p.title}</span>
							</Link>
						))}
					</div>
				)}
			</Fold>
			)}

			{show("yours") && (
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
			)}

			{show("yours") && (
			<Fold id="studio" title="Pictures in Studio" count={assets.length + 16} open={isOpen("studio")} onToggle={toggle}>
				<p className="mb-2 text-xs font-semibold uppercase tracking-wider text-serene-neutral-500">From the Sauti Salama website</p>
				<ul className="mb-5 grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
					{WEBSITE_PHOTOS.slice(0, 16).map((p) => (
						<li key={p.src}>
							<Link href={`/dashboard/mjengo/design/editor?inspire=${encodeURIComponent(encodeSrc(p.src))}&size=${sizeFor(p.src)}`} className="block overflow-hidden rounded-xl border border-serene-neutral-200/70 bg-white transition hover:border-[#7D2AE8]/50">
								{/* eslint-disable-next-line @next/next/no-img-element */}
								<img src={encodeSrc(p.src)} alt={p.label} loading="lazy" className="aspect-square w-full object-cover" />
								<span className="block truncate px-2 py-1 text-[11px] text-serene-neutral-500">{p.label}</span>
							</Link>
						</li>
					))}
				</ul>
				<p className="mb-2 text-xs font-semibold uppercase tracking-wider text-serene-neutral-500">Made in the suite</p>
				{assets.length === 0 ? <p className="rounded-2xl border border-dashed border-serene-neutral-200 bg-white p-8 text-center text-sm text-serene-neutral-500">Pictures from the assistant and saved designs collect here.</p> : (
					<ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-8">
						{assets.slice(0, 16).map((a) => <li key={a.id} className="overflow-hidden rounded-xl border border-serene-neutral-200/70 bg-white">{a.url ? <img src={a.url} alt={a.name} className="aspect-square w-full object-cover" /> : <span className="block aspect-square bg-serene-neutral-100" />}<span className="block truncate px-2 py-1 text-[11px] text-serene-neutral-500">{format(new Date(a.created_at), "d MMM")}</span></li>)}
					</ul>
				)}
			</Fold>

			)}

			{show("schedule") && (
			<>
			<div id="schedule" />
			<Fold id="schedule" title="Schedule content" open={isOpen("schedule")} onToggle={toggle} right={<span className="text-xs text-serene-neutral-500">Posts, accounts and the calendar of what goes out</span>}>
				<ContentPanel />
			</Fold>
			</>
			)}
		</div>
	);
}
