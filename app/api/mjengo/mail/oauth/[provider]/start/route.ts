import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getActor } from "@/lib/access/super-admin";
import { originOf } from "@/lib/mail/origin";
import { authorizeUrl, oauthConfigured, type OAuthProvider } from "@/lib/mail/oauth";
import { googleChoiceUrl, mustAskGoogleChoice } from "@/lib/mail/google-choice";

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

	if (p === "google" && new URL(request.url).searchParams.get("all") === null && (await mustAskGoogleChoice(request))) return NextResponse.redirect(googleChoiceUrl(origin, "mail", request));

	const state = randomBytes(24).toString("base64url");
	const sp = new URL(request.url).searchParams;
	// Google: mail, calendar, files and contacts in one consent, so nothing else has to be connected afterwards.
	const all = p === "google" && sp.get("all") !== "0";
	const res = NextResponse.redirect(authorizeUrl(p, origin, state, sp.get("email") || actor.email || undefined, all));
	if (all) res.cookies.set("ss_mail_oauth_all", "1", { httpOnly: true, secure: origin.startsWith("https"), sameSite: "lax", path: "/api/mjengo/mail/oauth", maxAge: 600 });
	res.cookies.set("ss_mail_oauth", `${p}:${state}`, { httpOnly: true, secure: origin.startsWith("https"), sameSite: "lax", path: "/api/mjengo/mail/oauth", maxAge: 600 });
	return res;
}
