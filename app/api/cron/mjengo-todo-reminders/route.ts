import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { remindTodos } from "@/lib/mjengo/todo-reminders";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorised(req: Request): boolean {
	const secret = process.env.CRON_SECRET;
	if (!secret) return false;
	const given = req.headers.get("authorization") ?? "";
	const expected = `Bearer ${secret}`;
	return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

/** Manual trigger. The daily run is part of the escalate-stale-cases cron (one scheduled job covers both). */
export async function GET(req: Request) {
	if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	try {
		return NextResponse.json({ ok: true, ...(await remindTodos()) });
	} catch (e) {
		return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 500 });
	}
}
