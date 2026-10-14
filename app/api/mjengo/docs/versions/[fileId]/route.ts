import { loadIndex, versionAccess } from "@/lib/mjengo/doc-versions";

export const runtime = "nodejs";

/** The version list of one document, newest first. */
export async function GET(_req: Request, ctx: { params: Promise<{ fileId: string }> }) {
	const { fileId } = await ctx.params;
	const refused = await versionAccess(fileId, "view");
	if (refused) return refused;
	return Response.json(await loadIndex(fileId));
}
