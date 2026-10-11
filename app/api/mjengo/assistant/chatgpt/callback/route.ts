import { NextResponse } from "next/server";
import { getActor } from "@/lib/access/super-admin";
import { originOf } from "@/lib/mail/origin";
import { looseAdmin } from "@/lib/loose-db";
import { encryptField } from "@/lib/security/crypto";

export const runtime = "nodejs";

const TOKEN = "https://auth.openai.com/api/accounts/oauth/token";

/** Finish Sign in with ChatGPT: keep the (encrypted) tokens so the assistant can use the person's ChatGPT plan. */
export async function GET(request: Request) {
	const origin = originOf(request);
	const done = (q: string) => {
		const r = NextResponse.redirect(`${origin}/dashboard/mjengo/assistant?${q}`);
		r.cookies.delete({ name: "ss_chatgpt_oauth", path: "/api/mjengo/assistant/chatgpt" });
		return r;
	};
	const fail = (m: string) => done("chatgpt_error=" + encodeURIComponent(m));

	const sp = new URL(request.url).searchParams;
	if (sp.get("error")) return fail(sp.get("error_description") || "The sign-in was cancelled.");
	const raw = request.headers.get("cookie")?.split(/;\s*/).find((c) => c.startsWith("ss_chatgpt_oauth="))?.slice("ss_chatgpt_oauth=".length);
	let pending: { s: string; v: string } | null = null;
	try { pending = raw ? JSON.parse(decodeURIComponent(raw)) : null; } catch { pending = null; }
	if (!pending || pending.s !== sp.get("state")) return fail("That sign-in link has expired. Please try again.");

	const actor = await getActor();
	if (!actor?.isAdmin) return fail("Please sign in again.");
	const code = sp.get("code");
	const clientId = process.env.OPENAI_SIWC_CLIENT_ID;
	if (!code || !clientId) return fail("OpenAI did not return a sign-in code.");

	try {
		const res = await fetch(TOKEN, {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				grant_type: "authorization_code",
				client_id: clientId,
				code,
				code_verifier: pending.v,
				redirect_uri: `${origin}/api/mjengo/assistant/chatgpt/callback`,
				resource: "https://api.openai.com/v1",
			}),
			signal: AbortSignal.timeout(20_000),
		});
		const t = (await res.json()) as { access_token?: string; refresh_token?: string; expires_in?: number; scope?: string; error_description?: string };
		if (!res.ok || !t.access_token) return fail(t.error_description || "OpenAI refused the sign-in.");
		// The ChatGPT plan can only be used when this scope was granted.
		if (!(t.scope ?? "").includes("chatgpt.tokens.use.direct")) return fail("Your ChatGPT plan cannot be used here. It needs Plus or Pro.");

		await looseAdmin().from("mjengo_ai_settings").upsert(
			{
				owner_id: actor.id,
				provider: "chatgpt",
				api_key_enc: encryptField(t.access_token),
				refresh_token_enc: encryptField(t.refresh_token ?? ""),
				token_expires_at: new Date(Date.now() + (t.expires_in ?? 3600) * 1000).toISOString(),
				chatgpt_client_id: clientId,
				model: null,
				updated_at: new Date().toISOString(),
			},
			{ onConflict: "owner_id" }
		);
		return done("chatgpt=connected");
	} catch (e) {
		return fail(e instanceof Error ? e.message : "Could not sign in with ChatGPT.");
	}
}
