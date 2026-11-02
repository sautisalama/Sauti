"use client";

/**
 * "Create new" on a record opens an editor in another tab. The editor makes the file when it is first saved; this
 * remembers which record asked for it (for half an hour) so the new file can be linked to that record.
 */
export interface PendingAttach { kind: string; entityId: string; docId?: string; name: string }
const KEY = "ss_attach_pending";
const MAX_AGE = 30 * 60_000;

export function setPendingAttach(p: PendingAttach) {
	try { localStorage.setItem(KEY, JSON.stringify({ ...p, at: Date.now() })); } catch { /* storage unavailable: the file is simply not linked */ }
}

/** Takes the request (once), if it is recent. */
export function takePendingAttach(): PendingAttach | null {
	try {
		const raw = localStorage.getItem(KEY);
		if (!raw) return null;
		localStorage.removeItem(KEY);
		const p = JSON.parse(raw) as PendingAttach & { at: number };
		return Date.now() - p.at < MAX_AGE ? p : null;
	} catch { return null; }
}

export const hasPendingAttach = () => {
	try {
		const raw = localStorage.getItem(KEY);
		return !!raw && Date.now() - (JSON.parse(raw) as { at: number }).at < MAX_AGE;
	} catch { return false; }
};

/** Editors that make a new file of their own; an upload from anywhere else is never linked this way. */
export const EDITOR_PATHS = /^\/dashboard\/mjengo\/(documents\/editor|files\/(sheet|deck|slides|draw))(\/|$)/;
