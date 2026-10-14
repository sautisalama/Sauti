import { storage, versionAccess } from "@/lib/mjengo/doc-versions";

export const runtime = "nodejs";

/** A one-time address the browser sends the version's bytes to directly, so the size is not limited by a function. */
export async function POST(_req: Request, ctx: { params: Promise<{ fileId: string; id: string }> }) {
	const { fileId, id } = await ctx.params;
	const refused = await versionAccess(fileId, "edit", id);
	if (refused) return refused;
	const { data, error } = await storage().createSignedUploadUrl(`versions/${fileId}/${id}.bin`, { upsert: true });
	if (error || !data) return new Response("Could not start the upload.", { status: 500 });
	return Response.json({ signedUrl: data.signedUrl });
}
