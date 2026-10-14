import { publicDoc } from "@/lib/mjengo/public-doc";
import { loadIndex, parseVersionMeta, saveIndex, storage } from "@/lib/mjengo/doc-versions";

export const runtime = "nodejs";

const ID = /^[A-Za-z0-9_-]{6,80}$/;

/** Same version store as the suite, opened to anyone holding an edit link (viewers may read only). */
async function check(id: string, vid: string, write: boolean) {
	const d = await publicDoc(id);
	if (!d) return new Response("This document is not shared.", { status: 404 });
	if (!ID.test(vid)) return new Response("Bad request.", { status: 400 });
	if (write && d.access !== "edit") return new Response("This link does not allow editing.", { status: 403 });
	return null;
}

export async function GET(req: Request, ctx: { params: Promise<{ id: string; vid: string }> }) {
	const { id, vid } = await ctx.params;
	const bad = await check(id, vid, false);
	if (bad) return bad;
	// A document with pictures is larger than a function may send back: the browser reads it from storage itself.
	if (new URL(req.url).searchParams.get("url")) {
		const { data: signed } = await storage().createSignedUrl(`versions/${id}/${vid}.bin`, 120);
		if (!signed?.signedUrl) return new Response("Not found.", { status: 404 });
		return Response.json({ url: signed.signedUrl });
	}
	const { data } = await storage().download(`versions/${id}/${vid}.bin`);
	if (!data) return new Response("Not found.", { status: 404 });
	return new Response(await data.arrayBuffer(), { headers: { "Content-Type": "application/octet-stream" } });
}

export async function PUT(req: Request, ctx: { params: Promise<{ id: string; vid: string }> }) {
	const { id, vid } = await ctx.params;
	const bad = await check(id, vid, true);
	if (bad) return bad;
	const meta = parseVersionMeta(req.headers.get("x-version-meta"));
	if (!meta) return new Response("Bad request.", { status: 400 });
	const bytes = new Uint8Array(await req.arrayBuffer());
	if (bytes.length > 25 * 1024 * 1024) return new Response("Too large.", { status: 413 });
	const up = await storage().upload(`versions/${id}/${vid}.bin`, bytes, { contentType: "application/octet-stream", upsert: true });
	if (up.error) return new Response("Could not save.", { status: 500 });
	const list = (await loadIndex(id)).filter((m) => m.id !== vid);
	list.unshift({ ...meta, id: vid, size: bytes.length });
	await saveIndex(id, list.slice(0, 300));
	return new Response(null, { status: 204 });
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string; vid: string }> }) {
	const { id, vid } = await ctx.params;
	const bad = await check(id, vid, true);
	if (bad) return bad;
	const body = (await req.json().catch(() => ({}))) as { name?: string | null };
	const list = await loadIndex(id);
	await saveIndex(id, list.map((m) => (m.id === vid ? { ...m, name: body.name ? String(body.name).slice(0, 80) : undefined } : m)));
	return new Response(null, { status: 204 });
}
