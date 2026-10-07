import { createPublicClient } from "@/utils/supabase/public-client";
import { createAdminClient } from "@/utils/supabase/admin-client";
import { PUBLICATIONS } from "@/lib/publications";
import type { PublicationRow } from "@/types/publishing";

const KIND_LABEL: Record<string, string> = {
	blog: "Blog",
	publication: "Publication",
	resource: "Resource",
	learn: "Learn",
};

/** One card on the homepage / index, whether it came from the database or the static list. */
export interface FeedItem {
	slug: string;
	title: string;
	summary: string;
	category: string;
	/** ISO date */
	date: string;
	dateLabel: string;
	href: string;
	image: string | null;
	imageAlt: string;
	readTime: string;
	source: "db" | "static";
	featured: boolean;
}

const fmt = (iso: string) =>
	new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

type Card = Pick<
	PublicationRow,
	"slug" | "title" | "summary" | "kind" | "category" | "cover_image_url" | "cover_image_alt" | "published_at" | "read_minutes" | "featured"
>;

const CARD_COLS = "slug, title, summary, kind, category, cover_image_url, cover_image_alt, published_at, read_minutes, featured";

function fromRow(r: Card): FeedItem {
	return {
		slug: r.slug,
		title: r.title,
		summary: r.summary ?? "",
		category: r.category || KIND_LABEL[r.kind] || "Publication",
		date: r.published_at!,
		dateLabel: fmt(r.published_at!),
		href: `/publications/${r.slug}`,
		image: r.cover_image_url,
		imageAlt: r.cover_image_alt || r.title,
		readTime: r.read_minutes ? `${r.read_minutes} min read` : KIND_LABEL[r.kind],
		source: "db",
		featured: r.featured,
	};
}

/**
 * Published content, newest first: database publications merged with the
 * long-standing static entries (which keep their own pages). Falls back to the
 * static list alone if the database is unreachable, so the homepage never breaks.
 */
export async function getFeed(opts: { limit?: number } = {}): Promise<FeedItem[]> {
	const statics: FeedItem[] = PUBLICATIONS.map((p) => ({
		slug: p.slug,
		title: p.title,
		summary: p.summary,
		category: p.category,
		date: p.date,
		dateLabel: p.dateLabel,
		href: p.href,
		image: p.image,
		imageAlt: p.imageAlt,
		readTime: p.readTime,
		source: "static" as const,
		featured: !!p.featured,
	}));

	let db: FeedItem[] = [];
	try {
		const { data, error } = await createPublicClient()
			.from("publications")
			.select(CARD_COLS)
			.eq("status", "published")
			.not("published_at", "is", null)
			.lte("published_at", new Date().toISOString())
			.order("published_at", { ascending: false })
			.limit(60);
		if (error) throw error;
		db = (data as unknown as Card[]).map(fromRow);
	} catch (e) {
		console.error("[feed] publications unavailable, using static list:", e instanceof Error ? e.message : e);
	}

	const seen = new Set(db.map((d) => d.slug));
	const all = [...db, ...statics.filter((s) => !seen.has(s.slug))].sort((a, b) => b.date.localeCompare(a.date));
	return opts.limit ? all.slice(0, opts.limit) : all;
}

export async function getPublishedBySlug(slug: string): Promise<PublicationRow | null> {
	const { data } = await createPublicClient().from("publications").select("*").eq("slug", slug).eq("status", "published").maybeSingle();
	return (data as unknown as PublicationRow) ?? null;
}

/** Draft preview via the secret link. The token is the credential, so it must match exactly. */
export async function getPreviewBySlug(slug: string, token: string): Promise<PublicationRow | null> {
	if (!/^[0-9a-f-]{36}$/i.test(token)) return null;
	const { data } = await createAdminClient().from("publications").select("*").eq("slug", slug).eq("preview_token", token).maybeSingle();
	return (data as unknown as PublicationRow) ?? null;
}
