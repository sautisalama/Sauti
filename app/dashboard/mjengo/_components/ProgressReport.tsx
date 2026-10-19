"use client";

import { useState } from "react";
import Link from "next/link";
import { FileText, Loader2, NotebookPen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { unwrap } from "@/lib/action-result";
import { progressReport } from "@/app/actions/mjengo-reports";
import type { Kind } from "./shared";

/**
 * A draft progress report for a funder or partner, written from this record's own history (what happened, what was
 * decided in calls, what is done and what is late) and saved as a Word file in your vault, on this record's timeline.
 * Whatever the record does not say is left as [to confirm] for you to fill in.
 */
export function ProgressReport({ kind, id }: { kind: Kind; id: string }) {
	const { toast } = useToast();
	const [months, setMonths] = useState(6);
	const [busy, setBusy] = useState(false);
	const [done, setDone] = useState<{ name: string; link: string; words: number } | null>(null);
	const run = async () => {
		setBusy(true);
		try { setDone(await unwrap(progressReport(kind, id, months))); } catch (e) { toast({ title: "The report could not be written", description: e instanceof Error ? e.message : undefined, variant: "destructive" }); } finally { setBusy(false); }
	};
	return (
		<div className="rounded-xl border border-serene-neutral-100 p-3">
			<div className="flex flex-wrap items-center gap-2">
				<p className="mr-auto flex items-center gap-1.5 text-sm font-semibold text-serene-neutral-900"><NotebookPen className="h-4 w-4 text-sauti-teal" /> Progress report</p>
				<select value={months} onChange={(e) => setMonths(Number(e.target.value))} aria-label="Period covered" className="h-8 rounded-full border border-serene-neutral-200 bg-white px-2 text-xs">
					{[3, 6, 12].map((m) => <option key={m} value={m}>Last {m} months</option>)}
				</select>
				<Button type="button" size="sm" variant="outline" className="h-8 gap-1.5 rounded-full text-xs" disabled={busy} onClick={() => void run()}>{busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <NotebookPen className="h-3.5 w-3.5 text-sauti-teal" />} Draft a report</Button>
			</div>
			{done && <p className="mt-2 text-xs text-serene-neutral-600">Saved to your vault, in Reports ({done.words} words): <Link href={done.link} className="inline-flex items-center gap-1 font-medium text-sauti-teal hover:underline"><FileText className="h-3 w-3" />{done.name}</Link>. Check every [to confirm] before it is sent.</p>}
		</div>
	);
}
