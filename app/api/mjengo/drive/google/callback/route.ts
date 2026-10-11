import { NextResponse } from "next/server";
import { getActor } from "@/lib/access/super-admin";
import { originOf } from "@/lib/mail/origin";
import { looseAdmin } from "@/lib/loose-db";
import { logAudit } from "@/lib/access/audit";
import { DRIVE_BUCKET, DRIVE_FOLDER_NAME, DRIVE_MAX_BYTES, resolveDriveSource, safeReturn } from "@/lib/mjengo-drive";

export const runtime = "nodejs";
export const maxDuration = 60;

const API = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3/files";

/** Finish "Save to Google Drive": copy the file into a "Sauti Salama" folder in the person's Drive. */
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
	if (sp.get("error")) return fail(sp.get("error") === "access_denied" ? "Saving to Google Drive was cancelled." : sp.get("error_description") || "The sign-in was cancelled.");
	if (!pending || pending.s !== sp.get("state")) return fail("That sign-in link has expired. Please try again.");

	const actor = await getActor();
	if (!actor?.isAdmin) return fail("Please sign in again.");
	const code = sp.get("code");
	if (!code) return fail("Google did not return a sign-in code.");

	try {
		const src = await resolveDriveSource(actor, pending.k, pending.i);

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
		const t = (await tok.json()) as { access_token?: string; error_description?: string };
		if (!tok.ok || !t.access_token) return fail(t.error_description || "Google refused the request.");
		const auth = { Authorization: `Bearer ${t.access_token}` };

		const driveError = async (res: Response) => {
			const j = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
			const msg = j.error?.message ?? "";
			if (/has not been used|disabled|accessNotConfigured/i.test(msg)) return "The Google Drive API is not switched on for this project yet.";
			if (/storage quota/i.test(msg)) return "Your Google Drive is full.";
			return msg || "Google Drive did not accept the file.";
		};

		// The file itself.
		const { data: blob, error: dlErr } = await looseAdmin().storage.from(DRIVE_BUCKET).download(src.path);
		if (dlErr || !blob) return fail("Could not read the file from the vault.");
		if (blob.size > DRIVE_MAX_BYTES) return fail("That file is too large to copy to Google Drive from here.");

		// A "Sauti Salama" folder. With drive.file only folders this app made are visible, so this is ours.
		let folderId: string | undefined;
		const found = await fetch(`${API}/files?` + new URLSearchParams({
			q: `name='${DRIVE_FOLDER_NAME}' and mimeType='application/vnd.google-apps.folder' and trashed=false`,
			fields: "files(id)", pageSize: "1", spaces: "drive",
		}), { headers: auth, signal: AbortSignal.timeout(20_000) });
		if (!found.ok) return fail(await driveError(found));
		folderId = ((await found.json()) as { files?: { id: string }[] }).files?.[0]?.id;
		if (!folderId) {
			const made = await fetch(`${API}/files?fields=id`, {
				method: "POST",
				headers: { ...auth, "Content-Type": "application/json" },
				body: JSON.stringify({ name: DRIVE_FOLDER_NAME, mimeType: "application/vnd.google-apps.folder" }),
				signal: AbortSignal.timeout(20_000),
			});
			if (!made.ok) return fail(await driveError(made));
			folderId = ((await made.json()) as { id: string }).id;
		}

		// Resumable upload in one request.
		const mime = src.mime || blob.type || "application/octet-stream";
		const start = await fetch(`${UPLOAD}?uploadType=resumable&fields=id,name,webViewLink`, {
			method: "POST",
			headers: { ...auth, "Content-Type": "application/json; charset=UTF-8", "X-Upload-Content-Type": mime, "X-Upload-Content-Length": String(blob.size) },
			body: JSON.stringify({ name: src.name, parents: [folderId] }),
			signal: AbortSignal.timeout(20_000),
		});
		const session = start.headers.get("location");
		if (!start.ok || !session) return fail(await driveError(start));
		const up = await fetch(session, {
			method: "PUT",
			headers: { "Content-Type": mime, "Content-Length": String(blob.size) },
			body: Buffer.from(await blob.arrayBuffer()),
			signal: AbortSignal.timeout(45_000),
		});
		if (!up.ok) return fail(await driveError(up));
		const file = (await up.json()) as { id: string; name: string; webViewLink?: string };

		const mark = { drive_file_id: file.id, drive_link: file.webViewLink ?? null, drive_saved_at: new Date().toISOString() };
		await looseAdmin().from(src.kind === 'vault' ? 'vault_files' : 'mjengo_documents').update(mark).eq('id', src.id);
		await logAudit({ actorId: actor.id, actorEmail: actor.email, action: 'vault.exported_to_drive', targetType: src.kind === 'vault' ? 'vault_file' : 'document', targetId: src.id, targetLabel: src.name });
		const q = new URLSearchParams({ drive: "ok", name: file.name });
		if (file.webViewLink) q.set("link", file.webViewLink);
		return done(q.toString());
	} catch (e) {
		return fail(e instanceof Error ? e.message : "Could not save to Google Drive.");
	}
}
