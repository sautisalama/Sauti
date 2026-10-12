"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { CHANNELS, CHANNEL_INFO, type Channel } from "@/lib/mjengo/channels";
import * as content from "@/app/actions/mjengo-content";
import { suggestTimes } from "@/lib/mjengo/best-times";

/**
 * Asked once an image or banner has been made: where should it go? The website and each social network
 * are listed (with whether an account is linked), with a caption the AI can write, and the choice to
 * post now, schedule it, or keep it as a draft in Content.
 */
export function PostThis({ assetId, about, open, onClose, extraLink }: { assetId: string | null; about: string; open: boolean; onClose: () => void; extraLink?: string | null }) {
	const { toast } = useToast();
	const [state, setState] = useState<content.ChannelsState | null>(null);
	const [chosen, setChosen] = useState<Channel[]>([]);
	const [caption, setCaption] = useState("");
	const [when, setWhen] = useState("");
	const [busy, setBusy] = useState<"ai" | "go" | null>(null);
	const [tags, setTags] = useState<content.SocialTag[]>([]);
	const [taken, setTaken] = useState<Date[]>([]);

	useEffect(() => {
		if (!open) return;
		setChosen([]); setWhen(""); setCaption("");
		unwrap(content.channelsState()).then(setState).catch(() => setState(null));
		unwrap(content.listSocialTags()).then(setTags).catch(() => setTags([]));
		unwrap(content.listPosts()).then((p) => setTaken(p.filter((x) => x.scheduled_for && x.status !== "cancelled").map((x) => new Date(x.scheduled_for as string)))).catch(() => setTaken([]));
	}, [open]);
	const times = chosen.length ? suggestTimes(chosen, taken, new Date(), 4) : [];
	const toLocal = (iso: string) => { const d = new Date(iso); const p = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`; };

	const linked = (c: Channel) => c === "website" || !!state?.connections.some((x) => x.channel === c);
	const toggle = (c: Channel) => setChosen((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));
	const needsImage = chosen.some((c) => CHANNEL_INFO[c].needsImage) && !assetId;

	const write = async () => {
		setBusy("ai");
		try { setCaption(await unwrap(content.suggestCaption(about || "our work", chosen))); } catch (e) { toast({ title: "Could not write a caption", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setBusy(null); }
	};

	const go = async (mode: "now" | "schedule" | "draft") => {
		setBusy("go");
		try {
			const saved = await unwrap(content.savePost(null, {
				title: about.slice(0, 80) || null,
				body: caption,
				channels: chosen,
				media: assetId ? [assetId] : [],
				linkUrl: extraLink ?? null,
				scheduledFor: mode === "schedule" && when ? new Date(when).toISOString() : null,
				status: mode === "schedule" ? "scheduled" : "draft",
				// The people and hashtags marked "always add" for each chosen network.
				variants: Object.fromEntries(chosen.flatMap((c) => {
					const mentions = tags.filter((t) => t.channel === c && t.kind === "mention" && t.auto).map((t) => t.value);
					const hashtags = tags.filter((t) => t.channel === c && t.kind === "hashtag" && t.auto).map((t) => t.value);
					return mentions.length || hashtags.length ? [[c, { ...(mentions.length ? { mentions } : {}), ...(hashtags.length ? { hashtags } : {}) }]] : [];
				})),
			}));
			if (mode === "now") {
				const r = await unwrap(content.publishPostNow(saved.id));
				const bad = Object.entries(r).filter(([, x]) => !x.ok);
				toast(bad.length ? { title: "Some channels did not publish", description: bad.map(([c, x]) => `${CHANNEL_INFO[c as Channel]?.label ?? c}: ${x.message}`).join(" "), variant: "destructive" } : { title: "Posted" });
			} else toast({ title: mode === "schedule" ? "Scheduled" : "Saved as a draft", description: "You can change it in Content." });
			onClose();
		} catch (e) {
			toast({ title: "Could not do that", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
		} finally {
			setBusy(null);
		}
	};

	return (
		<Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
			<DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
				<DialogHeader>
					<DialogTitle>Post this?</DialogTitle>
					<DialogDescription>Choose where it should go. You can post now, schedule it, or keep it as a draft.</DialogDescription>
				</DialogHeader>
				<div className="space-y-4">
					<div className="flex flex-wrap gap-2">
						{CHANNELS.map((c) => {
							const on = chosen.includes(c);
							return (
								<button key={c} type="button" onClick={() => toggle(c)} aria-pressed={on} className={cn("flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium", on ? "border-sauti-teal bg-sauti-teal-light/40 text-sauti-dark" : "border-serene-neutral-200 text-serene-neutral-600")}>
									<span className="h-2 w-2 rounded-full" style={{ background: CHANNEL_INFO[c].color }} /> {CHANNEL_INFO[c].label}
									{on && <Check className="h-3.5 w-3.5" />}
									{!linked(c) && <span className="text-[10px] font-normal text-amber-700">not linked</span>}
								</button>
							);
						})}
					</div>
					<p className="text-xs text-serene-neutral-500">
						The website adds it as a draft for review. For networks that are not linked, link them in <Link href="/dashboard/mjengo/content" className="text-sauti-teal underline">Content</Link> (LinkedIn, X, Facebook, Instagram and TikTok).
					</p>

					<div className="space-y-1.5">
						<div className="flex items-center justify-between">
							<span className="text-xs font-semibold">Caption</span>
							<Button type="button" size="sm" variant="ghost" className="h-7 gap-1.5 text-xs" disabled={busy !== null} onClick={write}>{busy === "ai" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />} Write one for me</Button>
						</div>
						<Textarea rows={5} value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="Say something about it" />
					</div>
					{needsImage && <p className="text-xs text-amber-700">Instagram and TikTok need an image.</p>}

					<div className="space-y-1.5">
						<label htmlFor="pt-when" className="text-xs font-semibold">Schedule for</label>
						<Input id="pt-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
						{times.length > 0 && (
							<div className="pt-1">
								<p className="mb-1 text-[11px] font-medium text-serene-neutral-500">Best times for {chosen.map((c) => CHANNEL_INFO[c].label).join(", ")} (Nairobi)</p>
								<div className="flex flex-wrap gap-1.5">
									{times.map((t) => <button key={t.iso} type="button" title={t.why} onClick={() => setWhen(toLocal(t.iso))} className={cn("rounded-full border px-2.5 py-1 text-xs font-medium", when === toLocal(t.iso) ? "border-sauti-teal bg-sauti-teal-light/50" : "border-serene-neutral-200 hover:border-sauti-teal/50")}>{t.label}</button>)}
								</div>
							</div>
						)}
					</div>
				</div>
				<DialogFooter className="gap-2">
					<Button variant="ghost" onClick={onClose} disabled={busy !== null}>Not now</Button>
					<Button variant="outline" disabled={busy !== null || !chosen.length} onClick={() => go("draft")}>Save draft</Button>
					<Button variant="outline" disabled={busy !== null || !chosen.length || !when || !caption.trim()} onClick={() => go("schedule")}>Schedule</Button>
					<Button className="gap-2 bg-sauti-teal hover:bg-sauti-dark" disabled={busy !== null || !chosen.length || !caption.trim() || needsImage} onClick={() => go("now")}>{busy === "go" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Post now</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
