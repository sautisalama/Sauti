import { getActor } from "@/lib/access/super-admin";
import { loadIndex } from "@/lib/mjengo/doc-versions";

export const runtime = "nodejs";

/** The version list of one document, newest first. */
export async function GET(_req: Request, ctx: { params: Promise<{ fileId: string }> }) {
	const actor = await getActor();
	if (!actor?.isAdmin) return new Response("Please sign in again.", { status: 401 });
	const { fileId } = await ctx.params;
	const list = await loadIndex(fileId);
	return Response.json(list);
}
