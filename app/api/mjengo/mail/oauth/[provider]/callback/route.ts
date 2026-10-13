import { NextResponse } from "next/server";
import { looseAdmin } from "@/lib/loose-db";
import { encryptField } from "@/lib/security/crypto";
import { logAudit } from "@/lib/access/audit";
import { getActor } from "@/lib/access/super-admin";
import { emailFromIdToken, exchangeCode, oauthServers, type OAuthProvider } from "@/lib/mail/oauth";
import { testImap, verifySmtp } from "@/lib/mail/client";
import { originOf } from "@/lib/mail/origin";
import { saveCalendarTokens } from "@/lib/calendar/tokens";
import { saveDriveConnection } from "@/lib/google-drive";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Finish "Sign in with Google / Microsoft": store the refresh token (encrypted) and open the mailbox. */
export async function GET(request: Request, { params }: { params: Promise<{ provider: string }> }) {
	const { provider } = await params;
	const origin = originOf(request);
	const back = (q: string) => {
		const r = NextResponse.redirect(`${origin}/dashboard/mjengo/mail?${q}`);
		r.cookies.delete({ name: "ss_mail_oauth", path: "/api/mjengo/mail/oauth" });
		r.cookies.delete({ name: "ss_mail_oauth_all", path: "/api/mjengo/mail/oauth" });
		return r;
	};
	const fail = (m: string) => back("mail_error=" + encodeURIComponent(m));

	if (provider !== "google" && provider !== "microsoft") return fail("Unknown provider.");
	const p = provider as OAuthProvider;
	const sp = new URL(request.url).searchParams;

	if (sp.get("error")) return fail(sp.get("error_description") || "The sign-in was cancelled.");

	const raw = request.headers.get("cookie")?.split(/;\s*/).find((c) => c.startsWith("ss_mail_oauth="))?.slice("ss_mail_oauth=".length);
	let cookie: string | undefined;
	try {
		cookie = raw ? decodeURIComponent(raw) : undefined;
	} catch {
		cookie = raw;
	}
	if (!cookie || !sp.get("state") || cookie !== `${p}:${sp.get("state")}`) return fail("That sign-in link has expired. Please try again.");

	const actor = await getActor();
	if (!actor?.isAdmin) return fail("Please sign in again.");

	const code = sp.get("code");
	if (!code) return fail("The provider did not return a sign-in code.");

	try {
		const tokens = await exchangeCode(p, origin, code);
		if (!tokens.refresh_token) return fail("The provider did not allow ongoing access. Remove this app from your account's connected apps and try again.");
		const email = emailFromIdToken(tokens.id_token);
		if (!email) return fail("Could not read which mailbox you signed in with.");

		// Prove both directions work before saving.
		const { imap, smtp } = oauthServers(p);
		const row = { imap_host: imap[0], imap_port: imap[1], imap_secure: imap[2], smtp_host: smtp[0], smtp_port: smtp[1], smtp_secure: smtp[2], username: email };
		try {
			await testImap(row, { accessToken: tokens.access_token! });
		} catch {
			return fail("The mailbox did not accept the sign-in over IMAP. Your organisation may have IMAP switched off for this account.");
		}
		await verifySmtp(row, { accessToken: tokens.access_token! }).catch(() => undefined); // sending is checked on first send

		const enc = encryptField(tokens.refresh_token);
		if (!enc) return fail("Could not secure the sign-in.");
		const { data, error } = await looseAdmin()
			.from("mail_accounts")
			.upsert({ owner_id: actor.id, label: email, email, password_enc: enc, protocol: "imap", auth_type: p, ...row }, { onConflict: "owner_id,email" })
			.select("id")
			.single();
		if (error || !data) return fail("Could not save the mailbox.");
		// The same grant also covers the calendar and Drive when everything was asked for: connect them too.
		const wantsAll = request.headers.get("cookie")?.includes("ss_mail_oauth_all=1") && p === "google";
		if (wantsAll) {
			const expires = (tokens as { expires_in?: number }).expires_in;
			await saveCalendarTokens(actor.id, { access_token: tokens.access_token ?? null, refresh_token: tokens.refresh_token, expiry_date: expires ? Date.now() + expires * 1000 : null }).catch(() => undefined);
			await saveDriveConnection(actor.id, tokens.refresh_token, email).catch(() => undefined);
		}
		await logAudit({ actorId: actor.id, actorEmail: actor.email, action: "mail.account_connected", targetType: "mailbox", targetId: data.id, targetLabel: email, details: { via: p } });
		return back("mail_connected=" + encodeURIComponent(email) + (wantsAll ? "&google_all=1" : ""));
	} catch (e) {
		return fail(e instanceof Error ? e.message : "Could not complete the sign-in.");
	}
}
