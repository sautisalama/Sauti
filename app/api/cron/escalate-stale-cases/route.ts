import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { escalateStaleCases } from "@/lib/cases/escalation";
import { remindTodos } from "@/lib/mjengo/todo-reminders";
import { remindPosts } from "@/lib/mjengo/post-reminders";
import { publishDue } from "@/lib/mjengo/publishers";
import { purgeExpired } from "@/lib/vault/trash";
import { nudgeProviders } from "@/lib/cases/nudges";
import { flushVerificationAlerts } from "@/lib/notifications/verification-alerts";

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
		const base = appUrl.startsWith("http") ? appUrl : `https://${appUrl}`;
		// Nudge providers first (half the window), then escalate what is a full window old.
		const nudges = await nudgeProviders(base).catch((e) => ({ waiting: 0, sent: 0, error: e instanceof Error ? e.message : "failed" }));
		const result = await escalateStaleCases(base);
		// Backstop: send any verification submissions the immediate path missed.
		const verification = await flushVerificationAlerts(base).catch((e) => ({ sent: 0, error: e instanceof Error ? e.message : "failed" }));
		const todos = await remindTodos().catch((e) => ({ tasks: 0, sent: 0, error: e instanceof Error ? e.message : "failed" }));
		const posts = await remindPosts().catch((e) => ({ posts: 0, sent: 0, error: e instanceof Error ? e.message : "failed" }));
		const published = await publishDue().catch((e) => ({ due: 0, posted: 0, error: e instanceof Error ? e.message : "failed" }));
		const trash = await purgeExpired().then((removed) => ({ removed })).catch((e) => ({ removed: 0, error: e instanceof Error ? e.message : "failed" }));
		return NextResponse.json({ ok: true, ...result, nudges, verification, todos, posts, published, trash });
	} catch (e) {
		console.error("[cron] escalate-stale-cases failed:", e);
		return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : "failed" }, { status: 500 });
	}
}
