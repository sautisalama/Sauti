import { loadIndex, parseVersionMeta, saveIndex, storage, versionAccess } from "@/lib/mjengo/doc-versions";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ fileId: string; id: string }> };

/**
 * One version. `?url=1` answers with a short-lived address to read the bytes from directly: a document with
 * pictures is larger than a function may send back, so the browser fetches it from storage itself.
 */
export async function GET(req: Request, ctx: Ctx) {
	const { fileId, id } = await ctx.params;
	const refused = await versionAccess(fileId, "view", id);
	if (refused) return refused;
	const path = `versions/${fileId}/${id}.bin`;
	if (new URL(req.url).searchParams.get("url")) {
		const { data } = await storage().createSignedUrl(path, 120);
		if (!data?.signedUrl) return new Response("Not found.", { status: 404 });
		return Response.json({ url: data.signedUrl });
	}
	const { data } = await storage().download(path);
	if (!data) return new Response("Not found.", { status: 404 });
	return new Response(await data.arrayBuffer(), { headers: { "Content-Type": "application/octet-stream" } });
}

/** Small documents can still be sent through here; larger ones go straight to storage (see /upload and /commit). */
export async function PUT(req: Request, ctx: Ctx) {
	const { fileId, id } = await ctx.params;
	const refused = await versionAccess(fileId, "edit", id);
	if (refused) return refused;
	const meta = parseVersionMeta(req.headers.get("x-version-meta"));
	if (!meta) return new Response("Bad request.", { status: 400 });
	const bytes = new Uint8Array(await req.arrayBuffer());
	if (bytes.length > 25 * 1024 * 1024) return new Response("Too large.", { status: 413 });
	const up = await storage().upload(`versions/${fileId}/${id}.bin`, bytes, { contentType: "application/octet-stream", upsert: true });
	if (up.error) return new Response("Could not save.", { status: 500 });
	const list = (await loadIndex(fileId)).filter((m) => m.id !== id);
	list.unshift({ ...meta, id, size: bytes.length });
	await saveIndex(fileId, list.slice(0, 300));
	return new Response(null, { status: 204 });
}

export async function PATCH(req: Request, ctx: Ctx) {
	const { fileId, id } = await ctx.params;
	const refused = await versionAccess(fileId, "edit", id);
	if (refused) return refused;
	const body = (await req.json().catch(() => ({}))) as { name?: string | null };
	const list = await loadIndex(fileId);
	await saveIndex(fileId, list.map((m) => (m.id === id ? { ...m, name: body.name ? String(body.name).slice(0, 80) : undefined } : m)));
	return new Response(null, { status: 204 });
}

export async function DELETE(_req: Request, ctx: Ctx) {
	const { fileId, id } = await ctx.params;
	const refused = await versionAccess(fileId, "edit", id);
	if (refused) return refused;
	await storage().remove([`versions/${fileId}/${id}.bin`]);
	await saveIndex(fileId, (await loadIndex(fileId)).filter((m) => m.id !== id));
	return new Response(null, { status: 204 });
}
