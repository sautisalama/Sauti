import { NextResponse } from "next/server";
import { getMailToAnswer } from "@/app/actions/mjengo-caughtup";
import { getMailboxes, listSorted, mailBootstrap } from "@/app/actions/mjengo-mail";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Everything the mail screen needs to open: the accounts and labels, each mailbox's folders, and the sorted inbox the
 * screen opens on. It is a plain request (not a server action) because actions run one after another in the browser,
 * and a slow mail server must never hold up the person's other clicks.
 */
export async function GET() {
	const boot = await mailBootstrap();
	if (!boot.ok) return NextResponse.json({ ok: false, error: boot.error }, { status: 403 });
	const accounts = boot.data.accounts;
	if (!accounts.length) return NextResponse.json({ ok: true, boot: boot.data, boxes: {}, target: null, list: null });
	const target = accounts.length > 1 ? "all" : accounts[0].id;
	const [boxes, list] = await Promise.all([
		Promise.all(accounts.map(async (a) => {
			const r = await getMailboxes(a.id).catch(() => null);
			return [a.id, r && r.ok ? r.data : null] as const;
		})),
		listSorted(target, "inbox", {}, 0, 40),
	]);
	// The Overview's "emails to answer" reads the same inbox, which is now held for a minute, so this is quick.
	const toAnswer = await getMailToAnswer().catch(() => null);
	return NextResponse.json({ ok: true, boot: boot.data, boxes: Object.fromEntries(boxes), target, list: list.ok ? list.data : null, toAnswer: toAnswer && toAnswer.ok ? toAnswer.data : null });
}
