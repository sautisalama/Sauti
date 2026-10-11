"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { Check, ChevronLeft, ChevronRight, ClipboardCopy, ExternalLink, ImageIcon, Loader2, Palette, Plus, Send, Sparkles, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { CHANNELS, CHANNEL_INFO, textFor, type Channel } from "@/lib/mjengo/channels";
import * as content from "@/app/actions/mjengo-content";
import * as ai from "@/app/actions/mjengo-ai";
import type { PostRow } from "@/app/actions/mjengo-content";
import type { AssetRow } from "@/app/actions/mjengo-ai";
import { MjengoLoader } from "../_components/MjengoLoader";

const STATUS: Record<PostRow["status"], string> = { draft: "Draft", scheduled: "Scheduled", posted: "Posted", cancelled: "Cancelled" };
const toLocalInput = (iso: string | null) => (iso ? format(new Date(iso), "yyyy-MM-dd'T'HH:mm") : "");

export default function ContentPage() {
	const { toast } = useToast();
	const [tab, setTab] = useState<"calendar" | "studio">("calendar");
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
					<h2 className="text-xl font-bold tracking-tight text-sauti-dark">Content</h2>
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

			<ChannelsBar state={chan} onChanged={load} />

			{tab === "calendar" ? (
				<>
					<div className="overflow-hidden rounded-2xl border border-serene-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
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
					</div>

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
	const provider: Record<Channel, "linkedin" | "x" | "meta"> = { linkedin: "linkedin", x: "x", facebook: "meta", instagram: "meta" };
	return (
		<section aria-label="Connected accounts" className="flex flex-wrap items-center gap-2 rounded-2xl border border-serene-neutral-200/70 bg-white p-3">
			<span className="mr-1 text-sm font-semibold text-sauti-dark">Accounts</span>
			{state.connections.map((c) => (
				<span key={c.id} className="flex items-center gap-2 rounded-full border border-serene-neutral-200 py-1 pl-2.5 pr-1 text-sm">
					<span className="h-2 w-2 rounded-full" style={{ background: CHANNEL_INFO[c.channel].color }} />
					<span className="max-w-[160px] truncate">{CHANNEL_INFO[c.channel].label}: {c.account_name}</span>
					<button aria-label={`Disconnect ${c.account_name}`} onClick={async () => { try { await unwrap(content.disconnectChannel(c.id)); await onChanged(); } catch (e) { toast({ title: "Could not disconnect", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } }} className="rounded-full p-1 text-serene-neutral-400 hover:bg-serene-neutral-100 hover:text-red-600"><X className="h-3.5 w-3.5" /></button>
				</span>
			))}
			{CHANNELS.filter((c) => !state.connections.some((x) => x.channel === c)).map((c) => {
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

function PostDialog({ post, assets, state, onClose, onSaved }: { post: (Partial<PostRow> & { whenLocal: string }) | null; assets: AssetRow[]; state: content.ChannelsState | null; onClose: () => void; onSaved: () => Promise<void> }) {
	const { toast } = useToast();
	const [v, setV] = useState(post);
	const [busy, setBusy] = useState(false);
	const [tab, setTab] = useState<"shared" | Channel>("shared");
	useEffect(() => { setV(post); setTab("shared"); }, [post]);
	if (!v) return null;

	const chosen: Channel[] = (v.channels as Channel[]) ?? [];
	const body = v.body ?? "";
	const variants = v.variants ?? {};
	const toggle = (c: Channel) => setV({ ...v, channels: chosen.includes(c) ? chosen.filter((x) => x !== c) : [...chosen, c] });
	const setVariant = (c: Channel, patch: { body?: string; hashtags?: string[] }) => setV({ ...v, variants: { ...variants, [c]: { ...variants[c], ...patch } } });
	const finalText = (c: Channel) => textFor({ body, variants, link_url: v.link_url ?? null, title: v.title ?? null }, c);
	const over = chosen.filter((c) => finalText(c).length > CHANNEL_INFO[c].limit);
	const firstImage = assets.find((a) => (v.media ?? []).includes(a.id))?.url ?? null;
	const connected = (c: Channel) => !!state?.connections.some((x) => x.channel === c);

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
			<DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{v.id ? "Edit post" : "New post"}</DialogTitle>
					<DialogDescription>Write once, then adjust the wording, hashtags and link for each network. Each network has its own style and limits.</DialogDescription>
				</DialogHeader>
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
							<Textarea rows={6} value={body} onChange={(e) => setV({ ...v, body: e.target.value })} placeholder="What do you want to say?" aria-label="Post text" />
							<Input value={v.link_url ?? ""} onChange={(e) => setV({ ...v, link_url: e.target.value })} placeholder="Link to share (tracking tags are added for each network)" aria-label="Link" />
						</div>
					) : (
						<div className="space-y-2">
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

					<div className="space-y-1.5">
						<Label htmlFor="post-when" className="text-xs font-semibold">Post at</Label>
						<Input id="post-when" type="datetime-local" value={v.whenLocal} onChange={(e) => setV({ ...v, whenLocal: e.target.value })} />
						<p className="text-xs text-serene-neutral-500">Posts of 1 to 3 pm on weekdays tend to do well; check each network&apos;s insights for your own audience.</p>
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
				<DialogFooter className="gap-2 sm:justify-between">
					{v.id ? <Button variant="ghost" className="text-red-600" disabled={busy} onClick={async () => { if (window.confirm("Delete this post?")) { try { await unwrap(content.deletePost(v.id as string)); await onSaved(); } catch (e) { toast({ title: "Could not delete", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } } }}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button> : <span />}
					<div className="flex flex-wrap gap-2">
						<Button variant="outline" disabled={busy || over.length > 0} onClick={async () => { if (await save("draft")) await onSaved(); }}>Save draft</Button>
						{chosen.some(connected) && <Button variant="outline" className="gap-2" disabled={busy || over.length > 0 || !body.trim()} onClick={publishNow}><Send className="h-4 w-4" /> Publish now</Button>}
						<Button className="gap-2 bg-sauti-teal hover:bg-sauti-dark" disabled={busy || !v.whenLocal || over.length > 0} onClick={async () => { if (await save("scheduled")) await onSaved(); }}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Schedule</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
