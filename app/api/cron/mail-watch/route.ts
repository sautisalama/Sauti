import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { looseAdmin } from "@/lib/loose-db";
import { newMailFor } from "@/lib/mail/watch";
import { sendPushToUser } from "@/lib/notifications/push";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(req: Request): boolean {
	const secret = process.env.CRON_SECRET;
	if (!secret) return false;
	const given = req.headers.get("authorization") ?? "";
	const expected = `Bearer ${secret}`;
	return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/**
 * Run every few minutes by a scheduler. For each person with mail alerts on, finds mail that arrived since the last
 * look and pushes it to their devices, so it shows on the desktop even with the app closed. A person who has the
 * mail page open is skipped: their page shows the alert itself.
 */
export async function GET(req: Request) {
	if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const started = Date.now();
	const db = looseAdmin();
	const { data: rows } = await db.from("mail_accounts").select("owner_id").eq("notify", true);
	const owners = [...new Set(((rows ?? []) as { owner_id: string }[]).map((r) => r.owner_id))];
	const { data: seen } = await db.from("mail_preferences").select("owner_id, app_seen_at").in("owner_id", owners.length ? owners : ["00000000-0000-0000-0000-000000000000"]);
	const open = new Set(((seen ?? []) as { owner_id: string; app_seen_at: string | null }[]).filter((s) => s.app_seen_at && Date.now() - Date.parse(s.app_seen_at) < 3 * 60_000).map((s) => s.owner_id));
	let sent = 0;
	let checked = 0;
	for (const owner of owners) {
		if (open.has(owner)) continue;
		if (Date.now() - started > 45_000) break;
		checked++;
		const items = await newMailFor(owner);
		if (!items.length) continue;
		const many = items.length > 3;
		const list = many ? [{ title: `${items.length} new emails`, body: [...new Set(items.map((i) => i.from))].slice(0, 3).join(", "), tag: "mail-new" }] : items.map((i) => ({ title: i.from, body: `${i.subject}\n${i.accountEmail}`, tag: `mail-${i.account}-${i.uid}` }));
		for (const n of list) sent += (await sendPushToUser(owner, { ...n, url: "/dashboard/mjengo/mail", force: true })).sent;
	}
	return NextResponse.json({ ok: true, checked, sent });
}
