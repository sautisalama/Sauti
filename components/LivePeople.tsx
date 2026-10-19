"use client";

import { cn } from "@/lib/utils";

export interface Here { key: string; name: string; avatar?: string | null; color: string; at?: string | null }

/** The people editing the same file right now, as photos with their names, and where each one is when that is known. */
export function LivePeople({ people, className }: { people: Here[]; className?: string }) {
	if (!people.length) return null;
	return (
		<div className={cn("flex items-center", className)} aria-label={`${people.length} other ${people.length === 1 ? "person" : "people"} here`}>
			<span className="mr-2 hidden items-center gap-1 text-xs font-medium text-emerald-700 sm:flex"><span className="h-2 w-2 animate-pulse rounded-full bg-emerald-500" /> Live</span>
			<div className="flex -space-x-2">
				{people.slice(0, 5).map((p) => (
					<span key={p.key} title={p.at ? `${p.name} is on ${p.at}` : p.name} className="flex h-7 w-7 items-center justify-center overflow-hidden rounded-full text-[11px] font-bold text-white ring-2 ring-white" style={{ background: p.color }}>
						{p.avatar ? /* eslint-disable-next-line @next/next/no-img-element */ <img src={p.avatar} alt={p.name} className="h-full w-full object-cover" /> : p.name.charAt(0).toUpperCase()}
					</span>
				))}
				{people.length > 5 && <span className="flex h-7 w-7 items-center justify-center rounded-full bg-serene-neutral-200 text-[11px] font-semibold text-serene-neutral-700 ring-2 ring-white">+{people.length - 5}</span>}
			</div>
			{people.length === 1 && people[0].at && <span className="ml-2 hidden text-xs text-serene-neutral-500 md:inline">{people[0].name.split(" ")[0]} is on {people[0].at}</span>}
		</div>
	);
}
