import { getActor } from "@/lib/access/super-admin";
import { loadIndex, saveIndex, storage, type VersionMeta } from "@/lib/mjengo/doc-versions";

export const runtime = "nodejs";

const ID = /^[A-Za-z0-9_-]{6,80}$/;

async function guardUser(fileId: string, id: string) {
	const actor = await getActor();
	if (!actor?.isAdmin) return new Response("Please sign in again.", { status: 401 });
	if (!/^[0-9a-f-]{36}$/i.test(fileId) || !ID.test(id)) return new Response("Bad request.", { status: 400 });
	return null;
}

export async function GET(_req: Request, ctx: { params: Promise<{ fileId: string; id: string }> }) {
	const { fileId, id } = await ctx.params;
	const bad = await guardUser(fileId, id);
	if (bad) return bad;
	const { data } = await storage().download(`versions/${fileId}/${id}.bin`);
	if (!data) return new Response("Not found.", { status: 404 });
	return new Response(await data.arrayBuffer(), { headers: { "Content-Type": "application/octet-stream" } });
}

export async function PUT(req: Request, ctx: { params: Promise<{ fileId: string; id: string }> }) {
	const { fileId, id } = await ctx.params;
	const bad = await guardUser(fileId, id);
	if (bad) return bad;
	let meta: VersionMeta;
	try { meta = JSON.parse(req.headers.get("x-version-meta") ?? "{}") as VersionMeta; } catch { return new Response("Bad request.", { status: 400 }); }
	const bytes = new Uint8Array(await req.arrayBuffer());
	if (bytes.length > 25 * 1024 * 1024) return new Response("Too large.", { status: 413 });
	const up = await storage().upload(`versions/${fileId}/${id}.bin`, bytes, { contentType: "application/octet-stream", upsert: true });
	if (up.error) return new Response("Could not save.", { status: 500 });
	const list = (await loadIndex(fileId)).filter((m) => m.id !== id);
	list.unshift({ ...meta, id, size: bytes.length });
	await saveIndex(fileId, list.slice(0, 300));
	return new Response(null, { status: 204 });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ fileId: string; id: string }> }) {
	const { fileId, id } = await ctx.params;
	const bad = await guardUser(fileId, id);
	if (bad) return bad;
	const body = (await req.json().catch(() => ({}))) as { name?: string | null };
	const list = await loadIndex(fileId);
	await saveIndex(fileId, list.map((m) => (m.id === id ? { ...m, name: body.name ? String(body.name).slice(0, 80) : undefined } : m)));
	return new Response(null, { status: 204 });
}

export async function DELETE(_req: Request, ctx: { params: Promise<{ fileId: string; id: string }> }) {
	const { fileId, id } = await ctx.params;
	const bad = await guardUser(fileId, id);
	if (bad) return bad;
	await storage().remove([`versions/${fileId}/${id}.bin`]);
	await saveIndex(fileId, (await loadIndex(fileId)).filter((m) => m.id !== id));
	return new Response(null, { status: 204 });
}
