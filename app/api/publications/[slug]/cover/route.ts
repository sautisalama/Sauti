import { renderCover } from "@/lib/content/pdf-preview";
import { createPublicClient } from "@/utils/supabase/public-client";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * First page of a PDF publication as a PNG: the preview image for posts that have no cover of
 * their own. Rendered on demand and cached by the CDN, so it also covers already-published posts.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const { data } = await createPublicClient()
		.from("publications")
		.select("source_file_url, display_mode, cover_image_url")
		.eq("slug", slug)
		.eq("status", "published")
		.maybeSingle();
	if (!data || data.display_mode !== "pdf" || !data.source_file_url) return new Response("Not found", { status: 404 });
	if (data.cover_image_url) return Response.redirect(data.cover_image_url, 302);

	const png = await renderCover(data.source_file_url);
	if (!png) return new Response("Could not render the preview", { status: 502 });
	return new Response(png, {
		headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=3600, s-maxage=604800, stale-while-revalidate=2592000" },
	});
}
