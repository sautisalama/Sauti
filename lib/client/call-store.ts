"use client";

import { useSyncExternalStore } from "react";

export interface ActiveCall { code: string; mode: "video" | "voice"; minimized: boolean; mic?: boolean; cam?: boolean }

const KEY = "ss_active_call";
let state: ActiveCall | null | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function read(): ActiveCall | null {
	if (state !== undefined) return state;
	try { state = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as ActiveCall | null; } catch { state = null; }
	return state;
}
function write(next: ActiveCall | null) {
	state = next;
	try { if (next) sessionStorage.setItem(KEY, JSON.stringify(next)); else sessionStorage.removeItem(KEY); } catch { /* private mode */ }
	emit();
}

/**
 * The call that is open in the floating window, shared by every page of the dashboard. It is kept for the tab
 * (sessionStorage) so moving between suites, or handing a full-page call over to the window, keeps it.
 */
export const callStore = {
	get: () => read(),
	open(code: string, mode: "video" | "voice" = "video", opts: { minimized?: boolean; mic?: boolean; cam?: boolean } = {}) {
		write({ code, mode, minimized: !!opts.minimized, mic: opts.mic, cam: opts.cam });
	},
	minimize(v: boolean) { const c = read(); if (c) write({ ...c, minimized: v }); },
	close() { write(null); },
	subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); },
};

export function useActiveCall(): ActiveCall | null {
	return useSyncExternalStore(callStore.subscribe, callStore.get, () => null);
}
