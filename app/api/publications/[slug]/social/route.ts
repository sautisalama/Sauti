import { renderSocialCard } from "@/lib/content/pdf-preview";
import { createPublicClient } from "@/utils/supabase/public-client";

export const runtime = "nodejs";
export const maxDuration = 60;

/** 1200×630 share image for a PDF post without its own cover. */
export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
	const { slug } = await params;
	const { data } = await createPublicClient()
		.from("publications")
		.select("source_file_url, display_mode, cover_image_url")
		.eq("slug", slug)
		.eq("status", "published")
		.maybeSingle();
	if (!data) return new Response("Not found", { status: 404 });
	if (data.cover_image_url) return Response.redirect(data.cover_image_url, 302);
	if (data.display_mode !== "pdf" || !data.source_file_url) return new Response("Not found", { status: 404 });
	const card = await renderSocialCard(data.source_file_url);
	if (!card) return new Response("Could not render the preview", { status: 502 });
	return new Response(new Uint8Array(card), {
		headers: { "Content-Type": "image/jpeg", "Cache-Control": "public, max-age=3600, s-maxage=604800, stale-while-revalidate=2592000" },
	});
}
