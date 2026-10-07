import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { REPORT_EMAIL_RECIPIENTS } from "@/lib/constants";
import { sendEmail } from "@/lib/notifications/email";

export const dynamic = "force-dynamic";

/**
 * Vercel Cron calls this with GET and `Authorization: Bearer $CRON_SECRET`.
 * (It used to be POST-only and unauthenticated: the cron never fired, and
 * anyone on the internet could trigger the email.) Fails closed if the secret
 * is not configured.
 */
function authorised(req: Request): boolean {
	const secret = process.env.CRON_SECRET;
	if (!secret) return false;
	const given = req.headers.get("authorization") ?? "";
	const expected = `Bearer ${secret}`;
	return given.length === expected.length && timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export async function GET(req: Request) {
	if (!authorised(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const html = `
		<div style="font-family:sans-serif;max-width:600px;margin:auto">
			<h1 style="font-size:18px;margin-top:20px">Good morning!</h1>
			<p>It's a new day to make a difference at Sauti Salama.</p>
			<p>Let's continue our mission to support and protect those in need.</p>
			<p>Best regards,<br>Sauti Salama System</p>
		</div>`;

	const result = await sendEmail(
		REPORT_EMAIL_RECIPIENTS.map((r) => r.email),
		"🌅 New Day at Sauti Salama",
		html,
		{ email: "notifications@sautisalama.org", name: "Sauti Salama" },
		{ category: "Daily Reminder" }
	);
	if (!result.success) {
		console.error("[cron] daily reminder failed:", result.error);
		return NextResponse.json({ ok: false, error: "Failed to send reminder" }, { status: 500 });
	}
	return NextResponse.json({ ok: true });
}
