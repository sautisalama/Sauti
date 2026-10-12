"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addDays, addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { CalendarDays, Check, ChevronLeft, ChevronRight, ClipboardCopy, ExternalLink, ImageIcon, Loader2, Palette, Plus, Send, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { ASPECT, CHANNELS, CHANNEL_INFO, PLATFORM_TIPS, aspectProblem, textFor, type Channel } from "@/lib/mjengo/channels";
import { suggestTimes } from "@/lib/mjengo/best-times";
import * as content from "@/app/actions/mjengo-content";
import * as ai from "@/app/actions/mjengo-ai";
import type { PostRow } from "@/app/actions/mjengo-content";
import type { AssetRow } from "@/app/actions/mjengo-ai";
import { MjengoLoader } from "../_components/MjengoLoader";
import { TemplatePicker } from "../_components/TemplatePicker";
import { saveTemplate } from "@/app/actions/mjengo-templates";
import { holidayOn } from "@/lib/mjengo/holidays-ke";

const STATUS: Record<PostRow["status"], string> = { draft: "Draft", scheduled: "Scheduled", posted: "Posted", cancelled: "Cancelled" };
const toLocalInput = (iso: string | null) => (iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : "");

export default function ContentPage() {
	const { toast } = useToast();
	const [tab, setTab] = useState<"calendar" | "studio">("calendar");
	const [day, setDay] = useState(() => new Date());
	const [showMonth, setShowMonth] = useState(false);
	const [posts, setPosts] = useState<PostRow[] | null>(null);
	const [assets, setAssets] = useState<AssetRow[]>([]);
	const [month, setMonth] = useState(() => startOfMonth(new Date()));
	const [edit, setEdit] = useState<(Partial<PostRow> & { whenLocal: string }) | null>(null);
	const [chan, setChan] = useState<content.ChannelsState | null>(null);

	const load = useCallback(async () => {
		const [p, a, c] = await Promise.all([unwrap(content.listPosts()), unwrap(ai.listAssets()), unwrap(content.channelsState()).catch(() => null)]);
		setPosts(p);
		setAssets(a);
		setChan(c);
	}, []);
	useEffect(() => { load().catch(() => { setPosts([]); toast({ title: "Could not load content", variant: "destructive" }); }); }, [load, toast]);

	// Back from connecting an account.
	useEffect(() => {
		const q = new URLSearchParams(window.location.search);
		if (q.get("channel")) toast({ title: "Account connected", description: q.get("channel") ?? undefined });
		if (q.get("channel_error")) toast({ title: "Could not connect the account", description: q.get("channel_error") ?? undefined, variant: "destructive" });
		if (q.get("channel") || q.get("channel_error")) window.history.replaceState(null, "", window.location.pathname);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const days = useMemo(() => eachDayOfInterval({ start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) }), [month]);
	const byDay = (d: Date) => (posts ?? []).filter((p) => p.scheduled_for && isSameDay(new Date(p.scheduled_for), d));
	const drafts = (posts ?? []).filter((p) => !p.scheduled_for && p.status === "draft");

	const start = (day?: Date) => {
		const when = day ? new Date(day) : null;
		if (when) when.setHours(9, 0, 0, 0);
		setEdit({ body: "", channels: ["linkedin"], media: [], status: "draft", variants: {}, results: {}, link_url: null, whenLocal: when ? format(when, "yyyy-MM-dd'T'HH:mm") : "" });
	};

	if (!posts) return <MjengoLoader label="Loading content" />;

	return (
		<div className="mx-auto max-w-6xl space-y-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 className="text-base font-semibold tracking-tight text-sauti-dark">Scheduled posts</h2>
					<p className="text-sm text-serene-neutral-500">Plan posts for LinkedIn, X, Facebook and Instagram, and keep the images you create.</p>
				</div>
				<div className="flex items-center gap-2">
					<div className="inline-flex rounded-lg border border-serene-neutral-200 bg-white p-0.5">
						{(["calendar", "studio"] as const).map((t) => (
							<button key={t} onClick={() => setTab(t)} aria-pressed={tab === t} className={cn("rounded-md px-3 py-1.5 text-xs font-semibold capitalize", tab === t ? "bg-sauti-teal text-white" : "text-serene-neutral-600")}>{t}</button>
						))}
					</div>
					<Button className="gap-2 bg-sauti-teal hover:bg-sauti-dark" onClick={() => start()}><Plus className="h-4 w-4" /> New post</Button>
				</div>
			</div>

			{tab === "calendar" && (
				<>
					<section className="relative overflow-hidden rounded-2xl border border-serene-blue-100 bg-gradient-to-br from-serene-blue-50 via-white to-sauti-teal-light/40 p-6 sm:p-8">
						<h3 className="text-2xl font-bold tracking-tight text-sauti-dark sm:text-3xl">Content <span className="text-sauti-teal">Calendar</span></h3>
						<p className="mt-1 max-w-xl text-sm text-serene-neutral-600">Plan what goes out, to which accounts and when. Designs, pictures and wording stay together with the post.</p>
					</section>

					<div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
						<Tile tint="bg-sauti-teal-light" icon={Plus} title="Write a post" hint="Words, pictures and the accounts it goes to." onClick={() => start(day)} />
						<Tile tint="bg-sauti-yellow-light" icon={Palette} title="Start from a design" hint="Make a graphic, then schedule it." href="/dashboard/mjengo/design" />
						<Tile tint="bg-serene-blue-50" icon={CalendarDays} title="Month view" hint={showMonth ? "Hide the whole month." : "See the whole month at once."} onClick={() => setShowMonth((v) => !v)} />
					</div>

					<section className="rounded-2xl border border-serene-neutral-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-5">
						<div className="flex flex-wrap items-center gap-3">
							<h3 className="text-base font-bold text-sauti-dark">{isSameDay(day, new Date()) ? "Today" : format(day, "EEEE")}<span className="ml-2 text-sm font-normal text-serene-neutral-500">{format(day, "d MMMM")}</span></h3>
							{holidayOn(day) && <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">{holidayOn(day)}</span>}
							<span className="flex-1" />
							<div className="flex items-center gap-1">
								<button onClick={() => setDay((d) => addDays(d, -7))} aria-label="Previous week" className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-serene-neutral-100"><ChevronLeft className="h-4 w-4" /></button>
								{Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(day, { weekStartsOn: 1 }), i)).map((d) => {
									const n = byDay(d).length;
									return (
										<button key={d.toISOString()} onClick={() => setDay(d)} aria-pressed={isSameDay(d, day)} className={cn("relative flex w-10 flex-col items-center rounded-xl py-1.5 text-xs transition sm:w-12", isSameDay(d, day) ? "bg-sauti-teal text-white" : isSameDay(d, new Date()) ? "bg-sauti-teal-light text-sauti-dark" : holidayOn(d) ? "bg-amber-50 hover:bg-amber-100" : "hover:bg-serene-neutral-100")}>
											<span className="text-[10px] uppercase tracking-wide opacity-80">{format(d, "EEE")}</span>
											<span className="text-base font-semibold">{format(d, "d")}</span>
											{n > 0 && <span className={cn("absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-bold", isSameDay(d, day) ? "bg-white text-sauti-teal" : "bg-rose-500 text-white")}>{n}</span>}
										</button>
									);
								})}
								<button onClick={() => setDay((d) => addDays(d, 7))} aria-label="Next week" className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-serene-neutral-100"><ChevronRight className="h-4 w-4" /></button>
							</div>
						</div>
						<div className="mt-4">
							{byDay(day).length === 0 ? (
								<div className="flex flex-col items-center rounded-2xl border border-dashed border-serene-neutral-200 py-10 text-center">
									<span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sauti-teal-light text-sauti-teal"><Send className="h-6 w-6" /></span>
									<p className="mt-3 text-sm font-semibold text-serene-neutral-900">Nothing going out {isSameDay(day, new Date()) ? "today" : `on ${format(day, "EEEE")}`}</p>
									<button onClick={() => start(day)} className="mt-2 text-sm font-medium text-sauti-teal hover:underline">Plan a post for this day</button>
								</div>
							) : (
								<ul className="space-y-2">
									{byDay(day).map((p) => (
										<li key={p.id}>
											<button onClick={() => setEdit({ ...p, whenLocal: toLocalInput(p.scheduled_for) })} className="flex w-full items-center gap-3 rounded-xl border border-serene-neutral-200/70 p-3 text-left transition hover:border-sauti-teal/40">
												<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-600"><Send className="h-4 w-4" /></span>
												<span className="min-w-0 flex-1">
													<span className="block truncate text-sm font-semibold text-serene-neutral-900">{p.title || p.body.slice(0, 60) || "Untitled post"}</span>
													<span className="block text-xs text-serene-neutral-500">{p.scheduled_for ? format(new Date(p.scheduled_for), "h:mm a") : ""} · {STATUS[p.status]}</span>
												</span>
												<span className="flex shrink-0 -space-x-0.5">{p.channels.map((c) => <span key={c} className="h-2.5 w-2.5 rounded-full ring-1 ring-white" style={{ background: CHANNEL_INFO[c].color }} title={CHANNEL_INFO[c].label} />)}</span>
											</button>
										</li>
									))}
								</ul>
							)}
						</div>
					</section>
				</>
			)}

			<ChannelsBar state={chan} onChanged={load} />

			{tab === "calendar" ? (
				<>
					{showMonth && <div className="overflow-hidden rounded-2xl border border-serene-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
						<div className="flex items-center gap-2 border-b border-serene-neutral-100 p-3">
							<h3 className="flex-1 text-base font-semibold text-sauti-dark">{format(month, "MMMM yyyy")}</h3>
							<Button variant="ghost" size="sm" onClick={() => setMonth(startOfMonth(new Date()))}>Today</Button>
							<Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => setMonth((m) => addMonths(m, -1))}><ChevronLeft className="h-4 w-4" /></Button>
							<Button variant="ghost" size="icon" aria-label="Next month" onClick={() => setMonth((m) => addMonths(m, 1))}><ChevronRight className="h-4 w-4" /></Button>
						</div>
						<div className="grid grid-cols-7 border-b border-serene-neutral-100 text-center text-[11px] font-semibold uppercase tracking-wider text-serene-neutral-400">
							{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-2">{d}</div>)}
						</div>
						<div className="grid grid-cols-7">
							{days.map((d) => {
								const list = byDay(d);
								return (
									<div key={d.toISOString()} onClick={() => start(d)} className={cn("min-h-[92px] cursor-pointer border-b border-r border-serene-neutral-100 p-1.5 transition hover:bg-serene-neutral-50/70", !isSameMonth(d, month) && "bg-serene-neutral-50/60 text-serene-neutral-300")}>
										<span className={cn("mb-1 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs", isSameDay(d, new Date()) ? "bg-sauti-teal font-bold text-white" : "text-serene-neutral-600")}>{format(d, "d")}</span>
										<div className="space-y-1">
											{list.slice(0, 3).map((p) => (
												<button key={p.id} onClick={(e) => { e.stopPropagation(); setEdit({ ...p, whenLocal: toLocalInput(p.scheduled_for) }); }} className={cn("flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px]", p.status === "posted" ? "bg-emerald-50 text-emerald-800" : "bg-sauti-teal-light/60 text-sauti-dark")}>
													<span className="flex -space-x-0.5">{p.channels.map((c) => <span key={c} className="h-1.5 w-1.5 rounded-full" style={{ background: CHANNEL_INFO[c].color }} />)}</span>
													<span className="truncate">{p.title || p.body.slice(0, 30) || "Untitled"}</span>
												</button>
											))}
											{list.length > 3 && <span className="px-1 text-[11px] text-serene-neutral-500">+{list.length - 3} more</span>}
										</div>
									</div>
								);
							})}
						</div>
					</div>}

					{drafts.length > 0 && (
						<section>
							<h3 className="mb-2 text-sm font-semibold text-sauti-dark">Drafts</h3>
							<ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
								{drafts.map((p) => (
									<li key={p.id}><button onClick={() => setEdit({ ...p, whenLocal: "" })} className="w-full rounded-xl border border-serene-neutral-200/70 bg-white p-3 text-left text-sm hover:border-sauti-teal/40"><span className="line-clamp-2 text-serene-neutral-800">{p.body || "Empty draft"}</span></button></li>
								))}
							</ul>
						</section>
					)}
				</>
			) : (
				<Studio assets={assets} onChanged={load} />
			)}

			<PostDialog
				taken={(posts ?? []).filter((p) => p.scheduled_for && p.status !== "cancelled").map((p) => new Date(p.scheduled_for as string))}
				post={edit}
				assets={assets}
				state={chan}
				onClose={() => setEdit(null)}
				onSaved={async () => { setEdit(null); await load(); }}
			/>
		</div>
	);
}

function Studio({ assets, onChanged }: { assets: AssetRow[]; onChanged: () => Promise<void> }) {
	const { toast } = useToast();
	return (
		<div className="space-y-4">
			<div className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-serene-neutral-300 bg-white p-4">
				<span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sauti-teal-light text-sauti-teal"><Palette className="h-5 w-5" /></span>
				<div className="min-w-0 flex-1">
					<p className="text-sm font-semibold text-sauti-dark">Design editor</p>
					<p className="text-sm text-serene-neutral-500">A Canva-style editor for posters and social graphics is planned here. For now, create images with the assistant and they land in this library.</p>
				</div>
				<Button asChild variant="outline" className="gap-2"><Link href="/dashboard/mjengo/assistant"><Sparkles className="h-4 w-4" /> Create with the assistant</Link></Button>
			</div>
			{assets.length === 0 ? (
				<p className="py-12 text-center text-sm text-serene-neutral-500">Images you create in the assistant are saved here.</p>
			) : (
				<ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
					{assets.map((a) => (
						<li key={a.id} className="group relative overflow-hidden rounded-2xl border border-serene-neutral-200/70 bg-white">
							{a.url ? <img src={a.url} alt={a.name} className="aspect-square w-full object-cover" /> : <div className="flex aspect-square items-center justify-center bg-serene-neutral-50"><ImageIcon className="h-6 w-6 text-serene-neutral-300" /></div>}
							<div className="p-2"><p className="truncate text-xs text-serene-neutral-700">{a.prompt || a.name}</p><p className="text-[11px] text-serene-neutral-400">{format(new Date(a.created_at), "d MMM yyyy")}</p></div>
							<button
								aria-label="Delete image"
								onClick={async () => { if (!window.confirm("Delete this image?")) return; try { await unwrap(ai.deleteAsset(a.id)); await onChanged(); } catch (e) { toast({ title: "Could not delete", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } }}
								className="absolute right-2 top-2 hidden h-8 w-8 items-center justify-center rounded-lg bg-white/90 text-red-600 shadow group-hover:flex"
							><Trash2 className="h-4 w-4" /></button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}

/** Connected networks, and a button to connect the rest. */
function ChannelsBar({ state, onChanged }: { state: content.ChannelsState | null; onChanged: () => Promise<void> }) {
	const { toast } = useToast();
	if (!state) return null;
	const provider: Record<Exclude<Channel, "website">, "linkedin" | "x" | "meta" | "tiktok"> = { linkedin: "linkedin", x: "x", facebook: "meta", instagram: "meta", tiktok: "tiktok" };
	return (
		<section aria-label="Connected accounts" className="flex flex-wrap items-center gap-2 rounded-2xl border border-serene-neutral-200/70 bg-white p-3">
			<span className="mr-1 text-sm font-semibold text-sauti-dark">Accounts</span>
			{state.connections.length === 0 && <span className="w-full text-xs text-serene-neutral-500 sm:w-auto">Sign in to the networks you post to, to set up scheduling.</span>}
			{state.connections.map((c) => (
				<span key={c.id} className="flex items-center gap-2 rounded-full border border-serene-neutral-200 py-1 pl-2.5 pr-1 text-sm">
					<span className="h-2 w-2 rounded-full" style={{ background: CHANNEL_INFO[c.channel].color }} />
					<span className="max-w-[160px] truncate">{CHANNEL_INFO[c.channel].label}: {c.account_name}</span>
					<button aria-label={`Disconnect ${c.account_name}`} onClick={async () => { try { await unwrap(content.disconnectChannel(c.id)); await onChanged(); } catch (e) { toast({ title: "Could not disconnect", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } }} className="rounded-full p-1 text-serene-neutral-400 hover:bg-serene-neutral-100 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
				</span>
			))}
			{CHANNELS.filter((c): c is Exclude<Channel, "website"> => c !== "website" && !state.connections.some((x) => x.channel === c)).map((c) => {
				const ok = state.available[provider[c]];
				return ok ? (
					<a key={c} href={`/api/mjengo/channels/${provider[c]}/start`} className="flex items-center gap-1.5 rounded-full border border-dashed border-serene-neutral-300 px-3 py-1 text-sm text-serene-neutral-700 hover:border-sauti-teal/50"><Plus className="h-3.5 w-3.5" /> Connect {CHANNEL_INFO[c].label}</a>
				) : (
					<span key={c} title="Add this network's app keys to the server first" className="flex items-center gap-1.5 rounded-full border border-dashed border-serene-neutral-200 px-3 py-1 text-sm text-serene-neutral-400">{CHANNEL_INFO[c].label} not set up</span>
				);
			})}
		</section>
	);
}

/** How the post will read on the chosen network: the account, the text, hashtags, link and image. */
function Preview({ channel, text, image }: { channel: Channel; text: string; image: string | null }) {
	const info = CHANNEL_INFO[channel];
	return (
		<div className="rounded-xl border border-serene-neutral-200 bg-white p-3 text-sm">
			<div className="mb-2 flex items-center gap-2">
				<span className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: info.color }}>SS</span>
				<div><p className="text-xs font-semibold text-serene-neutral-900">Sauti Salama</p><p className="text-[11px] text-serene-neutral-500">{info.label} preview</p></div>
			</div>
			{image && <img src={image} alt="" className="mb-2 max-h-48 w-full rounded-lg object-cover" />}
			<p className="whitespace-pre-wrap break-words text-serene-neutral-800">{text || "Nothing written yet."}</p>
		</div>
	);
}

function PostDialog({ post, assets, state, taken, onClose, onSaved }: { taken: Date[]; post: (Partial<PostRow> & { whenLocal: string }) | null; assets: AssetRow[]; state: content.ChannelsState | null; onClose: () => void; onSaved: () => Promise<void> }) {
	const { toast } = useToast();
	const [v, setV] = useState(post);
	const [busy, setBusy] = useState(false);
	const [tab, setTab] = useState<"shared" | Channel>("shared");
	const [pickTpl, setPickTpl] = useState(false);
	const [socialTags, setSocialTags] = useState<content.SocialTag[]>([]);
	const [newTag, setNewTag] = useState("");
	const [newKind, setNewKind] = useState<"mention" | "hashtag">("mention");
	const [adapting, setAdapting] = useState(false);
	useEffect(() => { if (post) unwrap(content.listSocialTags()).then(setSocialTags).catch(() => setSocialTags([])); }, [post]);
	// The shape of the chosen pictures, measured in the browser, so each network can be checked.
	const [dims, setDims] = useState<Record<string, [number, number]>>({});
	const mediaIds = (v?.media ?? []) as string[];
	useEffect(() => {
		for (const id of mediaIds) {
			const a = assets.find((x) => x.id === id);
			if (!a?.url || dims[id]) continue;
			const img = new window.Image();
			img.onload = () => setDims((d) => ({ ...d, [id]: [img.naturalWidth, img.naturalHeight] }));
			img.src = a.url;
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [mediaIds.join(","), assets]);
	useEffect(() => { setV(post); setTab("shared"); }, [post]);
	if (!v) return null;

	const chosen: Channel[] = (v.channels as Channel[]) ?? [];
	const body = v.body ?? "";
	const variants = v.variants ?? {};
	// People and hashtags marked "always add" for a network are put on the post when the network is chosen.
	const autoFor = (c: Channel) => ({
		mentions: socialTags.filter((t) => t.channel === c && t.kind === "mention" && t.auto).map((t) => t.value),
		hashtags: socialTags.filter((t) => t.channel === c && t.kind === "hashtag" && t.auto).map((t) => t.value),
	});
	const toggle = (c: Channel) => {
		if (chosen.includes(c)) { setV({ ...v, channels: chosen.filter((x) => x !== c) }); return; }
		const have = variants[c];
		const a = autoFor(c);
		const nextVariants = have && (have.mentions?.length || have.hashtags?.length) ? variants : { ...variants, [c]: { ...have, ...(a.mentions.length ? { mentions: a.mentions } : {}), ...(a.hashtags.length ? { hashtags: a.hashtags } : {}) } };
		setV({ ...v, channels: [...chosen, c], variants: nextVariants });
	};
	const toggleValue = (c: Channel, key: "mentions" | "hashtags", value: string) => {
		const cur = variants[c]?.[key] ?? [];
		setVariant(c, { [key]: cur.includes(value) ? cur.filter((x) => x !== value) : [...cur, value] });
	};
	const tagChannel: Channel | null = tab !== "shared" ? tab : chosen[0] ?? null;
	const suggestions = suggestTimes(chosen, taken);
	const addTag = async () => {
		if (!tagChannel || !newTag.trim()) return;
		try {
			const t = await unwrap(content.saveSocialTag({ channel: tagChannel, kind: newKind, value: newTag, auto: false }));
			setSocialTags((cur) => [...cur.filter((x) => x.id !== t.id), t]);
			setNewTag("");
		} catch (e) { toast({ title: "Could not save", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); }
	};
	const adapt = async (c: Channel) => {
		if (!body.trim()) { toast({ title: "Write the shared text first" }); return; }
		setAdapting(true);
		try { setVariant(c, { body: await unwrap(content.adaptForChannel(body, c)) }); } catch (e) { toast({ title: "Could not rewrite it", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setAdapting(false); }
	};
	const setVariant = (c: Channel, patch: { body?: string; hashtags?: string[]; mentions?: string[] }) => setV({ ...v, variants: { ...variants, [c]: { ...variants[c], ...patch } } });
	const finalText = (c: Channel) => textFor({ body, variants, link_url: v.link_url ?? null, title: v.title ?? null }, c);
	const over = chosen.filter((c) => finalText(c).length > CHANNEL_INFO[c].limit);
	const firstImage = assets.find((a) => (v.media ?? []).includes(a.id))?.url ?? null;
	const connected = (c: Channel) => c === "website" || !!state?.connections.some((x) => x.channel === c);

	const save = async (status?: PostRow["status"]) => {
		setBusy(true);
		try {
			const saved = await unwrap(content.savePost((v.id as string | undefined) ?? null, {
				title: v.title ?? null,
				body,
				channels: chosen,
				media: v.media ?? [],
				scheduledFor: v.whenLocal ? new Date(v.whenLocal).toISOString() : null,
				status: status ?? (v.whenLocal ? "scheduled" : "draft"),
				variants,
				linkUrl: v.link_url ?? null,
			}));
			return saved;
		} catch (e) {
			toast({ title: "Could not save", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
			return null;
		} finally {
			setBusy(false);
		}
	};

	const publishNow = async () => {
		const saved = await save("draft");
		if (!saved) return;
		setBusy(true);
		try {
			const r = await unwrap(content.publishPostNow(saved.id));
			const bad = Object.entries(r).filter(([, x]) => !x.ok);
			toast(bad.length ? { title: "Some channels did not publish", description: bad.map(([c, x]) => `${CHANNEL_INFO[c as Channel]?.label ?? c}: ${x.message}`).join(" "), variant: "destructive" } : { title: "Published" });
			await onSaved();
		} catch (e) {
			toast({ title: "Could not publish", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setBusy(false);
		}
	};

	return (
		<Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
			<DialogContent className="max-h-[94vh] w-[96vw] max-w-6xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{v.id ? "Edit post" : "New post"}</DialogTitle>
					<DialogDescription>Write once, then adjust the wording, hashtags and link for each network. Each network has its own style and limits.</DialogDescription>
				</DialogHeader>
				<div className="grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
				<div className="space-y-4">
					<div className="flex flex-wrap gap-2">
						{CHANNELS.map((c) => {
							const on = chosen.includes(c);
							return (
								<button key={c} type="button" onClick={() => toggle(c)} aria-pressed={on} className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium", on ? "border-sauti-teal bg-sauti-teal-light/40 text-sauti-dark" : "border-serene-neutral-200 text-serene-neutral-600")}>
									<span className="h-2 w-2 rounded-full" style={{ background: CHANNEL_INFO[c].color }} /> {CHANNEL_INFO[c].label} {on && <Check className="h-3.5 w-3.5" />}
									{on && !connected(c) && <span className="text-[10px] font-normal text-amber-700">manual</span>}
								</button>
							);
						})}
					</div>

					<div className="inline-flex flex-wrap gap-1 rounded-lg bg-serene-neutral-100 p-0.5">
						{(["shared", ...chosen] as ("shared" | Channel)[]).map((t) => (
							<button key={t} type="button" onClick={() => setTab(t)} aria-pressed={tab === t} className={cn("rounded-md px-3 py-1 text-xs font-semibold", tab === t ? "bg-white shadow-sm" : "text-serene-neutral-600")}>{t === "shared" ? "Shared text" : CHANNEL_INFO[t].label}</button>
						))}
					</div>

					{tab === "shared" ? (
						<div className="space-y-1.5">
							<div className="flex flex-wrap items-center gap-2">
								<Button type="button" variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => setPickTpl(true)}>Use a template</Button>
								<Button type="button" variant="ghost" size="sm" className="h-7 text-xs" disabled={!body.trim()} onClick={async () => {
									const n = window.prompt("Name this template");
									if (!n?.trim()) return;
									try { await unwrap(saveTemplate(null, { kind: "post", name: n, body })); toast({ title: "Template saved" }); } catch (e) { toast({ title: "Could not save the template", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); }
								}}>Save this text as a template</Button>
								<Button asChild type="button" variant="ghost" size="sm" className="ml-auto h-7 text-xs"><Link href="/dashboard/mjengo/design">Design an image</Link></Button>
							</div>
							<Textarea rows={6} value={body} onChange={(e) => setV({ ...v, body: e.target.value })} placeholder="What do you want to say?" aria-label="Post text" />
							<Input value={v.link_url ?? ""} onChange={(e) => setV({ ...v, link_url: e.target.value })} placeholder="Link to share (tracking tags are added for each network)" aria-label="Link" />
						</div>
					) : (
						<div className="space-y-2">
							<div className="flex items-center justify-between gap-2">
								<p className="text-xs text-serene-neutral-500">Wording for {CHANNEL_INFO[tab].label}. Empty means the shared text is used.</p>
								<Button type="button" size="sm" variant="outline" className="h-7 gap-1.5 text-xs" disabled={adapting} onClick={() => void adapt(tab)}>{adapting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Write it for {CHANNEL_INFO[tab].label}</Button>
							</div>
							<Textarea rows={5} value={variants[tab]?.body ?? ""} onChange={(e) => setVariant(tab, { body: e.target.value })} placeholder={`Different wording for ${CHANNEL_INFO[tab].label}? Leave empty to use the shared text.`} aria-label={`${CHANNEL_INFO[tab].label} text`} />
							<Input value={(variants[tab]?.hashtags ?? []).join(" ")} onChange={(e) => setVariant(tab, { hashtags: e.target.value.split(/[\s,]+/).filter(Boolean) })} placeholder={tab === "x" ? "Hashtags, one or two work best" : tab === "linkedin" ? "Hashtags, three to five at the end" : "Hashtags"} aria-label="Hashtags" />
							<Preview channel={tab} text={finalText(tab)} image={firstImage} />
						</div>
					)}

					<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
						{chosen.map((c) => (
							<span key={c} className={cn(finalText(c).length > CHANNEL_INFO[c].limit ? "font-semibold text-red-600" : "text-serene-neutral-500")}>{CHANNEL_INFO[c].label} {finalText(c).length}/{CHANNEL_INFO[c].limit}</span>
						))}
						{chosen.length === 0 && <span className="text-serene-neutral-400">Pick a channel to see its limit.</span>}
					</div>

					<div className="space-y-1.5">
						<Label className="text-xs font-semibold">Images {chosen.includes("instagram") && <span className="font-normal text-amber-700">(Instagram needs one)</span>}</Label>
						{assets.length === 0 ? (
							<p className="text-xs text-serene-neutral-500">No images yet. Create some with the assistant.</p>
						) : (
							<div className="flex gap-2 overflow-x-auto pb-1">
								{assets.slice(0, 20).map((a) => {
									const on = (v.media ?? []).includes(a.id);
									return (
										<button key={a.id} type="button" onClick={() => setV({ ...v, media: on ? (v.media ?? []).filter((x) => x !== a.id) : [...(v.media ?? []), a.id] })} aria-pressed={on} className={cn("relative h-16 w-16 shrink-0 overflow-hidden rounded-lg border-2", on ? "border-sauti-teal" : "border-transparent")}>
											{a.url && <img src={a.url} alt="" className="h-full w-full object-cover" />}
											{on && <span className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-sauti-teal text-white"><Check className="h-3 w-3" /></span>}
										</button>
									);
								})}
							</div>
						)}
					</div>

					{chosen.length > 0 && (
						<ul className="space-y-1 text-xs">
							{chosen.map((c) => {
								const first = mediaIds.map((id) => dims[id]).find(Boolean);
								const noImage = !mediaIds.length;
								const problem = first ? aspectProblem(c, first[0], first[1]) : null;
								if (CHANNEL_INFO[c].needsImage && noImage) return <li key={c} className="flex items-start gap-2 text-amber-700"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{CHANNEL_INFO[c].label} needs an image: {ASPECT[c].recommended}. <Link href={`/dashboard/mjengo/design?size=${ASPECT[c].designSize}`} className="underline">Design one</Link></li>;
								if (problem) return <li key={c} className="flex items-start gap-2 text-amber-700"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />{problem} <Link href={`/dashboard/mjengo/design?size=${ASPECT[c].designSize}`} className="underline">Design one</Link></li>;
								if (!noImage && first) return <li key={c} className="flex items-start gap-2 text-emerald-700"><span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />{CHANNEL_INFO[c].label}: the picture fits.</li>;
								return null;
							})}
						</ul>
					)}

					<div className="space-y-1.5">
						<Label htmlFor="post-when" className="text-xs font-semibold">Post at</Label>
						<Input id="post-when" type="datetime-local" value={v.whenLocal} onChange={(e) => setV({ ...v, whenLocal: e.target.value })} />
						<p className="text-xs text-serene-neutral-500">Times are East Africa Time. Pick one of the suggestions on the right, or choose your own.</p>
					</div>

					{v.results && Object.keys(v.results).length > 0 && (
						<ul className="space-y-1 rounded-xl bg-serene-neutral-50 p-3 text-sm">
							{Object.entries(v.results).map(([c, r]) => (
								<li key={c} className="flex items-start gap-2">
									<span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", r.ok ? "bg-emerald-500" : "bg-red-500")} />
									<span className="min-w-0 flex-1"><span className="font-medium">{CHANNEL_INFO[c as Channel]?.label ?? c}:</span> {r.message}</span>
									{r.url && <a href={r.url} target="_blank" rel="noopener noreferrer" className="shrink-0 text-sauti-teal"><ExternalLink className="h-4 w-4" /></a>}
								</li>
							))}
						</ul>
					)}

					{v.id && (v.status === "scheduled" || v.status === "posted") ? (
						<div className="flex flex-wrap gap-2 rounded-xl bg-serene-neutral-50 p-3">
							<Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => navigator.clipboard.writeText(body).then(() => toast({ title: "Copied" }))}><ClipboardCopy className="h-4 w-4" /> Copy text</Button>
							{chosen.filter((c) => !connected(c)).map((c) => (
								<Button key={c} asChild size="sm" variant="outline" className="gap-1.5"><a href={CHANNEL_INFO[c].composeUrl(finalText(c))} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> Open {CHANNEL_INFO[c].label}</a></Button>
							))}
							{v.status !== "posted" && <Button type="button" size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" disabled={busy} onClick={async () => { try { await unwrap(content.markPosted(v.id as string)); await onSaved(); } catch (e) { toast({ title: "Could not update", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } }}><Send className="h-4 w-4" /> Mark as posted</Button>}
						</div>
					) : null}
				</div>
				<aside className="space-y-4 lg:border-l lg:border-serene-neutral-100 lg:pl-5">
					<section>
						<h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-serene-neutral-500">Best times to post</h4>
						{chosen.length === 0 ? <p className="text-xs text-serene-neutral-500">Choose a network to see when it tends to work best.</p> : (
							<ul className="space-y-1.5">
								{suggestions.map((sg) => (
									<li key={sg.iso}>
										<button type="button" onClick={() => setV({ ...v, whenLocal: toLocalInput(sg.iso) })} className={cn("w-full rounded-xl border px-3 py-2 text-left transition hover:border-sauti-teal/50", v.whenLocal === toLocalInput(sg.iso) ? "border-sauti-teal bg-sauti-teal-light/40" : "border-serene-neutral-200")}>
											<span className="flex items-center justify-between gap-2 text-sm font-semibold text-serene-neutral-900">{sg.label}<span className="flex gap-0.5">{sg.channels.map((c) => <span key={c} className="h-2 w-2 rounded-full" style={{ background: CHANNEL_INFO[c].color }} title={CHANNEL_INFO[c].label} />)}</span></span>
											<span className="block text-xs text-serene-neutral-500">{sg.why}</span>
										</button>
									</li>
								))}
								{suggestions.length === 0 && <li className="text-xs text-serene-neutral-500">No free good slots in the next two weeks.</li>}
							</ul>
						)}
						<p className="mt-1.5 text-[11px] text-serene-neutral-400">East Africa Time. Public holidays and times near other posts are skipped.</p>
					</section>

					<section>
						<h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-serene-neutral-500">Tags and mentions{tagChannel ? ` for ${CHANNEL_INFO[tagChannel].label}` : ""}</h4>
						{!tagChannel ? <p className="text-xs text-serene-neutral-500">Choose a network first.</p> : (
							<div className="space-y-2">
								<div className="flex flex-wrap gap-1.5">
									{socialTags.filter((t) => t.channel === tagChannel).map((t) => {
										const key = t.kind === "mention" ? "mentions" : "hashtags";
										const on = (variants[tagChannel]?.[key] ?? []).includes(t.value);
										return (
											<span key={t.id} className={cn("flex items-center rounded-full border text-xs", on ? "border-sauti-teal bg-sauti-teal-light/50 text-sauti-dark" : "border-serene-neutral-200 text-serene-neutral-600")}>
												<button type="button" aria-pressed={on} onClick={() => toggleValue(tagChannel, key, t.value)} className="py-1 pl-2.5 pr-1.5">{t.kind === "mention" ? "@" : "#"}{t.value}</button>
												<button type="button" title={t.auto ? "Always added: click to stop" : "Click to always add this"} aria-label={t.auto ? "Stop adding automatically" : "Always add automatically"} onClick={async () => { try { const n = await unwrap(content.saveSocialTag({ channel: t.channel, kind: t.kind, value: t.value, label: t.label, auto: !t.auto }, t.id)); setSocialTags((cur) => cur.map((x) => (x.id === n.id ? n : x))); } catch { /* keep as is */ } }} className={cn("mr-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold", t.auto ? "bg-sauti-teal text-white" : "bg-serene-neutral-100 text-serene-neutral-500")}>{t.auto ? "auto" : "+auto"}</button>
												<button type="button" aria-label={`Forget ${t.value}`} onClick={async () => { try { await unwrap(content.deleteSocialTag(t.id)); setSocialTags((cur) => cur.filter((x) => x.id !== t.id)); } catch { /* keep */ } }} className="mr-1.5 text-serene-neutral-400 hover:text-red-600"><X className="h-3 w-3" /></button>
											</span>
										);
									})}
									{socialTags.filter((t) => t.channel === tagChannel).length === 0 && <span className="text-xs text-serene-neutral-500">No saved people or hashtags for this network yet.</span>}
								</div>
								<div className="flex gap-1.5">
									<select value={newKind} onChange={(e) => setNewKind(e.target.value as "mention" | "hashtag")} aria-label="Kind" className="h-8 rounded-md border border-serene-neutral-200 bg-white px-1.5 text-xs"><option value="mention">@ person</option><option value="hashtag"># hashtag</option></select>
									<Input value={newTag} onChange={(e) => setNewTag(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void addTag(); } }} placeholder={newKind === "mention" ? "their handle" : "the hashtag"} className="h-8 text-xs" />
									<Button type="button" size="sm" variant="outline" className="h-8 text-xs" disabled={!newTag.trim()} onClick={() => void addTag()}>Save</Button>
								</div>
								<p className="text-[11px] text-serene-neutral-400">Mark one &quot;auto&quot; and it is added every time you choose this network.</p>
							</div>
						)}
					</section>

					{tagChannel && (
						<section>
							<h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-serene-neutral-500">What works on {CHANNEL_INFO[tagChannel].label}</h4>
							<ul className="space-y-1 text-xs text-serene-neutral-600">
								{PLATFORM_TIPS[tagChannel].map((t) => <li key={t} className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-serene-neutral-400" />{t}</li>)}
							</ul>
						</section>
					)}

					{chosen.length > 0 && (
						<section className="space-y-2">
							<h4 className="text-xs font-semibold uppercase tracking-wide text-serene-neutral-500">Previews</h4>
							{chosen.map((c) => <Preview key={c} channel={c} text={finalText(c)} image={firstImage} />)}
						</section>
					)}
				</aside>
				</div>
				<DialogFooter className="gap-2 sm:justify-between">
					{v.id ? <Button variant="ghost" className="text-red-600" disabled={busy} onClick={async () => { if (window.confirm("Delete this post?")) { try { await unwrap(content.deletePost(v.id as string)); await onSaved(); } catch (e) { toast({ title: "Could not delete", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } } }}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button> : <span />}
					<div className="flex flex-wrap gap-2">
						<Button variant="outline" disabled={busy || over.length > 0} onClick={async () => { if (await save("draft")) await onSaved(); }}>Save draft</Button>
						{chosen.some(connected) && <Button variant="outline" className="gap-2" disabled={busy || over.length > 0 || !body.trim()} onClick={publishNow}><Send className="h-4 w-4" /> Publish now</Button>}
						<Button className="gap-2 bg-sauti-teal hover:bg-sauti-dark" disabled={busy || !v.whenLocal || over.length > 0} onClick={async () => { if (await save("scheduled")) await onSaved(); }}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Schedule</Button>
					</div>
				</DialogFooter>
				<TemplatePicker kind="post" open={pickTpl} title="Post templates" onClose={() => setPickTpl(false)} onPick={(t) => { if (t) setV((cur) => (cur ? { ...cur, body: cur.body?.trim() ? `${cur.body}

${t.body}` : t.body } : cur)); setPickTpl(false); }} />
			</DialogContent>
		</Dialog>
	);
}


function Tile({ icon: Icon, title, hint, tint, onClick, href }: { icon: typeof Plus; title: string; hint: string; tint: string; onClick?: () => void; href?: string }) {
	const cls = cn("rounded-2xl border border-black/5 p-4 text-left shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:-translate-y-0.5 hover:shadow-md", tint);
	const body = (
		<>
			<span className="mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 text-sauti-teal"><Icon className="h-4 w-4" /></span>
			<span className="block text-sm font-bold text-serene-neutral-900">{title}</span>
			<span className="block text-xs text-serene-neutral-600">{hint}</span>
		</>
	);
	return href ? <Link href={href} className={cn(cls, "block")}>{body}</Link> : <button onClick={onClick} className={cls}>{body}</button>;
}
