"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { format, parseISO } from "date-fns";
import { CheckCheck, FileSignature, Loader2, Phone, Sparkles, SquareCheck, Activity, Bell, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { unwrap } from "@/lib/action-result";
import { catchUp, digestBrief, getDigest, type DigestItem } from "@/app/actions/mjengo-workflow";
import type { DigestKind } from "@/lib/mjengo/digest";
import { Markdown } from "./Markdown";

const ICON: Record<DigestKind, typeof Bell> = { approval: FileSignature, task: SquareCheck, status: Activity, call: Phone, note: Bell, record: Plus };

/**
 * "Since you were away": what changed for this person since they last caught up. Approvals waiting on them come
 * first. Salama can read it out in a few lines; "I'm caught up" starts the next list from now.
 */
export function DigestCard() {
	const [d, setD] = useState<{ since: string; items: DigestItem[] } | null>(null);
	const [brief, setBrief] = useState<string | null>(null);
	const [busy, setBusy] = useState<"brief" | "done" | null>(null);
	const [all, setAll] = useState(false);
	useEffect(() => { unwrap(getDigest()).then(setD).catch(() => setD({ since: new Date().toISOString(), items: [] })); }, []);
	if (!d || d.items.length === 0) return null;
	const shown = all ? d.items : d.items.slice(0, 5);
	return (
		<section aria-label="Since you were away" className="rounded-2xl border border-[#b6e0e6] bg-[#f1fafb] p-4">
			<div className="mb-2 flex flex-wrap items-center gap-2">
				<h3 className="mr-auto flex items-center gap-2 text-sm font-bold text-sauti-dark"><Sparkles className="h-4 w-4 text-sauti-teal" /> Since you were away <span className="text-xs font-normal text-serene-neutral-500">{format(parseISO(d.since), "d MMM")} · {d.items.length} {d.items.length === 1 ? "thing" : "things"}</span></h3>
				<Button size="sm" variant="outline" className="h-8 gap-1.5 rounded-full bg-white text-xs" disabled={busy !== null} onClick={async () => { setBusy("brief"); try { setBrief(await unwrap(digestBrief())); } catch { setBrief("I could not write the summary just now."); } finally { setBusy(null); } }}>
					{busy === "brief" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5 text-sauti-teal" />} Catch me up
				</Button>
				<Button size="sm" variant="ghost" className="h-8 gap-1.5 rounded-full text-xs" disabled={busy !== null} onClick={async () => { setBusy("done"); try { await unwrap(catchUp()); setD({ since: new Date().toISOString(), items: [] }); } finally { setBusy(null); } }}>
					<CheckCheck className="h-3.5 w-3.5" /> I&apos;m caught up
				</Button>
			</div>
			{brief && <div className="mb-3 rounded-lg bg-white p-3 text-sm text-serene-neutral-800"><Markdown text={brief} /></div>}
			<ul className="space-y-1.5">
				{shown.map((i, n) => {
					const Icon = ICON[i.kind];
					const body = <><span className="block truncate text-sm font-medium text-serene-neutral-900">{i.title}</span>{i.detail && <span className="block truncate text-xs text-serene-neutral-600">{i.detail}</span>}</>;
					return (
						<li key={`${i.at}-${n}`} className="flex items-start gap-2.5 rounded-lg bg-white/70 px-2.5 py-2">
							<Icon className={`mt-0.5 h-4 w-4 shrink-0 ${i.kind === "approval" ? "text-amber-600" : "text-sauti-teal"}`} />
							<span className="min-w-0 flex-1">{i.link ? <Link href={i.link} className="block hover:underline">{body}</Link> : body}</span>
							<span className="shrink-0 text-[11px] text-serene-neutral-500">{format(parseISO(i.at), "d MMM")}</span>
						</li>
					);
				})}
			</ul>
			{d.items.length > 5 && <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 text-xs font-medium text-sauti-teal hover:underline">{all ? "Show fewer" : `Show all ${d.items.length}`}</button>}
		</section>
	);
}
