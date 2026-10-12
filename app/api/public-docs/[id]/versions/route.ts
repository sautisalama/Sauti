import { publicDoc } from "@/lib/mjengo/public-doc";
import { loadIndex } from "@/lib/mjengo/doc-versions";

export const runtime = "nodejs";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
	const { id } = await ctx.params;
	if (!(await publicDoc(id))) return new Response("This document is not shared.", { status: 404 });
	return Response.json(await loadIndex(id));
}
