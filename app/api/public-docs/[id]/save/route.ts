import { looseAdmin } from "@/lib/loose-db";
import { publicDoc } from "@/lib/mjengo/public-doc";

export const runtime = "nodejs";

/** Saves the document for someone using an edit link. The file keeps its place, name and type. */
export async function PUT(req: Request, ctx: { params: Promise<{ id: string }> }) {
	const { id } = await ctx.params;
	const d = await publicDoc(id);
	if (!d || d.access !== "edit") return new Response("This link does not allow editing.", { status: 403 });
	const bytes = new Uint8Array(await req.arrayBuffer());
	if (!bytes.length || bytes.length > 25 * 1024 * 1024) return new Response("Bad size.", { status: 413 });
	const db = looseAdmin();
	const up = await db.storage.from("mjengo-docs").upload(d.storage_path, bytes, { upsert: true, contentType: d.mime ?? "application/octet-stream" });
	if (up.error) return new Response("Could not save.", { status: 500 });
	await db.from("vault_files").update({ size: bytes.length, updated_at: new Date().toISOString() }).eq("id", id);
	return new Response(null, { status: 204 });
}
