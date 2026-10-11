import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getActor } from "@/lib/access/super-admin";
import { originOf } from "@/lib/mail/origin";
import { resolveDriveSource, safeReturn } from "@/lib/mjengo-drive";

export const runtime = "nodejs";

/**
 * Begin "Save to Google Drive" for one file. Access is limited to files this app creates (drive.file),
 * and no token is kept: the hop through Google is quick once the person has agreed the first time.
 */
export async function GET(request: Request) {
	const origin = originOf(request);
	const sp = new URL(request.url).searchParams;
	const ret = safeReturn(sp.get("return"));
	const back = (q: string) => NextResponse.redirect(`${origin}${ret}?${q}`);

	const actor = await getActor();
	if (!actor?.isAdmin) return back("drive_error=" + encodeURIComponent("Only administrators can save to Google Drive."));
	if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return back("drive_error=" + encodeURIComponent("Google sign-in is not set up on this site yet."));

	const kind = sp.get("kind") === "entity" ? "entity" : "vault";
	const id = sp.get("id") ?? "";
	try {
		await resolveDriveSource(actor, kind, id);
	} catch (e) {
		return back("drive_error=" + encodeURIComponent(e instanceof Error ? e.message : "That file could not be found."));
	}

	const state = randomBytes(24).toString("base64url");
	const q = new URLSearchParams({
		client_id: process.env.GOOGLE_CLIENT_ID,
		redirect_uri: `${origin}/api/mjengo/drive/google/callback`,
		response_type: "code",
		scope: "https://www.googleapis.com/auth/drive.file",
		state,
		login_hint: actor.email,
	});
	const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
	const payload = Buffer.from(JSON.stringify({ s: state, k: kind, i: id, r: ret })).toString("base64url");
	res.cookies.set("ss_drive_oauth", payload, { httpOnly: true, secure: origin.startsWith("https"), sameSite: "lax", path: "/api/mjengo/drive", maxAge: 600 });
	return res;
}
