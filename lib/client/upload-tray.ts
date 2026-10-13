"use client";

import { useSyncExternalStore } from "react";

export interface TrayItem { id: number; name: string; size: number; pct: number; state: "uploading" | "done" | "error"; error?: string }

let items: TrayItem[] = [];
const NONE: TrayItem[] = [];
let n = 0;
const listeners = new Set<() => void>();
const emit = () => { items = [...items]; listeners.forEach((l) => l()); };

/** One entry in the upload tray for a file that is being sent. The same tray shows every upload in the suite. */
export function trayStart(name: string, size: number) {
	const item: TrayItem = { id: ++n, name, size, pct: 0, state: "uploading" };
	items = [...items, item];
	emit();
	const patch = (p: Partial<TrayItem>) => { Object.assign(item, p); emit(); };
	return {
		progress: (pct: number) => { if (pct !== item.pct) patch({ pct }); },
		done: () => {
			patch({ pct: 100, state: "done" });
			setTimeout(() => { items = items.filter((x) => x.id !== item.id); emit(); }, 3500);
		},
		fail: (error: string) => patch({ state: "error", error }),
	};
}

export const trayDismiss = (id: number) => { items = items.filter((x) => x.id !== id); emit(); };

export function useTray(): TrayItem[] {
	return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => items, () => NONE);
}
