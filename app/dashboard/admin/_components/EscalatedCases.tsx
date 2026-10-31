"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CheckCircle2 } from "lucide-react";
import { listEscalatedCases } from "@/app/actions/admin-escalations";
import { unwrap } from "@/lib/action-result";
import { incidentLabel } from "@/lib/report-labels";
import { cn } from "@/lib/utils";
import type { StaleCase } from "@/lib/cases/escalation";

const SHOWN = 4;

const waited = (h: number) => (h >= 48 ? `${Math.floor(h / 24)} days` : `${h} hours`);

/** The cases that have gone 24 hours without anyone acting, at the top of the admin overview. */
export function EscalatedCases() {
	const [cases, setCases] = useState<StaleCase[] | null>(null);
	const [failed, setFailed] = useState(false);

	useEffect(() => {
		unwrap(listEscalatedCases())
			.then(setCases)
			.catch(() => setFailed(true));
	}, []);

	if (failed) return null;
	if (!cases) return <div className="h-24 animate-pulse rounded-2xl bg-serene-neutral-100" aria-hidden />;

	if (cases.length === 0) {
		return (
			<section aria-label="Escalated cases" className="flex items-center gap-3 rounded-2xl border border-teal-100 bg-teal-50/60 p-4">
				<CheckCircle2 className="h-5 w-5 text-teal-700" aria-hidden />
				<p className="text-sm text-neutral-800">
					<strong className="font-semibold">Nothing is waiting too long.</strong> Every report has been matched and answered within 24 hours.
				</p>
			</section>
		);
	}

	return (
		<section aria-label="Escalated cases" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
			<div className="flex items-center justify-between gap-3">
				<h2 className="flex items-center gap-2 text-base font-semibold text-amber-950">
					<AlertTriangle className="h-5 w-5" aria-hidden />
					{cases.length} {cases.length === 1 ? "case needs" : "cases need"} a person
				</h2>
				<Link href="/dashboard/admin/matching" className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-amber-950 underline underline-offset-2">
					Open matching <ArrowRight className="h-4 w-4" aria-hidden />
				</Link>
			</div>
			<ul className="mt-3 divide-y divide-amber-200/70">
				{cases.slice(0, SHOWN).map((c) => (
					<li key={`${c.kind}-${c.refId}`} className="flex items-start justify-between gap-3 py-2.5">
						<div className="min-w-0">
							<p className="truncate text-sm font-medium text-neutral-900">
								{incidentLabel(c.incident)}
								{c.area ? <span className="font-normal text-neutral-600"> · {c.area}</span> : null}
							</p>
							<p className="text-sm text-neutral-700">{c.reason}</p>
						</div>
						<div className="shrink-0 text-right">
							<p className="text-sm font-semibold text-neutral-900">{waited(c.hoursWaiting)}</p>
							{c.urgency && (
								<p className={cn("text-xs font-medium", c.urgency === "high" ? "text-red-700" : "text-neutral-600")}>{c.urgency} urgency</p>
							)}
						</div>
					</li>
				))}
			</ul>
			{cases.length > SHOWN && <p className="mt-2 text-sm text-neutral-700">and {cases.length - SHOWN} more in the matching pool.</p>}
		</section>
	);
}
