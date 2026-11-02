/**
 * Turns the raw text of a failure into something a person can act on.
 * Used by the toast layer (so every existing catch block benefits) and by the error screens.
 */

export type FriendlyKind = "stale" | "offline" | "too-large" | "session" | "server" | "other";
export interface Friendly { kind: FriendlyKind; title: string; message: string }

const text = (e: unknown): string => {
	if (typeof e === "string") return e;
	if (e instanceof Error) return e.message;
	if (e && typeof e === "object" && "message" in e) return String((e as { message: unknown }).message);
	return "";
};

/** The page in this tab was built before the latest update, so the server no longer knows what it is asking for. */
export const isStaleVersion = (e: unknown): boolean => {
	const m = text(e);
	return /Failed to find Server Action|Server Action .* was not found|failed-to-find-server-action|ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to load chunk|error loading dynamically imported module|Importing a module script failed/i.test(m)
		|| (e instanceof Error && e.name === "ChunkLoadError");
};

export function friendly(e: unknown): Friendly | null {
	const m = text(e);
	if (!m) return null;
	if (isStaleVersion(e)) return { kind: "stale", title: "Sauti Salama was updated", message: "Reload this page to continue. Anything you typed may need to be entered again." };
	if (/Failed to fetch|NetworkError|Load failed|network request failed|ERR_INTERNET_DISCONNECTED|fetch failed/i.test(m)) return { kind: "offline", title: "Connection problem", message: "We could not reach the server. Check your connection and try again." };
	if (/Body exceeded|body size limit|PayloadTooLarge|413|Request Entity Too Large/i.test(m)) return { kind: "too-large", title: "File too large", message: "That file is bigger than we can accept here. Try a smaller file." };
	if (/Unexpected token '?<|is not valid JSON|Unexpected end of JSON|An unexpected response was received from the server/i.test(m)) return { kind: "server", title: "Something went wrong on our side", message: "The server sent an unexpected reply. Please try again in a moment." };
	if (/JWT expired|refresh_token|Invalid Refresh Token|not authenticated|Auth session missing/i.test(m)) return { kind: "session", title: "Please sign in again", message: "Your session has ended. Sign in again to continue." };
	if (/An error occurred in the Server Components render|digest/i.test(m) && /omitted in production|digest/i.test(m)) return { kind: "server", title: "Something went wrong on our side", message: "Please try again. If it keeps happening, tell us what you were doing." };
	return null;
}

/** For `description` text: a readable version of a failure, or the original when it is already readable. */
export function friendlyText(raw: string): string {
	return friendly(raw)?.message ?? raw;
}

const KEY = "ss_stale_reload";

/** Reloads once per minute at most, so a genuine fault can never become a reload loop. */
export function reloadOnce(): boolean {
	try {
		const last = Number(sessionStorage.getItem(KEY) || 0);
		if (Date.now() - last < 60_000) return false;
		sessionStorage.setItem(KEY, String(Date.now()));
	} catch { /* storage blocked: still reload, the caller decides */ }
	window.location.reload();
	return true;
}

export const STALE_EVENT = "ss:stale-version";
export const announceStale = () => { try { window.dispatchEvent(new Event(STALE_EVENT)); } catch { /* ignore */ } };
