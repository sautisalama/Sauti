import { looseAdmin } from "@/lib/loose-db";
import { publicDoc } from "@/lib/mjengo/public-doc";

export const runtime = "nodejs";

/** A short-lived link to the document's bytes, only for documents opened to anyone with the link. */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
	const { id } = await ctx.params;
	const d = await publicDoc(id);
	if (!d) return new Response("This document is not shared.", { status: 404 });
	const { data } = await looseAdmin().storage.from("mjengo-docs").createSignedUrl(d.storage_path, 300);
	if (!data) return new Response("Could not open the document.", { status: 500 });
	return Response.json({ url: data.signedUrl, name: d.name, access: d.access });
}
