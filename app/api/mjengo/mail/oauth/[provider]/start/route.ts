import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getActor } from "@/lib/access/super-admin";
import { originOf } from "@/lib/mail/origin";
import { authorizeUrl, oauthConfigured, type OAuthProvider } from "@/lib/mail/oauth";

export const runtime = "nodejs";

/** Begin "Sign in with Google / Microsoft" for the signed-in admin. */
export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
	const { provider } = await params;
	if (provider !== "google" && provider !== "microsoft") return NextResponse.json({ error: "Unknown provider" }, { status: 404 });
	const p = provider as OAuthProvider;

	const origin = originOf(request);
	const back = (q: string) => NextResponse.redirect(`${origin}/dashboard/mjengo/mail?${q}`);

	const actor = await getActor();
	if (!actor?.isAdmin) return back("mail_error=" + encodeURIComponent("Only administrators can connect a mailbox."));
	if (!oauthConfigured(p)) return back("mail_error=" + encodeURIComponent(`${p === "google" ? "Google" : "Microsoft"} sign-in is not set up on this site yet.`));

	const state = randomBytes(24).toString("base64url");
	const res = NextResponse.redirect(authorizeUrl(p, origin, state, new URL(request.url).searchParams.get("email") || undefined));
	res.cookies.set("ss_mail_oauth", `${p}:${state}`, { httpOnly: true, secure: origin.startsWith("https"), sameSite: "lax", path: "/api/mjengo/mail/oauth", maxAge: 600 });
	return res;
}
