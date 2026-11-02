"use client";

import type { MjengoNav, SuiteCounts } from "@/app/actions/mjengo-nav";
import type { OpenRouterBalance } from "@/app/actions/mjengo-openrouter";

export interface SideParts { nav?: MjengoNav; counts?: SuiteCounts; unread?: number; balance?: OpenRouterBalance | null }
type Part = "nav" | "counts" | "unread" | "balance";

let queue: { parts: Part[]; resolve: (v: SideParts) => void; reject: (e: unknown) => void }[] = [];
let timer: ReturnType<typeof setTimeout> | null = null;

/**
 * The small numbers around every screen, by a plain request so they never queue ahead of a screen's own data.
 * Callers in the same moment (menu, badges, balance strip) share one request.
 */
export function side(parts: Part[]): Promise<SideParts> {
	return new Promise((resolve, reject) => {
		queue.push({ parts, resolve, reject });
		if (timer) return;
		timer = setTimeout(async () => {
			const batch = queue;
			queue = [];
			timer = null;
			const wanted = [...new Set(batch.flatMap((b) => b.parts))];
			try {
				const res = await fetch(`/api/suite/side?parts=${wanted.join(",")}`, { credentials: "same-origin" });
				if (!res.ok) throw new Error("side request failed");
				const all = (await res.json()) as SideParts;
				for (const b of batch) b.resolve(Object.fromEntries(b.parts.filter((p) => p in all).map((p) => [p, all[p]])) as SideParts);
			} catch (e) {
				for (const b of batch) b.reject(e);
			}
		}, 30);
	});
}
