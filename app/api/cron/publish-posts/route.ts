import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { publishDue } from "@/lib/mjengo/publishers";
import { remindEvents, shareMeetingNotes } from "@/lib/mjengo/meeting-jobs";
import { remindEntities } from "@/lib/mjengo/entity-reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(req: Request): boolean {
	const secret = process.env.CRON_SECRET;
	if (!secret) return false;
	const given = req.headers.get("authorization") ?? "";
	const expected = `Bearer ${secret}`;
	return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/** Publishes scheduled posts that are due. Call it every few minutes from any scheduler with the cron secret. */
export async function GET(req: Request) {
	if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	try {
		const posts = await publishDue();
		const reminders = await remindEvents().catch(() => ({ sent: 0 }));
		const notes = await shareMeetingNotes().catch(() => ({ done: 0 }));
		await remindEntities().catch(() => ({ sent: 0 }));
		return NextResponse.json({ ok: true, ...posts, reminders, notes });
	} catch (e) {
		return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 500 });
	}
}
