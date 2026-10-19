"use client";

import { Check, Loader2, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { LEVEL_ORDER, RANK, type Lvl } from "@/lib/access/reconcile";

const LABEL: Record<Lvl, string> = { view: "View", write: "Write", owner: "Owner" };
const WHAT: Record<Lvl, string> = { view: "read it", write: "create and change things", owner: "delete and manage other people's items" };
const TONE: Record<Lvl, string> = { view: "border-sky-200 bg-sky-50 text-sky-800", write: "border-emerald-200 bg-emerald-50 text-emerald-800", owner: "border-violet-200 bg-violet-50 text-violet-800" };

/**
 * Every part of the suite with what is allowed there and, beside it, what is not. Click something that is not allowed to
 * allow it (this includes the levels below it, since writing needs reading); click the highest allowed level to take it
 * away. Used for a person and for a role.
 */
export function AreaMatrix({ modules, levelOf, onSet, busyKey, readOnly = false }: {
	modules: { key: string; label: string; hint: string }[];
	levelOf: (key: string) => Lvl | null;
	onSet: (key: string, level: Lvl | null) => void;
	busyKey?: string | null;
	readOnly?: boolean;
}) {
	return (
		<ul className="divide-y divide-serene-neutral-100 overflow-hidden rounded-xl border border-serene-neutral-100">
			{modules.map((m) => {
				const cur = levelOf(m.key);
				const have = cur ? RANK[cur] : 0;
				const busy = busyKey === m.key;
				return (
					<li key={m.key} className="space-y-2 px-3 py-2.5">
						<div className="flex items-center gap-2">
							<span className="min-w-0 flex-1"><span className="block text-sm font-medium text-serene-neutral-900">{m.label}</span><span className="block truncate text-xs text-serene-neutral-500">{m.hint}</span></span>
							{busy && <Loader2 className="h-3.5 w-3.5 animate-spin text-serene-neutral-400" />}
						</div>
						<div className="grid gap-1.5 sm:grid-cols-2">
							<div>
								<p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-emerald-700">Can do</p>
								<div className="flex flex-wrap gap-1">
									{have === 0 && <span className="text-xs text-serene-neutral-400">Nothing here</span>}
									{LEVEL_ORDER.filter((l) => RANK[l] <= have).map((l) => {
										const top = RANK[l] === have;
										return (
											<button key={l} type="button" disabled={readOnly || busy || !top} title={top && !readOnly ? `Take away ${LABEL[l]}` : `${LABEL[l]}: ${WHAT[l]}`}
												onClick={() => onSet(m.key, RANK[l] === 1 ? null : LEVEL_ORDER[RANK[l] - 2])}
												className={cn("inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium", TONE[l], top && !readOnly && "hover:opacity-70")}>
												<Check className="h-3 w-3" /> {LABEL[l]}
											</button>
										);
									})}
								</div>
							</div>
							<div>
								<p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-serene-neutral-400">Cannot do</p>
								<div className="flex flex-wrap gap-1">
									{have === 3 && <span className="text-xs text-serene-neutral-400">Nothing is held back</span>}
									{LEVEL_ORDER.filter((l) => RANK[l] > have).map((l) => (
										<button key={l} type="button" disabled={readOnly || busy} title={`Allow ${LABEL[l]}: ${WHAT[l]}`} onClick={() => onSet(m.key, l)}
											className={cn("inline-flex items-center gap-1 rounded-full border border-dashed border-serene-neutral-300 px-2.5 py-0.5 text-xs font-medium text-serene-neutral-500", !readOnly && "hover:border-sauti-teal hover:bg-sauti-teal-light/40 hover:text-sauti-dark")}>
											{!readOnly && <Plus className="h-3 w-3" />} {LABEL[l]}
										</button>
									))}
								</div>
							</div>
						</div>
					</li>
				);
			})}
		</ul>
	);
}
