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
		return new Response(new Uint8Array(att.content), {
			headers: {
				"Content-Type": att.contentType || "application/octet-stream",
				"Content-Disposition": `attachment; filename*=UTF-8''${name}`,
				"X-Content-Type-Options": "nosniff",
				"Cache-Control": "private, no-store",
			},
		});
	} catch {
		return NextResponse.json({ error: "Could not fetch the attachment" }, { status: 502 });
	}
}
