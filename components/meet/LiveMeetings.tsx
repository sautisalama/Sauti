"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Copy, Radio, Video } from "lucide-react";
import { formatDistanceToNowStrict } from "date-fns";
import { unwrap } from "@/lib/action-result";
import { myLiveMeetings, type LiveMeeting } from "@/app/actions/mjengo-meet";

/** Meetings you started that are still going on, with a way back in. Shown in Meet and on the overview. */
export function LiveMeetings() {
	const [items, setItems] = useState<LiveMeeting[] | null>(null);
	const [copied, setCopied] = useState<string | null>(null);
	const load = useCallback(() => { void unwrap(myLiveMeetings()).then(setItems).catch(() => setItems((cur) => cur ?? [])); }, []);
	useEffect(() => {
		load();
		const t = setInterval(() => { if (!document.hidden) load(); }, 45_000);
		return () => clearInterval(t);
	}, [load]);
	if (!items?.length) return null;
	return (
		<section aria-label="Meetings you started" className="rounded-2xl border border-[#068297]/25 bg-gradient-to-br from-[#e6f7f9] to-white p-4">
			<h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-sauti-dark"><Radio className="h-4 w-4 animate-pulse text-[#ea4335]" /> Meetings you started that are on</h3>
			<ul className="space-y-2">
				{items.map((m) => (
					<li key={m.code} className="flex flex-wrap items-center gap-3 rounded-xl border border-serene-neutral-200/70 bg-white p-3">
						<span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sauti-teal-light text-sauti-teal"><Video className="h-4 w-4" /></span>
						<div className="min-w-0 flex-1">
							<p className="truncate text-sm font-semibold text-serene-neutral-900">{m.title || "Meeting"}</p>
							<p className="text-xs text-serene-neutral-500">Started {formatDistanceToNowStrict(new Date(m.created_at), { addSuffix: true })} · {m.code}</p>
						</div>
						<button
							onClick={() => { void navigator.clipboard.writeText(`${window.location.origin}/meet/${m.code}`).then(() => { setCopied(m.code); setTimeout(() => setCopied((c) => (c === m.code ? null : c)), 1800); }); }}
							className="flex items-center gap-1.5 rounded-full border border-serene-neutral-200 px-3 py-1.5 text-xs font-medium text-serene-neutral-700 hover:bg-serene-neutral-50"
						>
							{copied === m.code ? <Check className="h-3.5 w-3.5 text-[#137333]" /> : <Copy className="h-3.5 w-3.5" />} {copied === m.code ? "Copied" : "Copy link"}
						</button>
						<Link href={`/meet/${m.code}`} className="rounded-full bg-sauti-teal px-4 py-1.5 text-xs font-semibold text-white hover:bg-sauti-dark">Rejoin</Link>
					</li>
				))}
			</ul>
		</section>
	);
}
