/** Convert a YouTube/Vimeo page URL into a privacy-friendly embed URL, or null. */
export function toEmbedUrl(raw: string | null | undefined): string | null {
	if (!raw) return null;
	try {
		const u = new URL(raw);
		const host = u.hostname.replace(/^www\./, "");
		if (host === "youtu.be") {
			const id = u.pathname.slice(1).split("/")[0];
			return /^[\w-]{6,}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
		}
		if (host === "youtube.com" || host === "m.youtube.com") {
			const id = u.searchParams.get("v") ?? u.pathname.match(/^\/(?:embed|shorts)\/([\w-]{6,})/)?.[1];
			return id && /^[\w-]{6,}$/.test(id) ? `https://www.youtube-nocookie.com/embed/${id}` : null;
		}
		if (host === "vimeo.com") {
			const id = u.pathname.match(/^\/(\d+)/)?.[1];
			return id ? `https://player.vimeo.com/video/${id}` : null;
		}
	} catch {
		/* fall through */
	}
	return null;
}

export const pct = (done: number, total: number) => (total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0);
