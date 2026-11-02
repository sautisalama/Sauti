import { NextResponse } from "next/server";
import { simpleParser } from "mailparser";
import { getActor } from "@/lib/access/super-admin";
import { fetchSource, loadAccount } from "@/lib/mail/client";

export const runtime = "nodejs";
export const maxDuration = 60;

/** Download one attachment of one message from a mailbox the signed-in admin connected. */
export async function GET(request: Request) {
	const actor = await getActor();
	if (!actor?.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

	const sp = new URL(request.url).searchParams;
	const account = sp.get("account") ?? "";
	const mailbox = sp.get("mailbox") ?? "";
	const uid = Number(sp.get("uid"));
	const index = Number(sp.get("i"));
	if (!account || !mailbox || !Number.isInteger(uid) || !Number.isInteger(index) || index < 0) return NextResponse.json({ error: "Bad request" }, { status: 400 });

	try {
		const acct = await loadAccount(account, actor.id);
		const parsed = await simpleParser(await fetchSource(acct, mailbox, uid));
		const att = parsed?.attachments?.[index];
		if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 });
		const name = encodeURIComponent(att.filename ?? `attachment-${index + 1}`);
		// A preview is shown in place, but only for types a browser shows safely; anything else is still a download.
		const type = (att.contentType || "application/octet-stream").toLowerCase().split(";")[0].trim();
		const inline = sp.get("inline") === "1" && /^(image\/(png|jpe?g|gif|webp|avif|bmp)|application\/pdf|text\/(plain|csv|markdown)|video\/(mp4|webm)|audio\/(mpeg|mp4|wav|ogg|webm))$/.test(type);
		return new Response(new Uint8Array(att.content), {
			headers: {
				"Content-Type": inline ? type : att.contentType || "application/octet-stream",
				"Content-Disposition": `${inline ? "inline" : "attachment"}; filename*=UTF-8''${name}`,
				...(inline ? { "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; media-src 'self'; style-src 'unsafe-inline'; sandbox" } : {}),
				"X-Content-Type-Options": "nosniff",
				"Cache-Control": "private, no-store",
			},
		});
	} catch {
		return NextResponse.json({ error: "Could not fetch the attachment" }, { status: 502 });
	}
}
