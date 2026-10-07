import sanitizeHtml from "sanitize-html";

/**
 * Allow-list sanitiser for all admin- and import-authored HTML.
 *
 * Content is rendered with dangerouslySetInnerHTML on public pages, so every
 * write path (editor save, Word/PDF import) must pass through here. We keep the
 * formatting Tiptap can produce and nothing else: no scripts, no inline event
 * handlers, no javascript: URLs, and iframes only for YouTube embeds.
 */
const YOUTUBE_EMBED = /^https:\/\/(www\.)?(youtube\.com|youtube-nocookie\.com)\/embed\//i;

export function sanitizeContent(html: string): string {
	return sanitizeHtml(html ?? "", {
		allowedTags: [
			"h1", "h2", "h3", "h4", "p", "br", "hr", "blockquote", "pre", "code",
			"strong", "b", "em", "i", "u", "s", "mark", "sub", "sup", "span",
			"ul", "ol", "li", "a", "img", "figure", "figcaption",
			"table", "thead", "tbody", "tfoot", "tr", "th", "td", "colgroup", "col",
			"div", "label", "input", "iframe",
		],
		allowedAttributes: {
			a: ["href", "target", "rel", "title"],
			img: ["src", "alt", "title", "width", "height"],
			th: ["colspan", "rowspan", "colwidth"],
			td: ["colspan", "rowspan", "colwidth"],
			ul: ["data-type"],
			li: ["data-type", "data-checked"],
			div: ["data-youtube-video", "data-type"],
			input: ["type", "checked", "disabled"],
			label: [],
			iframe: ["src", "width", "height", "allowfullscreen", "frameborder", "title"],
			mark: ["data-color", "style"],
			span: ["style"],
			p: ["style"],
			h1: ["style"], h2: ["style"], h3: ["style"], h4: ["style"],
			code: ["class"],
			pre: ["class"],
		},
		allowedStyles: {
			"*": {
				"text-align": [/^(left|right|center|justify)$/],
				color: [/^#[0-9a-f]{3,8}$/i, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i],
				"background-color": [/^#[0-9a-f]{3,8}$/i, /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/i],
			},
		},
		allowedSchemes: ["http", "https", "mailto", "tel"],
		allowedSchemesByTag: { img: ["http", "https", "data"] },
		allowProtocolRelative: false,
		allowedIframeHostnames: ["www.youtube.com", "youtube.com", "www.youtube-nocookie.com"],
		transformTags: {
			a: (tagName, attribs) => {
				const external = /^https?:\/\//i.test(attribs.href ?? "");
				return {
					tagName,
					attribs: {
						...attribs,
						...(external ? { target: "_blank", rel: "noopener noreferrer nofollow" } : {}),
					},
				};
			},
		},
		exclusiveFilter: (frame) => {
			if (frame.tag === "iframe") return !YOUTUBE_EMBED.test(frame.attribs.src ?? "");
			if (frame.tag === "input") return frame.attribs.type !== "checkbox";
			return false;
		},
	});
}

/** Plain text of an HTML string, for summaries, reading time and search. */
export function htmlToText(html: string): string {
	return sanitizeHtml(html ?? "", { allowedTags: [], allowedAttributes: {} })
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\s+/g, " ")
		.trim();
}

export function readingStats(html: string): { words: number; minutes: number } {
	const text = htmlToText(html);
	const words = text ? text.split(/\s+/).length : 0;
	return { words, minutes: Math.max(1, Math.round(words / 220)) };
}

export function makeSummary(html: string, max = 200): string {
	const text = htmlToText(html);
	if (text.length <= max) return text;
	const cut = text.slice(0, max);
	return cut.slice(0, Math.max(cut.lastIndexOf(" "), 40)).trimEnd() + "…";
}

export function slugify(input: string): string {
	return (
		input
			.normalize("NFKD")
			.replace(/[̀-ͯ]/g, "")
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(/^-+|-+$/g, "")
			.slice(0, 80) || "untitled"
	);
}

/** Validate and normalise user-supplied "other sources" links. */
export function normalizeLinks(
	links: Array<{ label?: string; url?: string }> | null | undefined
): { links: { label: string; url: string }[]; error?: string } {
	const out: { label: string; url: string }[] = [];
	for (const l of links ?? []) {
		const raw = (l.url ?? "").trim();
		if (!raw && !(l.label ?? "").trim()) continue;
		let u: URL;
		try {
			u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`);
		} catch {
			return { links: out, error: `"${raw}" is not a valid link.` };
		}
		if (u.protocol !== "http:" && u.protocol !== "https:") {
			return { links: out, error: "Source links must start with http:// or https://" };
		}
		out.push({ label: (l.label ?? "").trim() || u.hostname.replace(/^www\./, ""), url: u.toString() });
	}
	return { links: out };
}
