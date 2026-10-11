"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { listAdmins, type AdminLite } from "@/app/actions/mjengo";

/** The admin team, fetched once per session and shared by every card that shows people. */
let teamPromise: Promise<AdminLite[]> | null = null;
const loadTeam = () => (teamPromise ??= listAdmins().catch(() => { teamPromise = null; return [] as AdminLite[]; }));

export function useTeam(): AdminLite[] {
	const [team, setTeam] = useState<AdminLite[]>([]);
	useEffect(() => {
		let on = true;
		loadTeam().then((t) => on && setTeam(t));
		return () => { on = false; };
	}, []);
	return team;
}

/** Overlapping profile photos, the same everywhere: work items, documents, files, to-dos and mail. */
export function AvatarStack({ ids, team, max = 4, size = "sm", className }: { ids: (string | null | undefined)[]; team: AdminLite[]; max?: number; size?: "sm" | "md"; className?: string }) {
	const people = [...new Set(ids.filter(Boolean) as string[])].map((id) => team.find((t) => t.id === id)).filter(Boolean) as AdminLite[];
	if (!people.length) return null;
	const box = size === "md" ? "h-7 w-7 text-[11px]" : "h-6 w-6 text-[10px]";
	return (
		<span className={cn("flex shrink-0 -space-x-2", className)} aria-label={people.map((p) => p.name).join(", ")}>
			{people.slice(0, max).map((p) => (
				<span key={p.id} title={p.name} className={cn("flex items-center justify-center overflow-hidden rounded-full bg-sauti-teal-light font-bold text-sauti-teal ring-2 ring-white", box)}>
					{p.avatar ? <img src={p.avatar} alt="" className="h-full w-full object-cover" /> : p.name.charAt(0).toUpperCase()}
				</span>
			))}
			{people.length > max && <span className={cn("flex items-center justify-center rounded-full bg-serene-neutral-100 font-bold text-serene-neutral-600 ring-2 ring-white", box)}>+{people.length - max}</span>}
		</span>
	);
}

/** Small Google Drive mark shown on anything that has been copied there. */
export function DriveBadge({ href, className }: { href?: string | null; className?: string }) {
	const icon = (
		<svg viewBox="0 0 87.3 78" className={cn("h-4 w-4", className)} aria-hidden>
			<path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da" />
			<path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44a9.06 9.06 0 0 0-1.2 4.5h27.5z" fill="#00ac47" />
			<path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335" />
			<path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d" />
			<path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc" />
			<path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00" />
		</svg>
	);
	if (!href) return <span title="Saved to Google Drive">{icon}</span>;
	// A span, not an anchor: the badge also sits inside cards that are links themselves.
	return (
		<span role="link" tabIndex={0} title="Open in Google Drive" className="inline-flex cursor-pointer"
			onClick={(e) => { e.preventDefault(); e.stopPropagation(); window.open(href, "_blank", "noopener"); }}
			onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); window.open(href, "_blank", "noopener"); } }}>{icon}</span>
	);
}
