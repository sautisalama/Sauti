import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getActor } from "@/lib/access/super-admin";
import { originOf } from "@/lib/mail/origin";

export const runtime = "nodejs";

const AUTHORIZE = "https://auth.openai.com/api/accounts/authorize";

/**
 * Sign in with ChatGPT (OpenID Connect with PKCE). OpenAI issues the client id to approved apps:
 * set OPENAI_SIWC_CLIENT_ID once it has been granted, and register the callback shown below.
 */
export async function GET(request: Request) {
	const origin = originOf(request);
	const back = (q: string) => NextResponse.redirect(`${origin}/dashboard/mjengo/assistant?${q}`);
	const actor = await getActor();
	if (!actor?.isAdmin) return back("chatgpt_error=" + encodeURIComponent("Only administrators can connect ChatGPT."));
	const clientId = process.env.OPENAI_SIWC_CLIENT_ID;
	if (!clientId) return back("chatgpt_error=" + encodeURIComponent("Sign in with ChatGPT is not switched on for this site yet."));

	const verifier = randomBytes(48).toString("base64url");
	const state = randomBytes(24).toString("base64url");
	const nonce = randomBytes(16).toString("base64url");
	const q = new URLSearchParams({
		client_id: clientId,
		response_type: "code",
		redirect_uri: `${origin}/api/mjengo/assistant/chatgpt/callback`,
		scope: "openid profile email offline_access resource.invoke chatgpt.tokens.use.direct",
		resource: "https://api.openai.com/v1",
		state,
		nonce,
		code_challenge: createHash("sha256").update(verifier).digest("base64url"),
		code_challenge_method: "S256",
		login_hint: actor.email,
	});
	const res = NextResponse.redirect(`${AUTHORIZE}?${q}`);
	res.cookies.set("ss_chatgpt_oauth", JSON.stringify({ s: state, v: verifier }), { httpOnly: true, secure: origin.startsWith("https"), sameSite: "lax", path: "/api/mjengo/assistant/chatgpt", maxAge: 600 });
	return res;
}
