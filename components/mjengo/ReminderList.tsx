"use client";

import { Bell, Plus, X } from "lucide-react";
import { cn } from "@/lib/utils";

type Unit = "minutes" | "hours" | "days" | "weeks";
const MULT: Record<Unit, number> = { minutes: 1, hours: 60, days: 1440, weeks: 10080 };

/** An offset in minutes as the largest whole unit: 1440 is "1 day", 90 is "90 minutes". */
function split(min: number, units: Unit[]): { n: number; unit: Unit } {
	for (const u of [...units].sort((a, b) => MULT[b] - MULT[a])) {
		if (min >= MULT[u] && min % MULT[u] === 0) return { n: min / MULT[u], unit: u };
	}
	const smallest = [...units].sort((a, b) => MULT[a] - MULT[b])[0];
	return { n: Math.round(min / MULT[smallest]), unit: smallest };
}

export const describeReminder = (min: number, units: Unit[] = ["minutes", "hours", "days", "weeks"], atTime = "at the time") => {
	if (min === 0) return atTime;
	const { n, unit } = split(min, units);
	return `${n} ${n === 1 ? unit.slice(0, -1) : unit} before`;
};

/**
 * Several reminders for one thing, like Google Calendar: each is "N minutes / hours / days / weeks before".
 * `value` is a list of offsets in minutes before the time. Used for events, to-dos, grants, projects and
 * fellowships, so every section reminds the same way.
 */
export function ReminderList({ value, onChange, units = ["minutes", "hours", "days", "weeks"], max = 5, className, emptyHint = "No reminders", defaultNew }: { value: number[]; onChange: (v: number[]) => void; units?: Unit[]; max?: number; className?: string; emptyHint?: string; defaultNew?: number }) {
	const add = () => {
		const preset = defaultNew ?? (units.includes("minutes") ? 10 : 1440);
		const next = [10, 30, 60, 1440, 2880, 10080, 0].find((p) => !value.includes(p) && (units.includes("minutes") || p >= 1440 || p === 0)) ?? preset;
		onChange([...value, next]);
	};
	const set = (i: number, min: number) => onChange(value.map((v, j) => (j === i ? Math.max(0, Math.min(525600, Math.round(min))) : v)));
	return (
		<div className={cn("space-y-1.5", className)}>
			{value.length === 0 && <p className="flex items-center gap-2 text-sm text-serene-neutral-500"><Bell className="h-4 w-4" /> {emptyHint}</p>}
			{value.map((m, i) => {
				const { n, unit } = split(m, units);
				return (
					<div key={i} className="flex items-center gap-2">
						<Bell className="h-4 w-4 shrink-0 text-serene-neutral-400" />
						<input
							type="number"
							min={0}
							value={n}
							onChange={(e) => set(i, Number(e.target.value) * MULT[unit])}
							aria-label="Reminder amount"
							className="h-9 w-16 rounded-md border border-serene-neutral-200 bg-white px-2 text-sm"
						/>
						<select value={unit} onChange={(e) => set(i, n * MULT[e.target.value as Unit])} aria-label="Reminder unit" className="h-9 rounded-md border border-serene-neutral-200 bg-white px-2 text-sm">
							{units.map((u) => <option key={u} value={u}>{u}</option>)}
						</select>
						<span className="text-sm text-serene-neutral-500">before</span>
						<button type="button" onClick={() => onChange(value.filter((_, j) => j !== i))} aria-label="Remove reminder" className="ml-auto flex h-8 w-8 items-center justify-center rounded-full text-serene-neutral-400 hover:bg-serene-neutral-100 hover:text-serene-neutral-700"><X className="h-4 w-4" /></button>
					</div>
				);
			})}
			{value.length < max && (
				<button type="button" onClick={add} className="flex items-center gap-1.5 rounded-md px-1 py-1 text-sm font-medium text-sauti-teal hover:underline"><Plus className="h-4 w-4" /> Add a reminder</button>
			)}
		</div>
	);
}
