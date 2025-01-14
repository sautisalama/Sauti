import { NextResponse } from "next/server";
import { REPORT_EMAIL_RECIPIENTS, REPORT_EMAIL_SENDER } from "@/lib/constants";

export async function POST() {
	try {
		const response = await fetch("https://send.api.mailtrap.io/api/send", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				"Api-Token": process.env.MAILTRAP_TOKEN!,
			},
			body: JSON.stringify({
				from: { name: "Sauti Salama", email: "notifications@sautisalama.org" },
				to: [{ email: "oliverwai9na@gmail.com" }],
				subject: "🌅 New Day at Sauti Salama",
				html: `
					<!doctype html>
					<html>
						<head>
							<meta http-equiv="Content-Type" content="text/html; charset=UTF-8">
						</head>
						<body style="font-family: sans-serif;">
							<div style="display: block; margin: auto; max-width: 600px;" class="main">
								<h1 style="font-size: 18px; font-weight: bold; margin-top: 20px">Good morning!</h1>
								<p>It's a new day to make a difference at Sauti Salama.</p>
								<p>Let's continue our mission to support and protect those in need.</p>
								<p>Have a productive day!</p>
								<p>Best regards,<br>Sauti Salama System</p>
							</div>
						</body>
					</html>
				`,
				category: "Daily Reminder"
			}),
		});

		if (!response.ok) throw new Error("Failed to send email");

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Failed to send reminder:", error);
		return NextResponse.json(
			{ error: "Failed to send reminder" },
			{ status: 500 }
		);
	}
}
