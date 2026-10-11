import { randomUUID } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getActor } from "@/lib/access/super-admin";
import { looseAdmin } from "@/lib/loose-db";
import { logAudit } from "@/lib/access/audit";
import { originOf } from "@/lib/mail/origin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const URL_RE = /https?:\/\/[^\s<>"')]+/i;
const MAX_FILE = 25 * 1024 * 1024;

/** A shared link or post becomes an opportunity, flagged so the team sees it arrived from a phone. */
async function addOpportunity(actor: { id: string; email: string }, input: { title: string; text: string; url: string }) {
	const firstLine = (input.text.split("\n").find((l) => l.trim() && !URL_RE.test(l)) ?? "").trim();
	let host = "";
	try { host = input.url ? new URL(input.url).hostname.replace(/^www\./, "") : ""; } catch { /* not a URL */ }
	const name = (input.title || firstLine || host || "Shared opportunity").slice(0, 200);
	const { data, error } = await looseAdmin()
		.from("mjengo_opportunities")
		.insert({
			title: name, kind: "other", status: "new",
			source_url: input.url ? input.url.slice(0, 2000) : null,
			description: input.text ? input.text.slice(0, 4000) : null,
			notes: "Shared from the phone share sheet.",
			owner_id: actor.id, created_by: actor.id, inbox: true,
		})
		.select("id, title")
		.single();
	if (error || !data) return null;
	await logAudit({ actorId: actor.id, actorEmail: actor.email, action: "opportunity.shared_in", targetType: "opportunity", targetId: data.id, targetLabel: data.title });
	return data.id as string;
}

/** Shared files are saved to the person's vault (top level, flagged) so they appear in Files. */
async function addFiles(actor: { id: string; email: string }, files: File[]) {
	const db = looseAdmin();
	let saved = 0;
	for (const f of files.slice(0, 10)) {
		if (!f.size || f.size > MAX_FILE) continue;
		const safe = f.name.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "file";
		const path = `vault/${actor.id}/${randomUUID()}-${safe}`;
		const up = await db.storage.from("mjengo-docs").upload(path, Buffer.from(await f.arrayBuffer()), { contentType: f.type || "application/octet-stream" });
		if (up.error) continue;
		const { data } = await db.from("vault_files").insert({ folder_id: null, name: f.name.slice(0, 200), storage_path: path, mime: f.type || null, size: f.size, owner_id: actor.id, inbox: true }).select("id").single();
		if (data) {
			saved += 1;
			await logAudit({ actorId: actor.id, actorEmail: actor.email, action: "vault.file_shared_in", targetType: "vault_file", targetId: data.id, targetLabel: f.name });
		}
	}
	return saved;
}

async function handle(request: NextRequest, fields: { title: string; text: string; url: string }, files: File[]) {
	const origin = originOf(request);
	const actor = await getActor();
	if (!actor) {
		// Text and links can be kept in the return address; files cannot, so ask to share again after sign-in.
		const q = new URLSearchParams({ title: fields.title, text: fields.text, url: fields.url });
		return NextResponse.redirect(`${origin}/signin?next=${encodeURIComponent(`/share?${q.toString()}`)}`, { status: 303 });
	}
	if (!actor.isAdmin) return NextResponse.redirect(`${origin}/dashboard?share=members_only`, { status: 303 });

	if (files.length) {
		const n = await addFiles(actor, files);
		return NextResponse.redirect(`${origin}/dashboard/mjengo/vault?shared_files=${n}`, { status: 303 });
	}
	let url = fields.url.trim();
	if (!url) url = URL_RE.exec(fields.text)?.[0] ?? URL_RE.exec(fields.title)?.[0] ?? "";
	if (!fields.title.trim() && !fields.text.trim() && !url) return NextResponse.redirect(`${origin}/dashboard/mjengo/opportunities`, { status: 303 });
	const id = await addOpportunity(actor, { title: fields.title.trim(), text: fields.text.trim(), url });
	return NextResponse.redirect(`${origin}/dashboard/mjengo/opportunities?${id ? `shared=${id}` : "share_error=1"}`, { status: 303 });
}

/** Share target (GET): title, text and url in the query string. */
export async function GET(request: NextRequest) {
	const sp = request.nextUrl.searchParams;
	return handle(request, { title: sp.get("title") ?? "", text: sp.get("text") ?? "", url: sp.get("url") ?? "" }, []);
}

/** Share target (POST): the same fields, plus any files, as multipart form data. */
export async function POST(request: NextRequest) {
	const form = await request.formData().catch(() => null);
	if (!form) return NextResponse.redirect(`${originOf(request)}/dashboard/mjengo/opportunities`, { status: 303 });
	const files = form.getAll("files").filter((x): x is File => typeof x !== "string");
	return handle(request, { title: String(form.get("title") ?? ""), text: String(form.get("text") ?? ""), url: String(form.get("url") ?? "") }, files);
}
