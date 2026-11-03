import type { Metadata } from "next";

/** The X/Twitter account that link cards are attributed to. */
export const SITE_TWITTER = "@SautiSalama";
const TAIL = " Sauti Salama is a survivor-led gender-based violence organisation in Kenya.";

/** Descriptions work best at 110 to 160 characters: pad short ones with who we are, trim long ones. */
export function fitDescription(d: string): string {
	let t = d.replace(/\s+/g, " ").trim();
	if (t.length < 110) t = `${t}${TAIL}`;
	return t.length > 160 ? `${t.slice(0, 157).trimEnd()}…` : t;
}

/** The card picture for a fixed (non-dynamic) page, drawn by /api/og from lib/seo/sections. */
export const sectionImage = (key: string) => `/api/og?k=section&id=${encodeURIComponent(key)}`;

/**
 * The complete share metadata for one address: its own canonical and og:url (not the home page's), language,
 * site and creator on Twitter, a described picture, and a description of a useful length.
 */
export function socialMeta(o: { path: string; title: string; description: string; image: string; alt?: string; index?: boolean; type?: "website" | "article" }): Metadata {
	const description = fitDescription(o.description);
	return {
		description,
		alternates: { canonical: o.path },
		robots: o.index ? { index: true, follow: true } : { index: false, follow: false },
		openGraph: { type: o.type ?? "website", url: o.path, locale: "en_US", siteName: "Sauti Salama", title: o.title, description, images: [{ url: o.image, width: 1200, height: 630, alt: o.alt ?? o.title }] },
		twitter: { card: "summary_large_image", site: SITE_TWITTER, creator: SITE_TWITTER, title: o.title, description, images: [{ url: o.image, alt: o.alt ?? o.title }] },
	};
}

/** Fill in what a page's own metadata leaves out (canonical, og:url, picture, locale, twitter site) without changing what it says. */
export function withOg(meta: Metadata, path: string, key: string): Metadata {
	const title = typeof meta.title === "string" ? meta.title : meta.title && "absolute" in meta.title ? String(meta.title.absolute) : "Sauti Salama";
	const og = (meta.openGraph ?? {}) as Record<string, unknown>;
	const tw = (meta.twitter ?? {}) as Record<string, unknown>;
	const description = fitDescription(meta.description ?? "");
	const image = sectionImage(key);
	const ogTitle = typeof og.title === "string" ? og.title : title;
	return {
		...meta,
		description,
		alternates: { ...meta.alternates, canonical: path },
		openGraph: { type: "website", locale: "en_US", siteName: "Sauti Salama", ...og, url: path, description: fitDescription(String(og.description ?? description)), images: og.images ?? [{ url: image, width: 1200, height: 630, alt: ogTitle }] } as Metadata["openGraph"],
		twitter: { card: "summary_large_image", site: SITE_TWITTER, creator: SITE_TWITTER, title: ogTitle, ...tw, description: fitDescription(String(tw.description ?? description)), images: tw.images ?? [image] } as Metadata["twitter"],
	};
}
