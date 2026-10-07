import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, EyeOff } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { ArticleView, KIND_LABEL } from "@/components/publishing/ArticleView";
import { getPreviewBySlug, getPublishedBySlug } from "@/lib/content/feed";
import { sanitizeContent } from "@/lib/content/sanitize";
import { createPublicClient } from "@/utils/supabase/public-client";
import { ORGANIZATION } from "@/lib/organization";
import { breadcrumbSchema, jsonLd } from "@/lib/seo";

type Props = { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> };

async function load(slug: string, preview?: string) {
	if (preview) {
		const draft = await getPreviewBySlug(slug, preview);
		if (draft) return { pub: draft, isPreview: draft.status !== "published" };
	}
	const pub = await getPublishedBySlug(slug);
	return { pub, isPreview: false };
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
	const { slug } = await params;
	const { preview } = await searchParams;
	const { pub, isPreview } = await load(slug, preview);
	if (!pub) return { title: "Not found", robots: { index: false } };
	const url = `${ORGANIZATION.url}/publications/${pub.slug}`;
	return {
		title: pub.title,
		description: pub.summary ?? undefined,
		alternates: { canonical: `/publications/${pub.slug}` },
		robots: isPreview ? { index: false, follow: false } : undefined,
		openGraph: {
			title: pub.title,
			description: pub.summary ?? undefined,
			url,
			type: "article",
			publishedTime: pub.published_at ?? undefined,
			images: pub.cover_image_url ? [pub.cover_image_url] : undefined,
		},
	};
}

export default async function PublicationPage({ params, searchParams }: Props) {
	const { slug } = await params;
	const { preview } = await searchParams;
	const { pub, isPreview } = await load(slug, preview);
	if (!pub) notFound();

	if (!isPreview) {
		// Fire-and-forget view counter; never blocks or breaks rendering.
		createPublicClient()
			.rpc("increment_publication_views", { p_slug: pub.slug })
			.then(
				() => undefined,
				() => undefined
			);
	}

	const url = `${ORGANIZATION.url}/publications/${pub.slug}`;
	const schema = {
		"@context": "https://schema.org",
		"@type": "Article",
		headline: pub.title,
		description: pub.summary ?? undefined,
		image: pub.cover_image_url ?? undefined,
		datePublished: pub.published_at ?? undefined,
		dateModified: pub.updated_at,
		mainEntityOfPage: url,
		inLanguage: "en-KE",
		isAccessibleForFree: true,
		author: { "@id": `${ORGANIZATION.url}/#organization` },
		publisher: { "@id": `${ORGANIZATION.url}/#organization` },
	};

	return (
		<div className="flex min-h-screen flex-col bg-white">
			{!isPreview && (
				<>
					<script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(schema) }} />
					<script
						type="application/ld+json"
						dangerouslySetInnerHTML={{
							__html: jsonLd(
								breadcrumbSchema([
									{ name: "Home", path: "/" },
									{ name: "Publications", path: "/publications" },
									{ name: pub.title, path: `/publications/${pub.slug}` },
								])
							),
						}}
					/>
				</>
			)}
			<Nav />
			{isPreview && (
				<div role="status" className="flex items-center justify-center gap-2 bg-amber-100 px-4 py-2 text-center text-sm font-bold text-amber-900">
					<EyeOff className="h-4 w-4" aria-hidden /> Preview — this {pub.status.replace("_", " ")} is not public yet.
				</div>
			)}
			<main id="main-content" className="flex-1 px-4 py-10 md:py-16">
				<div className="mx-auto mb-8 max-w-3xl">
					<Link href="/publications" className="inline-flex items-center gap-2 text-sm font-bold text-[#1a365d] hover:text-sauti-orange">
						<ArrowLeft className="h-4 w-4" aria-hidden /> All publications
					</Link>
				</div>
				<ArticleView
					title={pub.title}
					summary={pub.summary}
					category={pub.category}
					kindLabel={KIND_LABEL[pub.kind]}
					coverUrl={pub.cover_image_url}
					coverAlt={pub.cover_image_alt}
					publishedAt={pub.published_at}
					readMinutes={pub.read_minutes}
					// Sanitised on write, and again on read as defence in depth.
					bodyHtml={sanitizeContent(pub.body)}
					links={pub.external_links}
					tags={pub.tags}
				/>
			</main>
			<div className="bg-[#00473e]">
				<Footer />
			</div>
		</div>
	);
}
