"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Briefcase, CheckSquare, FileWarning, FolderKanban, Lightbulb, Loader2, Mail, TrendingUp } from "lucide-react";
import { getOverview, listEntities, type Overview } from "@/app/actions/mjengo";
import { GrantCharts, type GrantLite } from "./_components/GrantCharts";
import { DeadlineChip, KIND_LABEL, STATUSES, money, type Kind } from "./_components/shared";

const KIND_ICON = { grant: Briefcase, opportunity: Lightbulb, project: FolderKanban, document: FileWarning, todo: CheckSquare } as const;

export default function MjengoOverview() {
	const [o, setO] = useState<Overview | null>(null);
	const [grants, setGrants] = useState<GrantLite[]>([]);

	useEffect(() => {
		getOverview().then(setO).catch(() => undefined);
		listEntities("grant").then((g) => setGrants(g as unknown as GrantLite[])).catch(() => undefined);
	}, []);

	if (!o) return <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-serene-neutral-400" /></div>;

	const cur = o.currencies[0] ?? "USD";

	return (
		<div className="space-y-6">
			<div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
				<Stat icon={TrendingUp} label="In the pipeline" value={money(o.pipelineValue, cur)} hint={o.currencies.length > 1 ? `${cur} grants only` : "open grants"} href="/dashboard/admin/mjengo/grants" />
				<Stat icon={Briefcase} label="Awarded" value={money(o.awardedValue, cur)} hint="awarded or reporting" href="/dashboard/admin/mjengo/grants" />
				<Stat icon={FileWarning} label="Documents needed" value={String(o.missingDocs)} hint="required, not uploaded" tone={o.missingDocs ? "warn" : undefined} href="/dashboard/admin/mjengo/documents" />
				<Stat icon={CheckSquare} label="Open to-dos" value={String(o.openTodos)} hint={`${o.myTodos} yours`} href="/dashboard/admin/mjengo/todos" />
				<Stat icon={Mail} label="Mail" value="Open" hint="connect an inbox" href="/dashboard/admin/mjengo/mail" />
			</div>

			<GrantCharts grants={grants} />

			<div className="grid gap-4 lg:grid-cols-3">
				<section className="rounded-2xl border border-serene-neutral-100 bg-white p-4 lg:col-span-2">
					<h3 className="mb-3 text-sm font-bold text-serene-neutral-900">Coming up</h3>
					{o.deadlines.length === 0 ? (
						<p className="text-sm text-serene-neutral-500">No deadlines tracked yet. Add dates to grants, opportunities, documents and tasks and they appear here.</p>
					) : (
						<ul className="divide-y divide-serene-neutral-50">
							{o.deadlines.slice(0, 12).map((d, i) => {
								const Icon = KIND_ICON[d.kind];
								return (
									<li key={i}>
										<Link href={d.href} className="flex items-center gap-3 py-2.5 hover:bg-serene-neutral-50">
											<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-purple-50 text-purple-700"><Icon className="h-4 w-4" /></span>
											<span className="min-w-0 flex-1">
												<span className="block truncate text-sm font-medium text-serene-neutral-900">{d.label}</span>
												<span className="block text-xs text-serene-neutral-500">{d.kind === "document" ? "Document needed" : d.kind === "todo" ? "Task" : KIND_LABEL[d.kind as Kind]} · {format(parseISO(d.date), "EEE d MMM")}</span>
											</span>
											<DeadlineChip date={d.date} />
										</Link>
									</li>
								);
							})}
						</ul>
					)}
				</section>

				<div className="space-y-4">
					<Breakdown title="Opportunities" kind="opportunity" data={o.opportunitiesByStatus} href="/dashboard/admin/mjengo/opportunities" />
					<Breakdown title="Projects" kind="project" data={o.projectsByStatus} href="/dashboard/admin/mjengo/projects" />
				</div>
			</div>
		</div>
	);
}

function Stat({ icon: Icon, label, value, hint, href, tone }: { icon: typeof Mail; label: string; value: string; hint: string; href: string; tone?: "warn" }) {
	return (
		<Link href={href} className="rounded-2xl border border-serene-neutral-100 bg-white p-4 transition hover:shadow-md">
			<div className={`mb-2 flex h-8 w-8 items-center justify-center rounded-lg ${tone === "warn" ? "bg-amber-100 text-amber-700" : "bg-purple-50 text-purple-700"}`}><Icon className="h-4 w-4" /></div>
			<p className="text-xl font-bold tabular-nums text-serene-neutral-900">{value}</p>
			<p className="text-xs font-semibold text-serene-neutral-700">{label}</p>
			<p className="text-xs text-serene-neutral-500">{hint}</p>
		</Link>
	);
}

function Breakdown({ title, kind, data, href }: { title: string; kind: Kind; data: { status: string; count: number }[]; href: string }) {
	const total = data.reduce((n, d) => n + d.count, 0);
	return (
		<Link href={href} className="block rounded-2xl border border-serene-neutral-100 bg-white p-4 transition hover:shadow-md">
			<div className="mb-2 flex items-baseline justify-between"><h3 className="text-sm font-bold text-serene-neutral-900">{title}</h3><span className="text-xs text-serene-neutral-500">{total} total</span></div>
			{total === 0 ? (
				<p className="text-sm text-serene-neutral-500">None yet.</p>
			) : (
				<>
					<div className="flex h-2.5 overflow-hidden rounded-full bg-serene-neutral-100" role="img" aria-label={`${title} by status`}>
						{STATUSES[kind].map((s) => {
							const n = data.find((d) => d.status === s.value)?.count ?? 0;
							return n ? <span key={s.value} style={{ width: `${(n / total) * 100}%`, background: s.color }} /> : null;
						})}
					</div>
					<ul className="mt-3 grid grid-cols-2 gap-x-3 gap-y-1">
						{STATUSES[kind].map((s) => {
							const n = data.find((d) => d.status === s.value)?.count ?? 0;
							return n ? <li key={s.value} className="flex items-center gap-1.5 text-xs text-serene-neutral-700"><span className="h-2 w-2 rounded-full" style={{ background: s.color }} />{s.label} <span className="ml-auto font-semibold">{n}</span></li> : null;
						})}
					</ul>
				</>
			)}
		</Link>
	);
}
