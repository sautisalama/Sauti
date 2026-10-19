import { createClient } from "@/utils/supabase/server";
import { looseAdmin } from "@/lib/loose-db";

export const runtime = "nodejs";

/** The picture kept for an Instagram link preview. Instagram's own picture addresses expire, so ours is served instead, to signed-in people only. */
export async function GET(_req: Request, ctx: { params: Promise<{ hash: string }> }) {
	const { hash } = await ctx.params;
	if (!/^[a-f0-9]{40}$/.test(hash)) return new Response("Not found", { status: 404 });
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return new Response("Please sign in.", { status: 401 });
	const { data } = await looseAdmin().storage.from("mjengo-docs").download(`social/${hash}`);
	if (!data) return new Response("Not found", { status: 404 });
	return new Response(await data.arrayBuffer(), { headers: { "Content-Type": data.type || "image/jpeg", "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" } });
}
