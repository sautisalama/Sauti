import { NextResponse, type NextRequest } from "next/server";
import { getActor } from "@/lib/access/super-admin";
import { looseAdmin } from "@/lib/loose-db";
import { logAudit } from "@/lib/access/audit";
import { originOf } from "@/lib/mail/origin";

export const dynamic = "force-dynamic";

const URL_RE = /https?:\/\/[^\s<>"')]+/i;

/**
 * Web Share Target. With the app installed, "Share" on a phone lists Sauti Salama; a shared post, page or
 * link arrives here as /share?title=&text=&url= and is saved as a new opportunity for the team to evaluate.
 */
export async function GET(request: NextRequest) {
	const origin = originOf(request);
	const sp = request.nextUrl.searchParams;
	const actor = await getActor();

	if (!actor) {
		// Keep what was shared in the return address so nothing is lost at sign-in.
		return NextResponse.redirect(`${origin}/signin?next=${encodeURIComponent(`/share?${sp.toString()}`)}`);
	}
	if (!actor.isAdmin) return NextResponse.redirect(`${origin}/dashboard?share=members_only`);

	const title = (sp.get("title") ?? "").trim();
	const text = (sp.get("text") ?? "").trim();
	let url = (sp.get("url") ?? "").trim();
	if (!url) url = URL_RE.exec(text)?.[0] ?? URL_RE.exec(title)?.[0] ?? "";
	if (!title && !text && !url) return NextResponse.redirect(`${origin}/dashboard/mjengo/opportunities`);

	const firstLine = (text.split("\n").find((l) => l.trim() && !URL_RE.test(l)) ?? "").trim();
	let host = "";
	try { host = url ? new URL(url).hostname.replace(/^www\./, "") : ""; } catch { /* not a URL */ }
	const name = (title || firstLine || host || "Shared opportunity").slice(0, 200);

	const { data, error } = await looseAdmin()
		.from("mjengo_opportunities")
		.insert({
			title: name,
			kind: "other",
			status: "new",
			source_url: url ? url.slice(0, 2000) : null,
			description: text ? text.slice(0, 4000) : null,
			notes: "Shared from the phone share sheet.",
			owner_id: actor.id,
			created_by: actor.id,
		})
		.select("id, title")
		.single();
	if (error || !data) return NextResponse.redirect(`${origin}/dashboard/mjengo/opportunities?share_error=1`);

	await logAudit({ actorId: actor.id, actorEmail: actor.email, action: "opportunity.shared_in", targetType: "opportunity", targetId: data.id, targetLabel: data.title });
	return NextResponse.redirect(`${origin}/dashboard/mjengo/opportunities?shared=${data.id}`, { status: 303 });
}
