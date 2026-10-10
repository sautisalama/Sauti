import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getActor } from "@/lib/access/super-admin";
import { originOf } from "@/lib/mail/origin";

export const runtime = "nodejs";

/** Begin "Import from Google": read-only access to the person's Google contacts, used once. */
export async function GET(request: Request) {
	const origin = originOf(request);
	const back = (q: string) => NextResponse.redirect(`${origin}/dashboard/mjengo/contacts?${q}`);
	const actor = await getActor();
	if (!actor?.isAdmin) return back("import_error=" + encodeURIComponent("Only administrators can import contacts."));
	if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return back("import_error=" + encodeURIComponent("Google sign-in is not set up on this site yet."));

	const state = randomBytes(24).toString("base64url");
	const q = new URLSearchParams({
		client_id: process.env.GOOGLE_CLIENT_ID,
		redirect_uri: `${origin}/api/mjengo/contacts/google/callback`,
		response_type: "code",
		scope: "https://www.googleapis.com/auth/contacts.readonly openid email",
		state,
		prompt: "select_account",
		login_hint: actor.email,
	});
	const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
	res.cookies.set("ss_contacts_oauth", state, { httpOnly: true, secure: origin.startsWith("https"), sameSite: "lax", path: "/api/mjengo/contacts", maxAge: 600 });
	return res;
}
