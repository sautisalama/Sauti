import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { googleCalendarAuth } from "@/lib/google-calendar-auth";

export async function GET() {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
		}

		// Check if user has calendar tokens
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
				message: "No calendar tokens found. User needs to connect calendar first.",
				connectUrl: "/api/auth/google-calendar",
			});
		}

		// Test calendar access
		const calendar = await googleCalendarAuth.createCalendarClient(user.id);
		const calendars = await calendar.calendarList.list();

		return NextResponse.json({
			success: true,
			message: "Google Calendar integration working",
			calendarsCount: calendars.data.items?.length || 0,
			userId: user.id,
			syncEnabled: profile.calendar_sync_enabled,
		});
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				message: "Google Calendar test failed",
			},
			{ status: 500 }
		);
	}
}
