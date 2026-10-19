"use client";

import { useEffect, useState } from "react";
import { Eye, Loader2, ShieldQuestion } from "lucide-react";
import { cn } from "@/lib/utils";
import { unwrap } from "@/lib/action-result";
import { whoCanSeeFile } from "@/app/actions/mjengo-reports";
import type { AccessExplanation } from "@/lib/mjengo/access-explain";

const LEVEL = { view: "can view", share: "can view and share", edit: "can edit" } as const;

/** Who can open this file and why, one reason per person, so nobody is left wondering how something got shared. */
export function AccessExplainer({ fileId }: { fileId: string }) {
	const [open, setOpen] = useState(false);
	const [data, setData] = useState<AccessExplanation | null>(null);
	const [error, setError] = useState("");
	useEffect(() => { setData(null); setError(""); setOpen(false); }, [fileId]);
	const toggle = () => {
		const next = !open;
		setOpen(next);
		if (next && !data) unwrap(whoCanSeeFile(fileId)).then(setData).catch((e) => setError(e instanceof Error ? e.message : "Could not work that out."));
	};
	return (
		<div className="rounded-xl border border-serene-neutral-100 p-3">
			<button type="button" onClick={toggle} aria-expanded={open} className="flex w-full items-center gap-1.5 text-left text-sm font-semibold text-serene-neutral-900"><ShieldQuestion className="h-4 w-4 text-sauti-teal" /> Who can see this, and why<span className="ml-auto text-xs font-medium text-sauti-teal">{open ? "Hide" : "Show"}</span></button>
			{open && (
				<div className="mt-2 space-y-2 text-sm">
					{error && <p className="text-xs text-red-700">{error}</p>}
					{!data && !error && <Loader2 className="h-4 w-4 animate-spin text-serene-neutral-400" />}
					{data && (
						<>
							{data.general && <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900"><Eye className="h-3.5 w-3.5" />{data.general}</p>}
							{data.link && <p className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-xs text-amber-900"><Eye className="h-3.5 w-3.5" />{data.link}</p>}
							{!data.fullList && <p className="text-xs text-serene-neutral-500">You can see why you have access. Only people who can share this file see everyone.</p>}
							<ul className="space-y-2">
								{data.people.map((p) => (
									<li key={p.id} className="rounded-lg bg-serene-neutral-50 px-2.5 py-2">
										<p className="text-xs font-semibold text-serene-neutral-900">{p.you ? "You" : p.name} <span className={cn("font-normal", p.level === "edit" ? "text-sauti-teal" : "text-serene-neutral-500")}>{LEVEL[p.level]}</span></p>
										<ul className="mt-0.5 list-inside list-disc text-xs text-serene-neutral-600">{p.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
									</li>
								))}
							</ul>
						</>
					)}
				</div>
			)}
		</div>
	);
}
