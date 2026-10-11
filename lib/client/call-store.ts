"use client";

import { useSyncExternalStore } from "react";

export interface ActiveCall { code: string; mode: "video" | "voice"; minimized: boolean }

let state: ActiveCall | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

/** The call that is open in the floating window, shared by every page of the dashboard. */
export const callStore = {
	get: () => state,
	open(code: string, mode: "video" | "voice" = "video") { state = { code, mode, minimized: false }; emit(); },
	minimize(v: boolean) { if (state) { state = { ...state, minimized: v }; emit(); } },
	close() { state = null; emit(); },
	subscribe(l: () => void) { listeners.add(l); return () => listeners.delete(l); },
};

export function useActiveCall(): ActiveCall | null {
	return useSyncExternalStore(callStore.subscribe, callStore.get, () => null);
}
