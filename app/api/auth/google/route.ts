import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { getGoogleAuthUrl, isGoogleCalendarConfigured } from "@/lib/google-calendar-oauth";

/**
 * GET /api/auth/google
 * Redirects the user to Google's OAuth consent screen for Calendar access.
 */
export async function GET() {
	try {
		// Check if Google Calendar is configured
		if (!isGoogleCalendarConfigured()) {
			return NextResponse.json(
				{
					error: "Google Calendar is not configured",
					message:
						"Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET environment variables. See docs/GOOGLE_CALENDAR_INTEGRATION.md for setup instructions.",
				},
				{ status: 503 }
			);
		}

		// Verify user is authenticated
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.redirect(
				new URL("/signin", process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000")
			);
		}

		// Generate OAuth URL with user ID as state for CSRF protection
		const state = Buffer.from(
			JSON.stringify({ userId: user.id, timestamp: Date.now() })
		).toString("base64url");

		const authUrl = getGoogleAuthUrl(state);
		return NextResponse.redirect(authUrl);
	} catch (error) {
		console.error("Google OAuth initiation error:", error);
		const redirectUrl = new URL(
			"/dashboard/profile?section=settings&calendar_error=initiation_failed",
			process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"
		);
		return NextResponse.redirect(redirectUrl);
	}
}
