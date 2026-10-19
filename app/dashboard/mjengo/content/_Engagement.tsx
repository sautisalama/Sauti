"use client";

import { useCallback, useEffect, useState } from "react";
import { format } from "date-fns";
import { ExternalLink, Heart, Loader2, MessageCircle, RefreshCw, TrendingUp, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unwrap } from "@/lib/action-result";
import { getEngagement, type ChannelEngagement, type Engagement } from "@/app/actions/mjengo-engagement";

const NAME = { instagram: "Instagram", facebook: "Facebook" } as const;
const n = (v: number) => v.toLocaleString("en-GB");

/** How the organisation's own Instagram and Facebook posts are doing, read through the accounts connected for posting. */
export function EngagementCard() {
	const [data, setData] = useState<Engagement | null>(null);
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState<string | null>(null);
	const load = useCallback(async () => {
		setBusy(true); setErr(null);
		try { setData(await unwrap(getEngagement())); } catch (e) { setErr(e instanceof Error ? e.message : "Could not read engagement."); } finally { setBusy(false); }
	}, []);
	useEffect(() => { void load(); }, [load]);

	return (
		<section className="rounded-2xl border border-serene-neutral-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-5">
			<div className="mb-3 flex items-center gap-2">
				<TrendingUp className="h-4 w-4 text-sauti-teal" />
				<h3 className="text-base font-bold text-sauti-dark">Engagement</h3>
				<span className="text-xs text-serene-neutral-500">{data ? `Checked ${format(new Date(data.checkedAt), "h:mm a")}` : ""}</span>
				<span className="flex-1" />
				<Button variant="ghost" size="sm" onClick={() => void load()} disabled={busy} className="gap-1.5">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Refresh</Button>
			</div>
			{err && <p className="text-sm text-red-600">{err}</p>}
			{!data && !err && <p className="flex items-center gap-2 text-sm text-serene-neutral-500"><Loader2 className="h-4 w-4 animate-spin" /> Reading your accounts</p>}
			{data && data.channels.length === 0 && <p className="text-sm text-serene-neutral-500">Connect Instagram or Facebook to see likes and comments here.</p>}
			<div className="grid gap-4 lg:grid-cols-2">
				{data?.channels.map((c) => <Channel key={c.channel + (c.account ?? "")} c={c} />)}
			</div>
		</section>
	);
}

function Channel({ c }: { c: ChannelEngagement }) {
	const top = [...c.posts].sort((a, b) => b.likes + b.comments * 2 - (a.likes + a.comments * 2)).slice(0, 3);
	return (
		<div className="rounded-xl border border-serene-neutral-100 p-3">
			<p className="text-sm font-semibold text-serene-neutral-900">{NAME[c.channel]} <span className="font-normal text-serene-neutral-500">{c.account}</span></p>
			<dl className="mt-2 grid grid-cols-4 gap-2 text-center">
				<Stat icon={Users} label="Followers" value={c.followers} />
				<Stat icon={Heart} label={`Likes, last ${c.posts.length}`} value={c.likes} />
				<Stat icon={MessageCircle} label="Comments" value={c.comments} />
				<Stat icon={TrendingUp} label="Reach" value={c.reach ?? undefined} />
			</dl>
			{c.note && <p className="mt-2 text-xs text-amber-700">{c.note}</p>}
			{top.length > 0 && (
				<>
					<p className="mb-1 mt-3 text-[11px] font-semibold uppercase tracking-wider text-serene-neutral-500">Doing best</p>
					<ul className="space-y-1.5">
						{top.map((p) => (
							<li key={p.id} className="flex items-start gap-2 text-sm">
								<span className="min-w-0 flex-1"><span className="line-clamp-2">{p.text || "(a picture)"}</span><span className="text-xs text-serene-neutral-500">{format(new Date(p.at), "d MMM")} · {n(p.likes)} likes · {n(p.comments)} comments{p.reach !== undefined ? ` · reach ${n(p.reach)}` : ""}</span></span>
								{p.url && <a href={p.url} target="_blank" rel="noopener noreferrer" aria-label="Open the post" className="mt-0.5 text-serene-neutral-400 hover:text-sauti-teal"><ExternalLink className="h-4 w-4" /></a>}
							</li>
						))}
					</ul>
				</>
			)}
		</div>
	);
}

function Stat({ icon: Icon, label, value }: { icon: typeof Heart; label: string; value?: number }) {
	return (
		<div className="rounded-lg bg-serene-neutral-50 px-1 py-2">
			<Icon className="mx-auto mb-0.5 h-3.5 w-3.5 text-serene-neutral-400" />
			<dd className="text-base font-bold text-sauti-dark">{value === undefined ? "–" : n(value)}</dd>
			<dt className="text-[10px] leading-tight text-serene-neutral-500">{label}</dt>
		</div>
	);
}
