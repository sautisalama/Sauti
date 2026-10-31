import { NextResponse, type NextRequest } from "next/server";
import { getMessageDetail, getMessageDetails, getThread } from "@/app/actions/mjengo-mail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Reads for the mail screen as plain requests. Server actions run one after another in the browser, so a
 * click on a message used to wait behind the bodies being prefetched and the previous message's thread.
 * Requests run side by side, so opening what the person picked is never queued behind background work.
 */
export async function GET(req: NextRequest) {
	const p = req.nextUrl.searchParams;
	const op = p.get("op");
	const account = p.get("account");
	const mailbox = p.get("mailbox");
	if (!op || !account || !mailbox) return NextResponse.json({ ok: false, error: "Missing parameters." }, { status: 400 });

	let result;
	if (op === "detail") {
		const uid = Number(p.get("uid"));
		if (!Number.isInteger(uid)) return NextResponse.json({ ok: false, error: "Bad message id." }, { status: 400 });
		result = await getMessageDetail(account, mailbox, uid, p.get("images") !== "0");
	} else if (op === "details") {
		const uids = (p.get("uids") ?? "").split(",").map(Number).filter(Number.isInteger).slice(0, 12);
		result = await getMessageDetails(account, mailbox, uids);
	} else if (op === "thread") {
		result = await getThread(account, mailbox, p.get("subject") ?? "");
	} else {
		return NextResponse.json({ ok: false, error: "Unknown request." }, { status: 400 });
	}
	return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
}
