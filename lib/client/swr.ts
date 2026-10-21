"use client";

/**
 * Stale-while-revalidate for data a screen loads from the server.
 *
 * A screen asks for a key: whatever was fetched before (this session, or the last visit on this device) is handed over
 * at once, and a fresh copy is fetched behind it unless the held one is still young. The start-up warmer asks for the
 * same keys ahead of time, so by the time a screen opens its data is already here. Requests for one key are shared,
 * and a saved copy is kept per person so a cold start paints from it instead of from an empty screen.
 */

interface Entry { v: unknown; at: number }

const mem = new Map<string, Entry>();
const inflight = new Map<string, Promise<unknown>>();
const PREFIX = "ss_swr:";
const MAX_SAVED = 400_000; // characters; bigger values stay in memory only
let owner: string | null = null;

/** The signed-in person: saved copies belong to them, and another person's copies are never read. */
export function setSwrOwner(id: string | null) {
	if (id === owner) return;
	// Another person on this device: nothing of the last one stays.
	if (owner && id !== owner) { mem.clear(); inflight.clear(); }
	owner = id;
	try {
		for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX) && (!id || !k.startsWith(PREFIX + id + ":"))) localStorage.removeItem(k);
	} catch { /* no storage */ }
}

/** Sign-out: forget everything held in memory and saved on this device. */
export function clearSwr() {
	mem.clear();
	inflight.clear();
	owner = null;
	try {
		for (const k of Object.keys(localStorage)) if (k.startsWith(PREFIX) || k.startsWith("ss_mail_cache:")) localStorage.removeItem(k);
	} catch { /* no storage */ }
}

const skey = (key: string) => `${PREFIX}${owner}:${key}`;

function saved(key: string): Entry | undefined {
	if (!owner) return undefined;
	try {
		const raw = localStorage.getItem(skey(key));
		return raw ? (JSON.parse(raw) as Entry) : undefined;
	} catch { return undefined; }
}

function save(key: string, e: Entry) {
	if (!owner) return;
	try {
		const raw = JSON.stringify(e);
		if (raw.length <= MAX_SAVED) localStorage.setItem(skey(key), raw);
	} catch { /* storage full: memory still has it */ }
}

/** What is held for this key, from memory or from the saved copy, however old. */
export function peek<T>(key: string): { value: T; at: number } | undefined {
	const m = mem.get(key) ?? saved(key);
	if (!m) return undefined;
	if (!mem.has(key)) mem.set(key, m);
	return { value: m.v as T, at: m.at };
}

/** Put a value in (after a change the screen made itself, or from the warmer). */
export function put<T>(key: string, value: T) {
	const e = { v: value, at: Date.now() };
	mem.set(key, e);
	save(key, e);
}

/** Fetch now (shared with any request already on its way). */
export function revalidate<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
	const going = inflight.get(key);
	if (going) return going as Promise<T>;
	const p = fetcher().then((v) => { put(key, v); return v; }).finally(() => { if (inflight.get(key) === p) inflight.delete(key); });
	inflight.set(key, p);
	return p;
}

/** Fetch only when what is held is older than `maxAge` ms (or nothing is held). Used by the warmer. */
export function prime<T>(key: string, fetcher: () => Promise<T>, maxAge = 60_000): Promise<T | undefined> {
	const have = peek<T>(key);
	if (have && Date.now() - have.at < maxAge) return Promise.resolve(have.value);
	return revalidate(key, fetcher).catch(() => have?.value);
}

/**
 * For a screen: calls `onData` straight away with what is held, then again with the fresh copy. The returned function
 * stops further calls (when the screen goes away). Errors reach `onError` only if nothing was held to show.
 */
export function swr<T>(key: string, fetcher: () => Promise<T>, onData: (v: T) => void, opts: { maxAge?: number; onError?: (e: unknown) => void } = {}): () => void {
	let live = true;
	const have = peek<T>(key);
	if (have) onData(have.value);
	if (!have || Date.now() - have.at >= (opts.maxAge ?? 30_000)) {
		revalidate(key, fetcher).then((v) => { if (live) onData(v); }).catch((e) => { if (live && !have) opts.onError?.(e); });
	}
	return () => { live = false; };
}

/** Drop held copies after a change (every key that starts with the prefix). */
export function invalidate(prefix: string) {
	for (const k of [...mem.keys()]) if (k.startsWith(prefix)) mem.delete(k);
	try {
		for (const k of Object.keys(localStorage)) if (k.startsWith(`${PREFIX}${owner}:${prefix}`)) localStorage.removeItem(k);
	} catch { /* no storage */ }
}
