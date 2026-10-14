import { publicDoc } from "@/lib/mjengo/public-doc";
import { upsertVersion, versionSize, type VersionMeta } from "@/lib/mjengo/doc-versions";

export const runtime = "nodejs";

const ID = /^[A-Za-z0-9_-]{6,80}$/;

/** Records a version in the list once its bytes have been uploaded directly. */
export async function POST(req: Request, ctx: { params: Promise<{ id: string; vid: string }> }) {
	const { id, vid } = await ctx.params;
	const d = await publicDoc(id);
	if (!d) return new Response("This document is not shared.", { status: 404 });
	if (d.access !== "edit") return new Response("This link does not allow editing.", { status: 403 });
	if (!ID.test(vid)) return new Response("Bad request.", { status: 400 });
	const meta = (await req.json().catch(() => null)) as VersionMeta | null;
	if (!meta || typeof meta !== "object" || typeof meta.createdAt !== "string") return new Response("Bad request.", { status: 400 });
	const size = await versionSize(`versions/${id}`, `${vid}.bin`);
	if (size === null) return new Response("The version was not uploaded.", { status: 409 });
	if (size > 100 * 1024 * 1024) return new Response("Too large.", { status: 413 });
	await upsertVersion(id, {
		id: vid,
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
