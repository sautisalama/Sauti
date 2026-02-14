import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { exchangeCodeForTokens } from "@/lib/google-calendar-oauth";

/**
 * GET /api/auth/google/callback
 * Handles the OAuth redirect from Google. Exchanges the auth code for tokens
 * and stores them in the user's profile.
 */
export async function GET(request: Request) {
	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	const error = url.searchParams.get("error");
	const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

	// Handle user denial or error
	if (error) {
		console.error("Google OAuth error:", error);
		return NextResponse.redirect(
			new URL(
				`/dashboard/profile?section=calendar&calendar_error=${encodeURIComponent(error)}`,
				appUrl
			)
		);
	}

	if (!code || !state) {
		return NextResponse.redirect(
			new URL(
				"/dashboard/profile?section=calendar&calendar_error=missing_params",
				appUrl
			)
		);
	}

	try {
		// Validate state parameter
		let stateData: { userId: string; timestamp: number };
		try {
			stateData = JSON.parse(Buffer.from(state, "base64url").toString());
		} catch {
			return NextResponse.redirect(
				new URL(
					"/dashboard/profile?section=calendar&calendar_error=invalid_state",
					appUrl
				)
			);
		}

		// Verify the state is recent (within 10 minutes)
		if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
			return NextResponse.redirect(
				new URL(
					"/dashboard/profile?section=calendar&calendar_error=expired_state",
					appUrl
				)
			);
		}

		// Verify authenticated user matches state
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user || user.id !== stateData.userId) {
			return NextResponse.redirect(
				new URL(
					"/dashboard/profile?section=calendar&calendar_error=user_mismatch",
					appUrl
				)
			);
		}

		// Exchange code for tokens
		const tokens = await exchangeCodeForTokens(code);

		// Store tokens in the user's profile
		// Note: In production, encrypt tokens before storage
		const { error: updateError } = await supabase
			.from("profiles")
			.update({
				google_calendar_token: tokens.access_token,
				google_calendar_refresh_token: tokens.refresh_token || null,
				google_calendar_token_expiry: tokens.expiry_date || null,
				calendar_sync_enabled: true,
			})
			.eq("id", user.id);

		if (updateError) {
			console.error("Error storing calendar tokens:", updateError);
			// If the column doesn't exist, handle gracefully
			if (updateError.message?.includes("column")) {
				return NextResponse.redirect(
					new URL(
						"/dashboard/profile?section=calendar&calendar_error=db_column_missing",
						appUrl
					)
				);
			}
			return NextResponse.redirect(
				new URL(
					"/dashboard/profile?section=calendar&calendar_error=storage_failed",
					appUrl
				)
			);
		}

		// Success — redirect back to settings
		return NextResponse.redirect(
			new URL(
				"/dashboard/profile?section=settings&calendar_success=true",
				appUrl
			)
		);
	} catch (err) {
		console.error("Google OAuth callback error:", err);
		return NextResponse.redirect(
			new URL(
				"/dashboard/profile?section=settings&calendar_error=token_exchange_failed",
				appUrl
			)
		);
	}
}
