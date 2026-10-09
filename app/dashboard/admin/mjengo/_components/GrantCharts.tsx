"use client";

import { useMemo, useState } from "react";
import { addMonths, format, parseISO, startOfMonth } from "date-fns";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DeadlineChip, GRANT_STATUSES, money } from "./shared";

export interface GrantLite {
	id: string;
	title: string;
	funder?: string | null;
	status: string;
	amount: number | null;
	currency: string;
	deadline: string | null;
}

const compact = (n: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(n);

/** Where the money is in the pipeline, when applications are due, and what is coming up next. */
export function GrantCharts({ grants }: { grants: GrantLite[] }) {
	const currencies = useMemo(() => {
		const count = new Map<string, number>();
		grants.forEach((g) => count.set(g.currency, (count.get(g.currency) ?? 0) + 1));
		return Array.from(count.entries()).sort((a, b) => b[1] - a[1]).map(([c]) => c);
	}, [grants]);
	const [currency, setCurrency] = useState<string>(currencies[0] ?? "USD");
	const cur = currencies.includes(currency) ? currency : currencies[0] ?? "USD";

	// Amount per stage (one currency at a time: adding dollars to shillings would be meaningless).
	const byStage = useMemo(
		() =>
			GRANT_STATUSES.map((s) => ({
				name: s.label,
				color: s.color,
				amount: grants.filter((g) => g.status === s.value && g.currency === cur).reduce((n, g) => n + Number(g.amount ?? 0), 0),
				count: grants.filter((g) => g.status === s.value).length,
			})).filter((s) => s.count > 0),
		[grants, cur]
	);

	// Applications due in each of the next six months.
	const byMonth = useMemo(() => {
		const start = startOfMonth(new Date());
		return Array.from({ length: 6 }, (_, i) => {
			const m = addMonths(start, i);
			const key = format(m, "yyyy-MM");
			return {
				name: format(m, "MMM"),
				count: grants.filter((g) => g.deadline?.startsWith(key) && !["awarded", "declined", "closed"].includes(g.status)).length,
			};
		});
	}, [grants]);

	const upcoming = useMemo(
		() => grants.filter((g) => g.deadline && !["awarded", "declined", "closed"].includes(g.status)).sort((a, b) => a.deadline!.localeCompare(b.deadline!)).slice(0, 6),
		[grants]
	);

	if (!grants.length) return null;

	return (
		<div className="grid gap-4 lg:grid-cols-3">
			<div className="rounded-2xl border border-serene-neutral-100 bg-white p-4 lg:col-span-1">
				<div className="mb-2 flex items-center justify-between gap-2">
					<h3 className="text-sm font-bold text-serene-neutral-900">Funding by stage</h3>
					{currencies.length > 1 && (
						<Select value={cur} onValueChange={setCurrency}>
							<SelectTrigger className="h-8 w-[84px] text-xs"><SelectValue /></SelectTrigger>
							<SelectContent>{currencies.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
						</Select>
					)}
				</div>
				<div className="h-52" role="img" aria-label={`Grant funding by stage in ${cur}`}>
					<ResponsiveContainer width="100%" height="100%">
						<BarChart data={byStage} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
							<CartesianGrid horizontal={false} strokeDasharray="3 3" stroke="#e5e7eb" />
							<XAxis type="number" tickFormatter={compact} tick={{ fontSize: 11 }} />
							<YAxis type="category" dataKey="name" width={84} tick={{ fontSize: 11 }} />
							<Tooltip formatter={(v: number) => money(v, cur)} cursor={{ fill: "rgba(168,85,247,0.06)" }} />
							<Bar dataKey="amount" radius={[0, 6, 6, 0]}>
								{byStage.map((s) => <Cell key={s.name} fill={s.color} />)}
							</Bar>
						</BarChart>
					</ResponsiveContainer>
				</div>
			</div>

			<div className="rounded-2xl border border-serene-neutral-100 bg-white p-4">
				<h3 className="mb-2 text-sm font-bold text-serene-neutral-900">Deadlines, next 6 months</h3>
				<div className="h-52" role="img" aria-label="Number of grant deadlines in each of the next six months">
					<ResponsiveContainer width="100%" height="100%">
						<BarChart data={byMonth} margin={{ left: -16, right: 8, top: 4, bottom: 4 }}>
							<CartesianGrid vertical={false} strokeDasharray="3 3" stroke="#e5e7eb" />
							<XAxis dataKey="name" tick={{ fontSize: 11 }} />
							<YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
							<Tooltip formatter={(v: number) => [`${v} due`, "Grants"]} cursor={{ fill: "rgba(168,85,247,0.06)" }} />
							<Bar dataKey="count" fill="#a855f7" radius={[6, 6, 0, 0]} />
						</BarChart>
					</ResponsiveContainer>
				</div>
			</div>

			<div className="rounded-2xl border border-serene-neutral-100 bg-white p-4">
				<h3 className="mb-2 text-sm font-bold text-serene-neutral-900">Next due</h3>
				{upcoming.length === 0 ? (
					<p className="text-sm text-serene-neutral-500">No open deadlines.</p>
				) : (
					<ul className="space-y-2.5">
						{upcoming.map((g) => (
							<li key={g.id} className="flex items-center justify-between gap-3">
								<div className="min-w-0">
									<p className="truncate text-sm font-medium text-serene-neutral-900">{g.title}</p>
									<p className="truncate text-xs text-serene-neutral-500">
										{g.funder ? `${g.funder} · ` : ""}
										{g.deadline ? format(parseISO(g.deadline), "d MMM yyyy") : ""}
									</p>
								</div>
								<DeadlineChip date={g.deadline} />
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
