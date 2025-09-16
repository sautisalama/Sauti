import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseCalendarService } from "@/lib/supabase-calendar";

export async function GET() {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json(
				{
					error: "Not authenticated",
					message: "Please sign in first",
				},
				{ status: 401 }
			);
		}

		// Check if user has calendar token
		const { data: profile } = await supabase
			.from("profiles")
			.select(
				"google_calendar_token, google_calendar_token_expiry, calendar_sync_enabled"
			)
			.eq("id", user.id)
			.single();

		if (!profile?.google_calendar_token) {
			return NextResponse.json({
				success: false,
				message: "No Google Calendar token found",
				action: "Connect to Google Calendar first",
				connectUrl: "/api/auth/google-calendar",
			});
		}

		// Check if token is expired
		const isExpired =
			profile.google_calendar_token_expiry &&
			new Date().getTime() > profile.google_calendar_token_expiry;

		if (isExpired) {
			return NextResponse.json({
				success: false,
				message: "Google Calendar token is expired",
				action: "Reconnect to Google Calendar",
				connectUrl: "/api/auth/google-calendar",
			});
		}

		// Test calendar access
		try {
			const calendars = await supabaseCalendarService.listCalendars(user.id);

			return NextResponse.json({
				success: true,
				message: "Calendar integration working perfectly!",
				data: {
					userId: user.id,
					calendarsCount: calendars?.length || 0,
					calendars:
						calendars?.map((cal) => ({
							id: cal.id,
							summary: cal.summary,
							primary: cal.primary,
							accessRole: cal.accessRole,
						})) || [],
					syncEnabled: profile.calendar_sync_enabled,
					tokenExpiry: profile.google_calendar_token_expiry
						? new Date(profile.google_calendar_token_expiry).toISOString()
						: null,
				},
			});
		} catch (calendarError) {
			return NextResponse.json(
				{
					success: false,
					message: "Calendar API access failed",
					error:
						calendarError instanceof Error ? calendarError.message : "Unknown error",
					action: "Check your Google Calendar API configuration",
				},
				{ status: 500 }
			);
		}
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				message: "Integration test failed",
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
