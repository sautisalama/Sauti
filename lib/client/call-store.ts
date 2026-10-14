"use client";

import { useSyncExternalStore } from "react";

export interface ActiveCall {
	code: string;
	mode: "video" | "voice";
	minimized: boolean;
	/** True once the person has joined; keeps the dock alive across suite pages. */
	live: boolean;
	/** The call is showing in its own floating window, so the corner only holds a small bar. */
	pip?: boolean;
	mic?: boolean;
	cam?: boolean;
	title: string | null;
	description?: string;
	resources?: { label: string; url: string }[];
	defaultName: string;
	canSave: boolean;
	userId?: string | null;
	endsAt?: string | null;
}

const KEY = "ss_active_call";
const RETURN_KEY = "ss_call_return";
let state: ActiveCall | null | undefined;
let leaveGen = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function read(): ActiveCall | null {
	if (state !== undefined) return state;
	try {
		state = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as ActiveCall | null;
	} catch {
		state = null;
	}
	return state;
}
function write(next: ActiveCall | null) {
	state = next;
	try {
		if (next) sessionStorage.setItem(KEY, JSON.stringify(next));
		else sessionStorage.removeItem(KEY);
	} catch {
		/* private mode */
	}
	emit();
}

export type OpenCallOpts = {
	minimized?: boolean;
	live?: boolean;
	mic?: boolean;
	cam?: boolean;
	title?: string | null;
	description?: string;
	resources?: { label: string; url: string }[];
	defaultName?: string;
	canSave?: boolean;
	userId?: string | null;
	endsAt?: string | null;
};

/**
 * The call hosted in the dashboard shell so people can minimise Meet and keep working in any suite.
 * Kept for the tab (sessionStorage) so a refresh can rejoin; the live WebRTC session itself lives in CallDock.
 */
export const callStore = {
	get: () => read(),
	open(code: string, mode: "video" | "voice" = "video", opts: OpenCallOpts = {}) {
		const cur = read();
		const same = cur?.code === code;
		write({
			code,
			mode,
			minimized: opts.minimized ?? (same ? cur!.minimized : false),
			live: opts.live ?? (same ? cur!.live : false),
			mic: opts.mic ?? cur?.mic,
			cam: opts.cam ?? cur?.cam,
			title: opts.title !== undefined ? opts.title : (same ? cur!.title : null),
			description: opts.description ?? (same ? cur?.description : "") ?? "",
			resources: opts.resources ?? (same ? cur?.resources : []) ?? [],
			defaultName: opts.defaultName ?? (same ? cur?.defaultName : "") ?? "",
			canSave: opts.canSave ?? (same ? cur?.canSave : false) ?? false,
			userId: opts.userId !== undefined ? opts.userId : same ? cur?.userId : null,
			endsAt: opts.endsAt !== undefined ? opts.endsAt : same ? cur?.endsAt : null,
		});
	},
	minimize(v: boolean) {
		const c = read();
		if (c) write({ ...c, minimized: v });
	},
	setLive(v: boolean) {
		const c = read();
		if (c && c.live !== v) write({ ...c, live: v });
	},
	setPip(v: boolean) {
		const c = read();
		if (c && !!c.pip !== v) write({ ...c, pip: v });
	},
	setMedia(mic: boolean, cam: boolean) {
		const c = read();
		if (c) write({ ...c, mic, cam });
	},
	/** Ask the hosted MeetRoom to leave cleanly (peers + media), then close. */
	requestLeave() {
		leaveGen += 1;
		emit();
	},
	leaveGeneration: () => leaveGen,
	close() {
		write(null);
	},
	rememberReturn(path: string) {
		try {
			if (path && !path.startsWith("/meet")) sessionStorage.setItem(RETURN_KEY, path);
		} catch {
			/* private mode */
		}
	},
	consumeReturn(fallback = "/dashboard/mjengo") {
		try {
			const v = sessionStorage.getItem(RETURN_KEY);
			if (v) return v;
		} catch {
			/* private mode */
		}
		return fallback;
	},
	subscribe(l: () => void) {
		listeners.add(l);
		return () => listeners.delete(l);
	},
};

export function useActiveCall(): ActiveCall | null {
	return useSyncExternalStore(callStore.subscribe, callStore.get, () => null);
}
