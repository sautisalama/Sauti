import { NextResponse } from "next/server";
import { getActor } from "@/lib/access/super-admin";
import { originOf } from "@/lib/mail/origin";
import { logAudit } from "@/lib/access/audit";
import { completeConnection, isProvider } from "@/lib/mjengo/channel-oauth";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
	const { provider } = await params;
	const origin = originOf(request);
	const done = (q: string) => {
		const r = NextResponse.redirect(`${origin}/dashboard/mjengo/content?${q}`);
		r.cookies.delete({ name: "ss_channel_oauth", path: "/api/mjengo/channels" });
		return r;
	};
	const fail = (m: string) => done("channel_error=" + encodeURIComponent(m));

	const sp = new URL(request.url).searchParams;
	if (sp.get("error")) return fail(sp.get("error_description") || "The sign-in was cancelled.");
	const raw = request.headers.get("cookie")?.split(/;\s*/).find((c) => c.startsWith("ss_channel_oauth="))?.slice("ss_channel_oauth=".length);
	let pending: { s: string; v: string; p: string } | null = null;
	try { pending = raw ? JSON.parse(decodeURIComponent(raw)) : null; } catch { pending = null; }
	if (!isProvider(provider) || !pending || pending.p !== provider || pending.s !== sp.get("state")) return fail("That sign-in link has expired. Please try again.");

	const actor = await getActor();
	if (!actor?.isAdmin) return fail("Please sign in again.");
	const code = sp.get("code");
	if (!code) return fail("The network did not return a sign-in code.");

	try {
		const names = await completeConnection(provider, code, `${origin}/api/mjengo/channels/${provider}/callback`, pending.v, actor.id);
		await logAudit({ actorId: actor.id, actorEmail: actor.email, action: "channel.connected", targetType: "channel", targetLabel: names.join(", ") });
		return done("channel=" + encodeURIComponent(names.join(", ")));
	} catch (e) {
		return fail(e instanceof Error ? e.message : "Could not connect the account.");
	}
}
