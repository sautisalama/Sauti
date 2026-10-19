"use client";

import { useEffect, useRef, useState } from "react";
import { AlertTriangle, BadgeCheck, Check, ExternalLink, Globe, HelpCircle, Loader2, RefreshCw, ShieldAlert, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { verifyOpportunity } from "@/app/actions/mjengo-opportunity";
import { TRUST_LABEL, type TrustTier, type Verification } from "@/lib/mjengo/opportunity-types";
import { kindFromCategoryClient } from "./opportunity-kind";

const TONE: Record<TrustTier, string> = {
	verified: "bg-emerald-50 text-emerald-800 border-emerald-200",
	likely: "bg-sky-50 text-sky-800 border-sky-200",
	repost: "bg-amber-50 text-amber-900 border-amber-200",
	unverified: "bg-serene-neutral-100 text-serene-neutral-700 border-serene-neutral-200",
	suspicious: "bg-red-50 text-red-800 border-red-200",
};
const ICON: Record<TrustTier, React.ReactNode> = {
	verified: <BadgeCheck className="h-4 w-4" />,
	likely: <Globe className="h-4 w-4" />,
	repost: <AlertTriangle className="h-4 w-4" />,
	unverified: <HelpCircle className="h-4 w-4" />,
	suspicious: <ShieldAlert className="h-4 w-4" />,
};

/** What can be filled in from the verification, without overwriting what people typed. */
function patchFrom(v: Verification, values: Record<string, unknown>): Record<string, unknown> {
	const patch: Record<string, unknown> = {};
	const empty = (k: string) => values[k] == null || values[k] === "";
	// The link kept is the organisation's own page, not the post, short link or aggregator it was shared from.
	if (v.finalUrl && (v.useFinalLink || empty("source_url")) && values.source_url !== v.finalUrl) patch.source_url = v.finalUrl;
	if (v.title && (empty("title") || /^(shared opportunity|untitled)$/i.test(String(values.title)))) patch.title = v.title;
	if (v.organisation && empty("organisation")) patch.organisation = v.organisation;
	if (v.deadline && empty("deadline") && v.checks.find((c) => c.id === "deadline")?.ok) patch.deadline = v.deadline;
	const kind = kindFromCategoryClient(v.category);
	if (kind && (values.kind === "other" || empty("kind"))) patch.kind = kind;
	if (empty("description") || String(values.description).length < 40) {
		const text = [v.website?.description, v.eligibility && `Who can apply: ${v.eligibility}`, v.deliverables && `What is expected: ${v.deliverables}`].filter(Boolean).join("\n\n");
		if (text) patch.description = text;
	}
	return patch;
}

/**
 * Who an opportunity is really from. Even when it was shared from an Instagram post, the organisation's own
 * website is found and its details are shown, with the checks behind the trust level.
 */
export function OpportunityVerifyCard({ id, values, onFill, onChanged }: { id: string | null; values: Record<string, any>; onFill: (patch: Record<string, unknown>) => void; onChanged?: () => void }) {
	const url = String(values.source_url ?? "").trim();
	const text = String(values.description ?? "");
	const saved = (values.verification ?? null) as Verification | null;
	const [fresh, setFresh] = useState<Verification | null>(null);
	const [busy, setBusy] = useState(false);
	const [err, setErr] = useState<string | null>(null);
	const ran = useRef<string>("");
	const v = fresh ?? saved;

	const run = async () => {
		if (busy) return;
		setBusy(true); setErr(null);
		try {
			const r = await unwrap(verifyOpportunity({ id, url, text: text.length >= 20 ? text : undefined }));
			setFresh(r.verification);
			if (id) {
				onFill(patchFrom(r.verification, values));
				onChanged?.();
			}
		} catch (e) {
			setErr(e instanceof Error ? e.message : "Could not check that.");
		} finally {
			setBusy(false);
		}
	};

	// Check once, automatically, when there is a link and nothing was found yet.
	useEffect(() => {
		setFresh(null); setErr(null);
		const valid = /^https?:\/\/[^\s.]+\.[^\s]+/i.test(url);
		if (!valid || saved || ran.current === `${id}|${url}`) return;
		ran.current = `${id}|${url}`;
		const t = setTimeout(() => void run(), 900);
		return () => clearTimeout(t);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [id, url]);

	if (!url && !v && text.length < 20) return null;
	if (!v) {
		return (
			<div className="flex items-center gap-2 rounded-xl border border-dashed border-serene-neutral-200 p-3 text-xs text-serene-neutral-500">
				{busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Checking where this comes from...</> : err ? <>{err} <button className="font-semibold text-sauti-teal hover:underline" onClick={run}>Try again</button></> : <button className="font-semibold text-sauti-teal hover:underline" onClick={run}>Check where this comes from</button>}
			</div>
		);
	}

	const patch = patchFrom(v, values);
	const fillable = Object.keys(patch);
	const w = v.website;
	return (
		<div className="overflow-hidden rounded-xl border border-serene-neutral-200 bg-white">
			{w?.image && <img src={w.image} alt="" loading="lazy" className="aspect-[1.91/1] w-full bg-serene-neutral-50 object-cover" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />}
			<div className="space-y-3 p-3">
				<div className={cn("flex items-start gap-2 rounded-lg border px-2.5 py-2 text-xs", TONE[v.trust])}>
					<span className="mt-0.5 shrink-0">{ICON[v.trust]}</span>
					<span><span className="font-semibold">{TRUST_LABEL[v.trust].label}.</span> {v.trustReason}</span>
				</div>

				<div>
					<p className="text-[11px] font-semibold uppercase tracking-wide text-serene-neutral-500">From</p>
					<div className="mt-1 flex items-center gap-2">
						{w?.favicon && <img src={w.favicon} alt="" className="h-5 w-5 rounded-sm" onError={(e) => ((e.currentTarget as HTMLImageElement).style.display = "none")} />}
						<p className="min-w-0 truncate text-sm font-semibold text-serene-neutral-900">{v.organisation ?? "Organisation not found"}</p>
					</div>
					{w && <a href={w.url} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs text-sauti-teal hover:underline"><Globe className="h-3 w-3 shrink-0" /> {w.host} <ExternalLink className="h-3 w-3 shrink-0" /></a>}
					{v.account && <p className="mt-1 text-xs text-serene-neutral-500">Shared from the post by {v.account}</p>}
				</div>

				{(w?.title || w?.description) && (
					<div className="rounded-lg bg-serene-neutral-50 p-2.5">
						{w?.title && <p className="line-clamp-2 text-sm font-medium text-serene-neutral-900">{w.title}</p>}
						{w?.description && <p className="mt-0.5 line-clamp-3 text-xs text-serene-neutral-600">{w.description}</p>}
					</div>
				)}

				<ul className="space-y-1">
					{v.checks.map((c) => (
						<li key={c.id} className="flex items-start gap-2 text-xs text-serene-neutral-700">
							<span className={cn("mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full", c.ok ? "bg-emerald-100 text-emerald-700" : "bg-serene-neutral-100 text-serene-neutral-500")}>{c.ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}</span>
							<span>{c.label}{c.note && <span className="block text-[11px] text-serene-neutral-500">{c.note}</span>}</span>
						</li>
					))}
				</ul>

				{v.applyUrl && <a href={v.applyUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-semibold text-sauti-teal hover:underline">Apply link from the post <ExternalLink className="h-3 w-3" /></a>}
				{v.email && <p className="text-xs text-serene-neutral-600">Enquiries: <a className="text-sauti-teal hover:underline" href={`mailto:${v.email}`}>{v.email}</a></p>}

				<div className="flex flex-wrap items-center gap-2 pt-1">
					{fillable.length > 0 && <Button type="button" size="sm" variant="outline" onClick={() => onFill(patch)}>Fill empty fields ({fillable.length})</Button>}
					<Button type="button" size="sm" variant="ghost" className="gap-1.5" onClick={run} disabled={busy}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Check again</Button>
					<span className="ml-auto text-[11px] text-serene-neutral-400">{new Date(v.at).toLocaleDateString()}</span>
				</div>
				{err && <p className="text-xs text-red-600">{err}</p>}
				{v.error && !w && <p className="text-xs text-serene-neutral-500">{v.error}</p>}
			</div>
		</div>
	);
}
