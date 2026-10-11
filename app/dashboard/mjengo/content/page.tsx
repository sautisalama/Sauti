"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { Check, ChevronLeft, ChevronRight, ClipboardCopy, ExternalLink, ImageIcon, Loader2, Palette, Plus, Send, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { CHANNELS, CHANNEL_INFO, type Channel } from "@/lib/mjengo/channels";
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

	const load = useCallback(async () => {
		const [p, a] = await Promise.all([unwrap(content.listPosts()), unwrap(ai.listAssets())]);
		setPosts(p);
		setAssets(a);
	}, []);
	useEffect(() => { load().catch(() => { setPosts([]); toast({ title: "Could not load content", variant: "destructive" }); }); }, [load, toast]);

	const days = useMemo(() => eachDayOfInterval({ start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }) }), [month]);
	const byDay = (d: Date) => (posts ?? []).filter((p) => p.scheduled_for && isSameDay(new Date(p.scheduled_for), d));
	const drafts = (posts ?? []).filter((p) => !p.scheduled_for && p.status === "draft");

	const start = (day?: Date) => {
		const when = day ? new Date(day) : null;
		if (when) when.setHours(9, 0, 0, 0);
		setEdit({ body: "", channels: ["linkedin"], media: [], status: "draft", whenLocal: when ? format(when, "yyyy-MM-dd'T'HH:mm") : "" });
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

function PostDialog({ post, assets, onClose, onSaved }: { post: (Partial<PostRow> & { whenLocal: string }) | null; assets: AssetRow[]; onClose: () => void; onSaved: () => Promise<void> }) {
	const { toast } = useToast();
	const [v, setV] = useState(post);
	const [busy, setBusy] = useState(false);
	useEffect(() => setV(post), [post]);
	if (!v) return null;

	const chosen: Channel[] = (v.channels as Channel[]) ?? [];
	const body = v.body ?? "";
	const toggle = (c: Channel) => setV({ ...v, channels: chosen.includes(c) ? chosen.filter((x) => x !== c) : [...chosen, c] });
	const tightest = chosen.length ? Math.min(...chosen.map((c) => CHANNEL_INFO[c].limit)) : Infinity;

	const save = async (status?: PostRow["status"]) => {
		setBusy(true);
		try {
			await unwrap(content.savePost((v.id as string | undefined) ?? null, {
				title: v.title ?? null,
				body,
				channels: chosen,
				media: v.media ?? [],
				scheduledFor: v.whenLocal ? new Date(v.whenLocal).toISOString() : null,
				status: status ?? (v.whenLocal ? "scheduled" : "draft"),
			}));
			await onSaved();
		} catch (e) {
			toast({ title: "Could not save", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setBusy(false);
		}
	};

	return (
		<Dialog open onOpenChange={(o) => !o && !busy && onClose()}>
			<DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
				<DialogHeader>
					<DialogTitle>{v.id ? "Edit post" : "New post"}</DialogTitle>
					<DialogDescription>Choose where it goes and when. You get a reminder at the scheduled time with the text ready to copy.</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="flex flex-wrap gap-2">
						{CHANNELS.map((c) => {
							const on = chosen.includes(c);
							return (
								<button key={c} type="button" onClick={() => toggle(c)} aria-pressed={on} className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium", on ? "border-sauti-teal bg-sauti-teal-light/40 text-sauti-dark" : "border-serene-neutral-200 text-serene-neutral-600")}>
									<span className="h-2 w-2 rounded-full" style={{ background: CHANNEL_INFO[c].color }} /> {CHANNEL_INFO[c].label} {on && <Check className="h-3.5 w-3.5" />}
								</button>
							);
						})}
					</div>

					<div className="space-y-1.5">
						<Textarea rows={7} value={body} onChange={(e) => setV({ ...v, body: e.target.value })} placeholder="What do you want to say?" aria-label="Post text" />
						<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
							{chosen.map((c) => (
								<span key={c} className={cn(body.length > CHANNEL_INFO[c].limit ? "font-semibold text-red-600" : "text-serene-neutral-500")}>{CHANNEL_INFO[c].label} {body.length}/{CHANNEL_INFO[c].limit}</span>
							))}
							{chosen.length === 0 && <span className="text-serene-neutral-400">Pick a channel to see its limit.</span>}
						</div>
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
					</div>

					{v.id && v.status === "scheduled" || v.status === "posted" ? (
						<div className="flex flex-wrap gap-2 rounded-xl bg-serene-neutral-50 p-3">
							<Button type="button" size="sm" variant="outline" className="gap-1.5" onClick={() => navigator.clipboard.writeText(body).then(() => toast({ title: "Copied" }))}><ClipboardCopy className="h-4 w-4" /> Copy text</Button>
							{chosen.map((c) => (
								<Button key={c} asChild size="sm" variant="outline" className="gap-1.5"><a href={CHANNEL_INFO[c].composeUrl(body)} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-4 w-4" /> {CHANNEL_INFO[c].label}</a></Button>
							))}
							{v.status !== "posted" && <Button type="button" size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700" disabled={busy} onClick={async () => { try { await unwrap(content.markPosted(v.id as string)); await onSaved(); } catch (e) { toast({ title: "Could not update", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } }}><Send className="h-4 w-4" /> Mark as posted</Button>}
						</div>
					) : null}
				</div>
				<DialogFooter className="gap-2 sm:justify-between">
					{v.id ? <Button variant="ghost" className="text-red-600" disabled={busy} onClick={async () => { if (window.confirm("Delete this post?")) { try { await unwrap(content.deletePost(v.id as string)); await onSaved(); } catch (e) { toast({ title: "Could not delete", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } } }}><Trash2 className="mr-2 h-4 w-4" /> Delete</Button> : <span />}
					<div className="flex gap-2">
						<Button variant="outline" disabled={busy || body.length > tightest} onClick={() => save("draft")}>Save draft</Button>
						<Button className="gap-2 bg-sauti-teal hover:bg-sauti-dark" disabled={busy || !v.whenLocal || body.length > tightest} onClick={() => save("scheduled")}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Schedule</Button>
					</div>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
