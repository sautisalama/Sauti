"use client";

import { useState } from "react";
import { Check, Settings2, UserMinus } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

/**
 * The "Manage" button beside everyone who has been given access (never the owner): change what they can do, or
 * take their access away. Works the same for files and for grants, opportunities, projects and fellowships.
 */
export function ManageAccess({ name, level, levels, disabled, onChange }: {
	name: string;
	level: string;
	levels: readonly (readonly [string, string])[];
	disabled?: boolean;
	/** A level, or null to remove their access. */
	onChange: (level: string | null) => void | Promise<unknown>;
}) {
	const [open, setOpen] = useState(false);
	const current = levels.find(([v]) => v === level)?.[1] ?? level;
	const pick = async (v: string | null) => { setOpen(false); await onChange(v); };
	return (
		<div className="flex shrink-0 items-center gap-2">
			<span className="hidden text-xs text-serene-neutral-500 sm:inline">{current}</span>
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<button type="button" disabled={disabled} aria-label={`Manage access for ${name}`} className="flex h-8 items-center gap-1.5 rounded-lg border border-serene-neutral-200 bg-white px-2.5 text-xs font-medium text-serene-neutral-700 hover:bg-serene-neutral-50 disabled:opacity-50">
						<Settings2 className="h-3.5 w-3.5" /> Manage
					</button>
				</PopoverTrigger>
				<PopoverContent align="end" className="w-60 p-1.5">
					<p className="truncate px-2 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-serene-neutral-500">{name}</p>
					{levels.map(([v, l]) => (
						<button key={v} type="button" onClick={() => void pick(v)} className={cn("flex w-full items-center justify-between rounded-lg px-2 py-2 text-left text-sm hover:bg-serene-neutral-50", v === level && "font-semibold")}>
							{l}{v === level && <Check className="h-4 w-4 text-sauti-teal" />}
						</button>
					))}
					<div className="my-1 border-t border-serene-neutral-100" />
					<button type="button" onClick={() => void pick(null)} className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm text-red-600 hover:bg-red-50">
						<UserMinus className="h-4 w-4" /> Remove access
					</button>
				</PopoverContent>
			</Popover>
		</div>
	);
}
