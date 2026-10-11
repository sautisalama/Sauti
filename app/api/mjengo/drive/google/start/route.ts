import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getActor } from "@/lib/access/super-admin";
import { originOf } from "@/lib/mail/origin";
import { resolveDriveSource, safeReturn } from "@/lib/mjengo-drive";
import { driveConnection } from "@/lib/google-drive";

export const runtime = "nodejs";

/**
 * Begin "Save to Google Drive" (kind=vault|entity, id=<file>) or just "Connect Google Drive" (kind=connect).
 * Access is limited to files this app creates (drive.file). The refresh token is kept, encrypted, so later
 * edits can update the Drive copy by themselves.
 */
export async function GET(request: Request) {
	const origin = originOf(request);
	const sp = new URL(request.url).searchParams;
	const ret = safeReturn(sp.get("return"));
	const back = (q: string) => NextResponse.redirect(`${origin}${ret}?${q}`);

	const actor = await getActor();
	if (!actor?.isAdmin) return back("drive_error=" + encodeURIComponent("Only administrators can use Google Drive."));
	if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) return back("drive_error=" + encodeURIComponent("Google sign-in is not set up on this site yet."));

	const kind = sp.get("kind") === "entity" ? "entity" : sp.get("kind") === "connect" ? "connect" : "vault";
	const id = sp.get("id") ?? "";
	if (kind !== "connect") {
		try {
			await resolveDriveSource(actor, kind, id);
		} catch (e) {
			return back("drive_error=" + encodeURIComponent(e instanceof Error ? e.message : "That file could not be found."));
		}
	}

	const connected = await driveConnection(actor.id);
	const state = randomBytes(24).toString("base64url");
	const q = new URLSearchParams({
		client_id: process.env.GOOGLE_CLIENT_ID,
		redirect_uri: `${origin}/api/mjengo/drive/google/callback`,
		response_type: "code",
		scope: "https://www.googleapis.com/auth/drive.file openid email",
		access_type: "offline",
		state,
		login_hint: connected?.email || actor.email,
		// A refresh token is only issued on consent, so ask whenever we do not hold one yet.
		...(connected ? {} : { prompt: "consent" }),
	});
	const res = NextResponse.redirect(`https://accounts.google.com/o/oauth2/v2/auth?${q}`);
	const payload = Buffer.from(JSON.stringify({ s: state, k: kind, i: id, r: ret })).toString("base64url");
	res.cookies.set("ss_drive_oauth", payload, { httpOnly: true, secure: origin.startsWith("https"), sameSite: "lax", path: "/api/mjengo/drive", maxAge: 600 });
	return res;
}
