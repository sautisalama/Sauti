/**
 * Small browser-side cache so mail already seen stays readable without a connection. Lists and the most
 * recently opened messages are kept per mailbox; everything is best effort and size-capped.
 */
const PREFIX = "ss_mail_cache:";
const MAX_DETAILS = 25;

function read<T>(key: string): T | null {
	try {
		const raw = localStorage.getItem(PREFIX + key);
		return raw ? (JSON.parse(raw) as T) : null;
	} catch {
		return null;
	}
}

function write(key: string, value: unknown) {
	try {
		localStorage.setItem(PREFIX + key, JSON.stringify(value));
	} catch {
		// Storage full: drop the oldest saved messages and try once more.
		try {
			const idx = read<string[]>("details-index") ?? [];
			for (const k of idx.splice(0, Math.ceil(idx.length / 2))) localStorage.removeItem(PREFIX + k);
			write("details-index", idx);
			localStorage.setItem(PREFIX + key, JSON.stringify(value));
		} catch {
			/* give up quietly */
		}
	}
}

export const cacheList = <T,>(key: string, value: T) => write(`list:${key}`, value);
export const readList = <T,>(key: string) => read<T>(`list:${key}`);

export function cacheDetail<T>(key: string, value: T) {
	write(`detail:${key}`, value);
	const idx = (read<string[]>("details-index") ?? []).filter((k) => k !== `detail:${key}`);
	idx.push(`detail:${key}`);
	while (idx.length > MAX_DETAILS) {
		const old = idx.shift();
		if (old) {
			try {
				localStorage.removeItem(PREFIX + old);
			} catch {}
		}
	}
	write("details-index", idx);
}

export const readDetail = <T,>(key: string) => read<T>(`detail:${key}`);

/** Forget everything (used when a mailbox is disconnected or someone signs out). */
export function clearMailCache() {
	try {
		Object.keys(localStorage).filter((k) => k.startsWith(PREFIX)).forEach((k) => localStorage.removeItem(k));
	} catch {}
}
