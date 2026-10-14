import { upsertVersion, versionSize, versionAccess, type VersionMeta } from "@/lib/mjengo/doc-versions";

export const runtime = "nodejs";

/** Records a version in the history list once its bytes have been uploaded directly. */
export async function POST(req: Request, ctx: { params: Promise<{ fileId: string; id: string }> }) {
	const { fileId, id } = await ctx.params;
	const refused = await versionAccess(fileId, "edit", id);
	if (refused) return refused;
	const meta = (await req.json().catch(() => null)) as VersionMeta | null;
	if (!meta || typeof meta !== "object" || typeof meta.createdAt !== "string") return new Response("Bad request.", { status: 400 });
	// The bytes must really be there, and the size is read from storage rather than taken from the request.
	const size = await versionSize(`versions/${fileId}`, `${id}.bin`);
	if (size === null) return new Response("The version was not uploaded.", { status: 409 });
	if (size > 100 * 1024 * 1024) return new Response("Too large.", { status: 413 });
	await upsertVersion(fileId, {
		id,
		createdAt: meta.createdAt,
		reason: meta.reason,
		size,
		...(meta.author ? { author: { name: String(meta.author.name ?? "").slice(0, 80), color: meta.author.color } } : {}),
		...(meta.name ? { name: String(meta.name).slice(0, 80) } : {}),
		...(meta.title ? { title: String(meta.title).slice(0, 200) } : {}),
		...(typeof meta.words === "number" ? { words: meta.words } : {}),
	});
	return Response.json({ size });
}
