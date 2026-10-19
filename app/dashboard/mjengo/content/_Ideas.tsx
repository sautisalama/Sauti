"use client";

import { useRef, useState } from "react";
import { CalendarClock, Camera, Hash, HelpCircle, Lightbulb, Loader2, Sparkles, TrendingUp, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { cn } from "@/lib/utils";
import { CHANNEL_INFO, type Channel } from "@/lib/mjengo/channels";
import { contentIdeas, draftPosts, sharePhotoRegister, sharePhotoUpload, type DraftIdea } from "@/app/actions/mjengo-ideas";
import type { Ideas } from "@/lib/mjengo/ideas";

const NETWORKS: Channel[] = ["instagram", "linkedin", "x", "facebook", "tiktok"];

export type UseIdea = (idea: { body: string; channels: Channel[]; at?: string }) => void;

/** What to post, the hashtags to use and when to post, for each network, from search trends, the questions people ask and your own results. */
export function IdeasCard({ onUse }: { onUse: UseIdea }) {
	const { toast } = useToast();
	const [topic, setTopic] = useState("");
	const [channels, setChannels] = useState<Channel[]>(["instagram", "linkedin", "x"]);
	const [data, setData] = useState<Ideas | null>(null);
	const [busy, setBusy] = useState(false);
	const [drafts, setDrafts] = useState<DraftIdea[] | null>(null);
	const [writing, setWriting] = useState(false);

	const run = async (t = topic) => {
		setBusy(true); setDrafts(null);
		try { setData(await unwrap(contentIdeas(t, channels))); } catch (e) { toast({ title: "Could not find ideas", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setBusy(false); }
	};
	const write = async () => {
		if (!data) return;
		setWriting(true);
		try {
			const seeds = [
				...data.trends.filter((t) => t.fits !== false).slice(0, 3).map((t) => `Trending in Kenya today: ${t.title}${t.about ? ` (${t.about})` : ""}`),
				...data.questions.slice(0, 3).map((q) => `People ask: ${q}`),
				...data.occasions.slice(0, 2).map((o) => `Coming up: ${o.label} on ${o.date}`),
			];
			setDrafts(await unwrap(draftPosts(data.topic, channels, seeds)));
		} catch (e) { toast({ title: "Could not write drafts", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setWriting(false); }
	};
	const copy = (s: string) => { navigator.clipboard?.writeText(s).then(() => toast({ title: "Copied", description: s })).catch(() => undefined); };
	const toggle = (c: Channel) => setChannels((cur) => (cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]));

	return (
		<section className="rounded-2xl border border-serene-neutral-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] sm:p-5">
			<div className="mb-3 flex flex-wrap items-center gap-2">
				<Lightbulb className="h-4 w-4 text-sauti-teal" />
				<h3 className="text-base font-bold text-sauti-dark">What to post, and when</h3>
			</div>
			<form onSubmit={(e) => { e.preventDefault(); void run(); }} className="flex flex-wrap items-center gap-2">
				<Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="A topic, e.g. mental health, legal aid, safe housing" aria-label="Topic" className="min-w-[220px] flex-1" />
				<Button type="submit" disabled={busy} className="gap-1.5 bg-sauti-teal hover:bg-sauti-dark">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Find ideas</Button>
			</form>
			<div className="mt-2 flex flex-wrap gap-1.5">
				{NETWORKS.map((c) => <button key={c} type="button" onClick={() => toggle(c)} aria-pressed={channels.includes(c)} className={cn("rounded-full border px-3 py-1 text-xs font-medium", channels.includes(c) ? "border-sauti-teal bg-sauti-teal text-white" : "border-serene-neutral-200 text-serene-neutral-700 hover:bg-serene-neutral-50")}>{CHANNEL_INFO[c].label}</button>)}
			</div>

			{!data && !busy && <p className="mt-3 text-sm text-serene-neutral-500">Pick the networks and a topic (or leave it empty) to see what is trending in Kenya today, the questions people ask, the hashtags to use and the best times for each network.</p>}

			{data && (
				<div className="mt-4 space-y-5">
					{data.notes.length > 0 && <ul className="space-y-1 rounded-lg bg-amber-50 p-3 text-xs text-amber-900">{data.notes.map((n) => <li key={n}>{n}</li>)}</ul>}

					{data.ownTopics.length > 0 && !data.topic && (
						<div>
							<p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-serene-neutral-500">Topics from your own posts</p>
							<div className="flex flex-wrap gap-1.5">{data.ownTopics.map((t) => <button key={t} onClick={() => { setTopic(t); void run(t); }} className="rounded-full bg-sauti-teal-light px-3 py-1 text-xs font-medium text-sauti-dark hover:bg-sauti-teal hover:text-white">{t}</button>)}</div>
						</div>
					)}

					<div>
						<p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-serene-neutral-500"><CalendarClock className="h-3.5 w-3.5" /> Best times to post</p>
						<div className="grid gap-2 sm:grid-cols-2">
							{(Object.entries(data.times) as [Channel, NonNullable<Ideas["times"][Channel]>][]).map(([ch, plan]) => (
								<div key={ch} className="rounded-xl border border-serene-neutral-100 p-3">
									<p className="flex items-center gap-2 text-sm font-semibold text-serene-neutral-900">{CHANNEL_INFO[ch].label}<span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", plan.basis === "yours" ? "bg-emerald-100 text-emerald-800" : "bg-serene-neutral-100 text-serene-neutral-600")}>{plan.basis === "yours" ? "Your results" : "Typical"}</span></p>
									<div className="mt-1.5 flex flex-wrap gap-1.5">
										{plan.slots.map((s) => s.iso
											? <button key={s.label} onClick={() => onUse({ body: "", channels: [ch], at: s.iso })} title="Start a post at this time" className="rounded-full border border-serene-neutral-200 px-2.5 py-1 text-xs hover:border-sauti-teal hover:text-sauti-teal">{s.label}</button>
											: <span key={s.label} className="rounded-full border border-serene-neutral-200 px-2.5 py-1 text-xs">{s.label}</span>)}
									</div>
									<p className="mt-1.5 text-xs text-serene-neutral-500">{plan.why}</p>
								</div>
							))}
						</div>
					</div>

					<div>
						<p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-serene-neutral-500"><Hash className="h-3.5 w-3.5" /> Hashtags</p>
						<div className="space-y-2">
							{(Object.entries(data.hashtags) as [Channel, { tag: string; why: string }[]][]).map(([ch, tags]) => (
								<div key={ch} className="flex flex-wrap items-center gap-1.5">
									<span className="w-20 shrink-0 text-xs font-medium text-serene-neutral-700">{CHANNEL_INFO[ch].label}</span>
									{tags.map((t) => <button key={t.tag} onClick={() => copy(t.tag)} title={`${t.why}. Click to copy.`} className="rounded-full bg-serene-neutral-100 px-2.5 py-1 text-xs text-serene-neutral-800 hover:bg-sauti-teal-light">{t.tag}</button>)}
									<button onClick={() => copy(tags.map((t) => t.tag).join(" "))} className="text-xs text-sauti-teal hover:underline">Copy all</button>
								</div>
							))}
						</div>
						<p className="mt-1.5 text-xs text-serene-neutral-500">Few, well chosen tags do better than many: Instagram 5, LinkedIn 3, X 2.</p>
					</div>

					{data.trends.length > 0 && (
						<div>
							<p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-serene-neutral-500"><TrendingUp className="h-3.5 w-3.5" /> Trending in Kenya today</p>
							<ul className="grid gap-1.5 sm:grid-cols-2">
								{data.trends.map((t) => (
									<li key={t.title}>
										<button onClick={() => onUse({ body: `${t.title}: `, channels })} className="flex w-full items-center gap-2 rounded-lg border border-serene-neutral-100 px-3 py-2 text-left text-sm hover:bg-serene-neutral-50">
											<span className="min-w-0 flex-1"><span className="block truncate font-medium text-serene-neutral-900">{t.title}</span>{t.about && <span className="block truncate text-xs text-serene-neutral-500">{t.about}</span>}</span>
											{t.fits === true && <span className="shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">Fits your work</span>}
											{t.fits === false && <span className="shrink-0 rounded-full bg-serene-neutral-100 px-2 py-0.5 text-[10px] text-serene-neutral-500">Probably not</span>}
											{t.traffic && <span className="shrink-0 text-xs text-serene-neutral-500">{t.traffic}</span>}
										</button>
									</li>
								))}
							</ul>
						</div>
					)}

					{data.questions.length > 0 && (
						<div>
							<p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-serene-neutral-500"><HelpCircle className="h-3.5 w-3.5" /> Questions people ask about “{data.topic}”</p>
							<ul className="flex flex-wrap gap-1.5">{data.questions.map((q) => <li key={q}><button onClick={() => onUse({ body: `${q.charAt(0).toUpperCase()}${q.slice(1)}?\n\n`, channels })} className="rounded-full border border-serene-neutral-200 px-3 py-1 text-xs hover:border-sauti-teal hover:text-sauti-teal">{q}</button></li>)}</ul>
						</div>
					)}

					{data.occasions.length > 0 && (
						<div>
							<p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-serene-neutral-500">Coming up</p>
							<ul className="space-y-1">{data.occasions.slice(0, 5).map((o) => <li key={o.date + o.label}><button onClick={() => onUse({ body: `${o.label}: `, channels })} className="text-left text-sm text-serene-neutral-800 hover:text-sauti-teal"><span className="mr-2 text-xs text-serene-neutral-500">{o.days === 0 ? "Today" : `In ${o.days} day${o.days === 1 ? "" : "s"}`}</span>{o.label}</button></li>)}</ul>
						</div>
					)}

					<div className="border-t border-serene-neutral-100 pt-4">
						<Button variant="outline" onClick={write} disabled={writing || channels.length === 0} className="gap-1.5">{writing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Write post drafts from these</Button>
						{drafts && (
							<ul className="mt-3 space-y-2">
								{drafts.length === 0 && <li className="text-sm text-serene-neutral-500">No drafts came back. Try again.</li>}
								{drafts.map((d, i) => (
									<li key={i} className="rounded-xl border border-serene-neutral-100 p-3">
										<p className="text-xs font-semibold text-serene-neutral-500">{CHANNEL_INFO[d.channel].label}</p>
										<p className="mt-1 whitespace-pre-wrap text-sm text-serene-neutral-900">{d.text}</p>
										{d.why && <p className="mt-1 text-xs text-serene-neutral-500">{d.why}</p>}
										<Button size="sm" className="mt-2 bg-sauti-teal hover:bg-sauti-dark" onClick={() => onUse({ body: d.text, channels: [d.channel] })}>Use this</Button>
									</li>
								))}
							</ul>
						)}
					</div>
				</div>
			)}
		</section>
	);
}

/** Asks the team to share photos from their work, kept with the images so they can go into posts. */
export function SharePhotos({ onShared }: { onShared: () => void }) {
	const { toast } = useToast();
	const input = useRef<HTMLInputElement>(null);
	const [busy, setBusy] = useState(false);
	const [caption, setCaption] = useState("");

	const send = async (files: FileList | null) => {
		if (!files?.length) return;
		setBusy(true);
		let ok = 0;
		try {
			for (const f of Array.from(files).slice(0, 10)) {
				if (!f.type.startsWith("image/")) continue;
				const ext = (f.name.split(".").pop() ?? "jpg").toLowerCase();
				const up = await unwrap(sharePhotoUpload(ext));
				const put = await fetch(up.signedUrl, { method: "PUT", headers: { "Content-Type": f.type || "image/jpeg" }, body: f });
				if (!put.ok) throw new Error("The upload did not go through.");
				await unwrap(sharePhotoRegister(up.path, f.name.replace(/\.[^.]+$/, ""), f.type, caption.trim() || null));
				ok++;
			}
			if (ok) { toast({ title: ok === 1 ? "Photo shared" : `${ok} photos shared`, description: "They are in your images, ready to use in a post." }); setCaption(""); onShared(); }
		} catch (e) { toast({ title: "Could not share the photo", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setBusy(false); if (input.current) input.current.value = ""; }
	};

	return (
		<section className="flex flex-wrap items-center gap-3 rounded-2xl border border-dashed border-sauti-teal/40 bg-sauti-teal-light/40 p-4">
			<span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-sauti-teal"><Camera className="h-5 w-5" /></span>
			<div className="min-w-[200px] flex-1">
				<p className="text-sm font-semibold text-sauti-dark">Share photos from your work</p>
				<p className="text-xs text-serene-neutral-600">Posts with real photos get more response than graphics. Add events, the team, community days. Take care that anyone shown has agreed, and leave out survivors.</p>
			</div>
			<Input value={caption} onChange={(e) => setCaption(e.target.value)} placeholder="What is it? (optional)" aria-label="Photo caption" className="h-9 w-full bg-white sm:w-56" />
			<input ref={input} type="file" accept="image/*" multiple capture="environment" hidden onChange={(e) => void send(e.target.files)} />
			<Button onClick={() => input.current?.click()} disabled={busy} className="gap-1.5 bg-sauti-teal hover:bg-sauti-dark">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} Add photos</Button>
		</section>
	);
}
