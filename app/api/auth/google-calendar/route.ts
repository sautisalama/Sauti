import { NextResponse } from "next/server";
import { google } from "googleapis";

export async function GET() {
	const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
	const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
	const appUrl = process.env.NEXT_PUBLIC_APP_URL;

	if (!clientId || !clientSecret || !appUrl) {
		console.error("Missing Google Calendar OAuth environment variables:", {
			clientId: !!clientId,
			clientSecret: !!clientSecret,
			appUrl: !!appUrl,
		});
		return NextResponse.json(
			{ error: "Google Calendar OAuth not configured" },
			{ status: 500 }
		);
	}

	const oauth2Client = new google.auth.OAuth2(
		clientId,
		clientSecret,
		`${appUrl}/api/auth/google-calendar/callback`
	);

	const scopes = [
		"https://www.googleapis.com/auth/calendar.events",
		"https://www.googleapis.com/auth/calendar.readonly",
		"https://www.googleapis.com/auth/calendar.calendarlist.readonly",
		"https://www.googleapis.com/auth/calendar.freebusy",
	];

	const url = oauth2Client.generateAuthUrl({
		access_type: "offline",
		scope: scopes,
		// Try to use existing Google session first, fallback to account selection if needed
		prompt: "consent", // This will use existing session if available, otherwise prompt for consent
	});

	return NextResponse.redirect(url);
}
