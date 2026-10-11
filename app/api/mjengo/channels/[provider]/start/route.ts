import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getActor } from "@/lib/access/super-admin";
import { originOf } from "@/lib/mail/origin";
import { isProvider, providerConfig } from "@/lib/mjengo/channel-oauth";

export const runtime = "nodejs";

/** Begin connecting a social account (linkedin, x or meta for Facebook Pages and Instagram). */
export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
	const { provider } = await params;
	const origin = originOf(request);
	const back = (q: string) => NextResponse.redirect(`${origin}/dashboard/mjengo/content?${q}`);
	const actor = await getActor();
	if (!actor?.isAdmin) return back("channel_error=" + encodeURIComponent("Only administrators can connect accounts."));
	if (!isProvider(provider)) return back("channel_error=" + encodeURIComponent("Unknown network."));
	const cfg = providerConfig(provider);
	if (!cfg.id) return back("channel_error=" + encodeURIComponent("This network is not set up on this site yet. Add its app keys first."));

	const state = randomBytes(24).toString("base64url");
	const verifier = randomBytes(48).toString("base64url");
	const q = new URLSearchParams({
		response_type: "code",
		client_id: cfg.id,
		redirect_uri: `${origin}/api/mjengo/channels/${provider}/callback`,
		scope: cfg.scope,
		state,
		...(cfg.pkce ? { code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" } : {}),
	});
	const res = NextResponse.redirect(`${cfg.authorize}?${q}`);
	res.cookies.set("ss_channel_oauth", JSON.stringify({ s: state, v: verifier, p: provider }), { httpOnly: true, secure: origin.startsWith("https"), sameSite: "lax", path: "/api/mjengo/channels", maxAge: 600 });
	return res;
}
