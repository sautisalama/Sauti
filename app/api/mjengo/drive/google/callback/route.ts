import { NextResponse } from "next/server";
import { getActor } from "@/lib/access/super-admin";
import { originOf } from "@/lib/mail/origin";
import { looseAdmin } from "@/lib/loose-db";
import { logAudit } from "@/lib/access/audit";
import { DRIVE_BUCKET, DRIVE_MAX_BYTES, resolveDriveSource, safeReturn } from "@/lib/mjengo-drive";
import { ensureRootFolder, saveDriveConnection, uploadFile } from "@/lib/google-drive";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Finish "Save to Google Drive" / "Connect Google Drive": keep the connection, then copy the file if one was chosen. */
export async function GET(request: Request) {
	const origin = originOf(request);
	let ret = "/dashboard/mjengo/vault";
	const done = (q: string) => {
		const r = NextResponse.redirect(`${origin}${ret}?${q}`);
		r.cookies.delete({ name: "ss_drive_oauth", path: "/api/mjengo/drive" });
		return r;
	};
	const fail = (m: string) => done("drive_error=" + encodeURIComponent(m));

	const raw = request.headers.get("cookie")?.split(/;\s*/).find((c) => c.startsWith("ss_drive_oauth="))?.slice("ss_drive_oauth=".length);
	let pending: { s: string; k: string; i: string; r: string } | null = null;
	try { pending = raw ? JSON.parse(Buffer.from(decodeURIComponent(raw), "base64url").toString()) : null; } catch { pending = null; }
	if (pending) ret = safeReturn(pending.r);

	const sp = new URL(request.url).searchParams;
	if (sp.get("error")) return fail(sp.get("error") === "access_denied" ? "Connecting Google Drive was cancelled." : sp.get("error_description") || "The sign-in was cancelled.");
	if (!pending || pending.s !== sp.get("state")) return fail("That sign-in link has expired. Please try again.");

	const actor = await getActor();
	if (!actor?.isAdmin) return fail("Please sign in again.");
	const code = sp.get("code");
	if (!code) return fail("Google did not return a sign-in code.");

	try {
		const tok = await fetch("https://oauth2.googleapis.com/token", {
			method: "POST",
			headers: { "Content-Type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				code,
				client_id: process.env.GOOGLE_CLIENT_ID!,
				client_secret: process.env.GOOGLE_CLIENT_SECRET!,
				redirect_uri: `${origin}/api/mjengo/drive/google/callback`,
				grant_type: "authorization_code",
			}),
			signal: AbortSignal.timeout(20_000),
		});
		const t = (await tok.json()) as { access_token?: string; refresh_token?: string; error_description?: string };
		if (!tok.ok || !t.access_token) return fail(t.error_description || "Google refused the request.");

		let email: string | null = null;
		try {
			const u = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { Authorization: `Bearer ${t.access_token}` }, signal: AbortSignal.timeout(10_000) });
			email = u.ok ? ((await u.json()) as { email?: string }).email ?? null : null;
		} catch { /* the email is only a label */ }
		if (t.refresh_token) await saveDriveConnection(actor.id, t.refresh_token, email);

		if (pending.k === "connect") {
			await logAudit({ actorId: actor.id, actorEmail: actor.email, action: "drive.connected", targetType: "drive", targetLabel: email ?? undefined });
			return done("drive=connected");
		}

		const src = await resolveDriveSource(actor, pending.k, pending.i);
		const { data: blob, error: dlErr } = await looseAdmin().storage.from(DRIVE_BUCKET).download(src.path);
		if (dlErr || !blob) return fail("Could not read the file from the vault.");
		if (blob.size > DRIVE_MAX_BYTES) return fail("That file is too large to copy to Google Drive from here.");

		const folder = await ensureRootFolder(t.access_token);
		const mime = src.mime || blob.type || "application/octet-stream";
		const file = await uploadFile(t.access_token, src.name, new Uint8Array(await blob.arrayBuffer()), mime, folder);

		await looseAdmin().from(src.kind === "vault" ? "vault_files" : "mjengo_documents").update({ drive_file_id: file.id, drive_link: file.link, drive_saved_at: new Date().toISOString() }).eq("id", src.id);
		await logAudit({ actorId: actor.id, actorEmail: actor.email, action: "vault.exported_to_drive", targetType: src.kind === "vault" ? "vault_file" : "document", targetId: src.id, targetLabel: src.name });
		const q = new URLSearchParams({ drive: "ok", name: src.name });
		if (file.link) q.set("link", file.link);
		return done(q.toString());
	} catch (e) {
		return fail(e instanceof Error ? e.message : "Could not save to Google Drive.");
	}
}
