"use client";

import { differenceInCalendarDays, format, parseISO } from "date-fns";
import { CalendarClock } from "lucide-react";
import { cn } from "@/lib/utils";

export type Kind = "grant" | "opportunity" | "project";

export const KIND_LABEL: Record<Kind, string> = { grant: "Grant", opportunity: "Opportunity", project: "Project" };
export const KIND_HREF: Record<Kind, string> = {
	grant: "/dashboard/admin/mjengo/grants",
	opportunity: "/dashboard/admin/mjengo/opportunities",
	project: "/dashboard/admin/mjengo/projects",
};

export interface StatusDef {
	value: string;
	label: string;
	/** tailwind classes for the pill */
	tone: string;
	/** hex for charts */
	color: string;
}

export const GRANT_STATUSES: StatusDef[] = [
	{ value: "idea", label: "Idea", tone: "bg-slate-100 text-slate-700", color: "#94a3b8" },
	{ value: "researching", label: "Researching", tone: "bg-sky-100 text-sky-800", color: "#38bdf8" },
	{ value: "drafting", label: "Drafting", tone: "bg-indigo-100 text-indigo-800", color: "#818cf8" },
	{ value: "submitted", label: "Submitted", tone: "bg-purple-100 text-purple-800", color: "#a855f7" },
	{ value: "under_review", label: "Under review", tone: "bg-amber-100 text-amber-800", color: "#f59e0b" },
	{ value: "awarded", label: "Awarded", tone: "bg-emerald-100 text-emerald-800", color: "#10b981" },
	{ value: "declined", label: "Declined", tone: "bg-rose-100 text-rose-800", color: "#f43f5e" },
	{ value: "reporting", label: "Reporting", tone: "bg-teal-100 text-teal-800", color: "#14b8a6" },
	{ value: "closed", label: "Closed", tone: "bg-neutral-100 text-neutral-600", color: "#a3a3a3" },
];

export const OPPORTUNITY_STATUSES: StatusDef[] = [
	{ value: "new", label: "New", tone: "bg-slate-100 text-slate-700", color: "#94a3b8" },
	{ value: "evaluating", label: "Evaluating", tone: "bg-sky-100 text-sky-800", color: "#38bdf8" },
	{ value: "pursuing", label: "Pursuing", tone: "bg-indigo-100 text-indigo-800", color: "#818cf8" },
	{ value: "applied", label: "Applied", tone: "bg-purple-100 text-purple-800", color: "#a855f7" },
	{ value: "won", label: "Won", tone: "bg-emerald-100 text-emerald-800", color: "#10b981" },
	{ value: "lost", label: "Lost", tone: "bg-rose-100 text-rose-800", color: "#f43f5e" },
	{ value: "passed", label: "Passed", tone: "bg-neutral-100 text-neutral-600", color: "#a3a3a3" },
];

export const PROJECT_STATUSES: StatusDef[] = [
	{ value: "planning", label: "Planning", tone: "bg-slate-100 text-slate-700", color: "#94a3b8" },
	{ value: "active", label: "Active", tone: "bg-emerald-100 text-emerald-800", color: "#10b981" },
	{ value: "on_hold", label: "On hold", tone: "bg-amber-100 text-amber-800", color: "#f59e0b" },
	{ value: "completed", label: "Completed", tone: "bg-purple-100 text-purple-800", color: "#a855f7" },
	{ value: "cancelled", label: "Cancelled", tone: "bg-rose-100 text-rose-800", color: "#f43f5e" },
];

export const STATUSES: Record<Kind, StatusDef[]> = { grant: GRANT_STATUSES, opportunity: OPPORTUNITY_STATUSES, project: PROJECT_STATUSES };

export const statusDef = (kind: Kind, value: string) => STATUSES[kind].find((s) => s.value === value) ?? STATUSES[kind][0];

export function StatusPill({ kind, value }: { kind: Kind; value: string }) {
	const s = statusDef(kind, value);
	return <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", s.tone)}>{s.label}</span>;
}

export function money(amount: number | null | undefined, currency = "USD") {
	if (amount == null) return "—";
	try {
		return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
	} catch {
		return `${currency} ${amount.toLocaleString()}`;
	}
}

/** "in 3 days", "due today", "5 days overdue" with colour that escalates as it gets close. */
export function DeadlineChip({ date, done = false, className }: { date: string | null | undefined; done?: boolean; className?: string }) {
	if (!date) return null;
	const days = differenceInCalendarDays(parseISO(date), new Date());
	const tone = done
		? "bg-neutral-100 text-neutral-500"
		: days < 0
			? "bg-rose-100 text-rose-700"
			: days <= 7
				? "bg-amber-100 text-amber-800"
				: "bg-serene-neutral-100 text-serene-neutral-700";
	const text = done ? format(parseISO(date), "d MMM") : days < 0 ? `${-days}d overdue` : days === 0 ? "Due today" : days === 1 ? "Due tomorrow" : days <= 14 ? `In ${days} days` : format(parseISO(date), "d MMM yyyy");
	return (
		<span title={format(parseISO(date), "EEEE d MMMM yyyy")} className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium", tone, className)}>
			<CalendarClock className="h-3 w-3" />
			{text}
		</span>
	);
}

export function Avatars({ ids, admins, max = 3 }: { ids: string[]; admins: { id: string; name: string; avatar: string | null }[]; max?: number }) {
	const people = ids.map((id) => admins.find((a) => a.id === id)).filter(Boolean) as { id: string; name: string; avatar: string | null }[];
	if (!people.length) return <span className="text-xs text-serene-neutral-400">Unassigned</span>;
	return (
		<div className="flex -space-x-2">
			{people.slice(0, max).map((p) => (
				<span key={p.id} title={p.name} className="flex h-6 w-6 items-center justify-center overflow-hidden rounded-full bg-purple-100 text-[10px] font-bold text-purple-700 ring-2 ring-white">
					{p.avatar ? <img src={p.avatar} alt={p.name} className="h-full w-full object-cover" /> : p.name.charAt(0).toUpperCase()}
				</span>
			))}
			{people.length > max && <span className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-100 text-[10px] font-bold text-neutral-600 ring-2 ring-white">+{people.length - max}</span>}
		</div>
	);
}

export const fmtBytes = (n: number | null | undefined) => (n == null ? "" : n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);
