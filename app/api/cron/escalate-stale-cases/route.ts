import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { escalateStaleCases } from "@/lib/cases/escalation";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Vercel Cron sends `Authorization: Bearer $CRON_SECRET`. Fail closed if it isn't configured. */
function authorised(req: Request): boolean {
	const secret = process.env.CRON_SECRET;
	if (!secret) return false;
	const given = req.headers.get("authorization") ?? "";
	const expected = `Bearer ${secret}`;
	return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export async function GET(req: Request) {
	if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	try {
		const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://sautisalama.org").replace(/\/$/, "");
		const result = await escalateStaleCases(appUrl.startsWith("http") ? appUrl : `https://${appUrl}`);
		return NextResponse.json({ ok: true, ...result });
	} catch (e) {
		console.error("[cron] escalate-stale-cases failed:", e);
		return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 500 });
	}
}
