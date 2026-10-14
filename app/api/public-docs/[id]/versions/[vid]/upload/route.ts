import { publicDoc } from "@/lib/mjengo/public-doc";
import { storage } from "@/lib/mjengo/doc-versions";

export const runtime = "nodejs";

const ID = /^[A-Za-z0-9_-]{6,80}$/;

/** A one-time address for sending a version's bytes straight to storage (only for links that allow editing). */
export async function POST(_req: Request, ctx: { params: Promise<{ id: string; vid: string }> }) {
	const { id, vid } = await ctx.params;
	const d = await publicDoc(id);
	if (!d) return new Response("This document is not shared.", { status: 404 });
	if (d.access !== "edit") return new Response("This link does not allow editing.", { status: 403 });
	if (!ID.test(vid)) return new Response("Bad request.", { status: 400 });
	const { data, error } = await storage().createSignedUploadUrl(`versions/${id}/${vid}.bin`, { upsert: true });
	if (error || !data) return new Response("Could not start the upload.", { status: 500 });
	return Response.json({ signedUrl: data.signedUrl });
}
