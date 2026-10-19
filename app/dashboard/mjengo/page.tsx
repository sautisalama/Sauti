"use client";

import { MjengoLoader } from "@/app/dashboard/mjengo/_components/MjengoLoader";
import Link from "next/link";
import { useEffect, useState } from "react";
import { format, parseISO } from "date-fns";
import { Briefcase, CheckSquare, ClipboardList, FileWarning, FolderKanban, Lightbulb, Mail, Megaphone, Settings2, TrendingUp } from "lucide-react";
import { getOverview, listEntities, type Overview } from "@/app/actions/mjengo";
import { suiteStatus, type SuiteStatus } from "@/app/actions/mjengo-nav";
import { GrantCharts, type GrantLite } from "./_components/GrantCharts";
import { WorkspaceSearch } from "./_components/WorkspaceSearch";
import { DigestCard } from "./_components/DigestCard";
import { DeadlineChip, KIND_LABEL, STATUSES, money, type Kind } from "./_components/shared";

const KIND_ICON = { grant: Briefcase, opportunity: Lightbulb, project: FolderKanban, document: FileWarning, todo: CheckSquare } as const;

export default function MjengoOverview() {
	const [o, setO] = useState<Overview | null>(null);
	const [grants, setGrants] = useState<GrantLite[]>([]);
	const [st, setSt] = useState<SuiteStatus | null>(null);

	useEffect(() => {
		getOverview().then(setO).catch(() => undefined);
		suiteStatus().then(setSt).catch(() => undefined);
		listEntities("grant").then((g) => setGrants(g as unknown as GrantLite[])).catch(() => undefined);
	}, []);

	if (!o) return <MjengoLoader label="Loading your overview" />;

	const cur = o.currencies[0] ?? "USD";

	// Only opportunities still in play: not won, lost or passed.
	const liveOpps = o.opportunitiesByStatus.filter((x) => !["won", "lost", "passed"].includes(x.status));
	const liveCount = liveOpps.reduce((n, x) => n + x.count, 0);
	const today = new Date().toISOString().slice(0, 10);
	const nextOppDeadline = o.deadlines.find((d) => d.kind === "opportunity" && d.date >= today);
	const dueSoon = o.deadlines.filter((d) => d.kind === "opportunity" && d.date >= today && d.date <= new Date(Date.now() + 14 * 86400_000).toISOString().slice(0, 10)).length;
	const pending = st?.todos.pending ?? o.openTodos;
	// Cards that mean nothing yet are left out; the colours follow the order of what is shown.
	const liveProjects = o.projectsByStatus.filter((x) => !["completed", "cancelled"].includes(x.status));
	const showSide = liveCount > 0 || liveProjects.length > 0;
	const hasContent = !!st && (st.content.posted + st.content.scheduled + st.content.drafts > 0);
	const cards: StatProps[] = [
		liveCount > 0 && { key: "pipeline", icon: TrendingUp, label: "In the pipeline", value: String(liveCount), hint: dueSoon ? `${dueSoon} due in two weeks` : nextOppDeadline ? `next deadline ${format(parseISO(nextOppDeadline.date), "d MMM")}` : `live ${liveCount === 1 ? "opportunity" : "opportunities"}`, href: "/dashboard/mjengo/opportunities", tone: dueSoon ? "warn" as const : undefined },
		o.pipelineValue > 0 && { key: "grants", icon: Briefcase, label: "Grants in progress", value: money(o.pipelineValue, cur), hint: o.currencies.length > 1 ? `${cur} grants only` : "applying or under review", href: "/dashboard/mjengo/grants" },
		o.awardedValue > 0 && { key: "awarded", icon: Briefcase, label: "Awarded", value: money(o.awardedValue, cur), hint: "awarded or reporting", href: "/dashboard/mjengo/grants" },
		o.missingDocs > 0 && { key: "docs", icon: FileWarning, label: "Documents needed", value: String(o.missingDocs), hint: "required, not uploaded", tone: "warn" as const, href: "/dashboard/mjengo/documents" },
		pending > 0 && { key: "todos", icon: CheckSquare, label: "Pending to-dos", value: String(pending), hint: st?.todos.overdue ? `${st.todos.overdue} overdue, ${st.todos.mine} yours` : `${st?.todos.mine ?? o.myTodos} yours`, tone: st?.todos.overdue ? "warn" as const : undefined, href: "/dashboard/mjengo/todos" },
		!!st && (st.forms.open > 0 || st.forms.newResponses > 0) && { key: "forms", icon: ClipboardList, label: "Open forms", value: String(st.forms.open), hint: st.forms.newResponses ? `${st.forms.newResponses} new responses` : "no new responses", tone: st.forms.newResponses ? "warn" as const : undefined, href: "/dashboard/mjengo/forms" },
	].filter(Boolean) as StatProps[];

	return (
		<div className="mx-auto max-w-6xl space-y-6">
			<DigestCard />

			<WorkspaceSearch />

			<div className={`grid grid-cols-2 gap-3 ${cards.length >= 5 ? "lg:grid-cols-5" : cards.length === 4 ? "lg:grid-cols-4" : cards.length === 3 ? "lg:grid-cols-3" : "lg:grid-cols-2"}`}>
				{cards.map(({ key, ...c }, i) => <Stat key={key} tint={TINTS[i % TINTS.length]} {...c} />)}
			</div>

			{st && (hasContent || st.setup.length > 0) && (
				<div className={`grid gap-4 ${hasContent && st.setup.length > 0 ? "lg:grid-cols-2" : ""}`}>
					{hasContent && <section className="rounded-2xl border border-serene-neutral-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
						<div className="mb-3 flex items-center justify-between"><h3 className="flex items-center gap-2 text-sm font-bold text-sauti-dark"><Megaphone className="h-4 w-4 text-sauti-teal" /> Shared online</h3><Link href="/dashboard/mjengo/design#schedule" className="text-xs font-medium text-sauti-teal hover:underline">Schedule content</Link></div>
						<div className="grid grid-cols-3 gap-2 text-center">
							<div className="rounded-xl bg-serene-neutral-50 p-3"><p className="text-xl font-bold tabular-nums">{st.content.posted}</p><p className="text-xs text-serene-neutral-500">Posted</p></div>
							<div className="rounded-xl bg-serene-neutral-50 p-3"><p className="text-xl font-bold tabular-nums">{st.content.scheduled}</p><p className="text-xs text-serene-neutral-500">Scheduled</p></div>
							<div className="rounded-xl bg-serene-neutral-50 p-3"><p className="text-xl font-bold tabular-nums">{st.content.drafts}</p><p className="text-xs text-serene-neutral-500">Drafts</p></div>
						</div>
						{st.content.lastPosted && <p className="mt-2 text-xs text-serene-neutral-500">Last posted {format(parseISO(st.content.lastPosted), "d MMM, HH:mm")}</p>}
					</section>}
					{st.setup.length > 0 && <section className="rounded-2xl border border-serene-neutral-200/70 bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
						<h3 className="mb-3 flex items-center gap-2 text-sm font-bold text-sauti-dark"><Settings2 className="h-4 w-4 text-sauti-teal" /> Still to set up</h3>
						{(
							<ul className="space-y-1">
								{st.setup.map((i) => (
									<li key={i.id}>{i.href.startsWith("/api/") ? <a href={i.href} className="block rounded-lg px-2 py-1.5 hover:bg-serene-neutral-50"><span className="block text-sm font-medium text-serene-neutral-900">{i.label}</span><span className="block text-xs text-serene-neutral-500">{i.hint}</span></a> : <Link href={i.href} className="block rounded-lg px-2 py-1.5 hover:bg-serene-neutral-50"><span className="block text-sm font-medium text-serene-neutral-900">{i.label}</span><span className="block text-xs text-serene-neutral-500">{i.hint}</span></Link>}</li>
								))}
							</ul>
						)}
					</section>}
				</div>
			)}

			<GrantCharts grants={grants} />

			{(o.deadlines.length > 0 || showSide) && <div className="grid gap-4 lg:grid-cols-3">
				<section className={`rounded-2xl border border-serene-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-4 ${showSide ? "lg:col-span-2" : "lg:col-span-3"}`}>
					<h3 className="mb-3 text-sm font-bold text-sauti-dark">Coming up</h3>
					{o.deadlines.length === 0 ? (
						<p className="text-sm text-serene-neutral-500">No deadlines tracked yet. Add dates to grants, opportunities, documents and tasks and they appear here.</p>
					) : (
						<ul className="divide-y divide-serene-neutral-50">
							{o.deadlines.slice(0, 12).map((d, i) => {
								const Icon = KIND_ICON[d.kind];
								return (
									<li key={i}>
										<Link href={d.href} className="flex items-center gap-3 py-2.5 hover:bg-serene-neutral-50">
											<span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sauti-teal-light/40 text-sauti-teal"><Icon className="h-4 w-4" /></span>
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

				{showSide && (
					<div className="space-y-4">
						{liveCount > 0 && <Breakdown title="Opportunities in play" kind="opportunity" data={liveOpps} href="/dashboard/mjengo/opportunities" />}
						{liveProjects.length > 0 && <Breakdown title="Projects" kind="project" data={liveProjects} href="/dashboard/mjengo/projects" />}
					</div>
				)}
			</div>}
		</div>
	);
}

interface StatProps { key: string; icon: typeof Mail; label: string; value: string; hint: string; href: string; tone?: "warn" }
const TINTS = ["bg-sauti-teal-light", "bg-serene-green-100", "bg-sauti-yellow-light", "bg-serene-blue-50", "bg-white"];

function Stat({ icon: Icon, label, value, hint, href, tone, tint }: Omit<StatProps, "key"> & { tint: string }) {
	return (
		<Link href={href} className={`rounded-2xl border border-black/5 ${tint} p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:-translate-y-0.5 hover:shadow-md`}>
			<div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white/80 ${tone === "warn" ? "text-amber-600" : "text-sauti-teal"}`}><Icon className="h-4 w-4" /></div>
			<p className="text-xl font-bold tabular-nums text-serene-neutral-900">{value}</p>
			<p className="text-xs font-semibold text-serene-neutral-700">{label}</p>
			<p className="text-xs text-serene-neutral-500">{hint}</p>
		</Link>
	);
}

function Breakdown({ title, kind, data, href }: { title: string; kind: Kind; data: { status: string; count: number }[]; href: string }) {
	const total = data.reduce((n, d) => n + d.count, 0);
	return (
		<Link href={href} className="block rounded-2xl border border-serene-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] p-4 transition hover:shadow-md">
			<div className="mb-2 flex items-baseline justify-between"><h3 className="text-sm font-bold text-sauti-dark">{title}</h3><span className="text-xs text-serene-neutral-500">{total} total</span></div>
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
