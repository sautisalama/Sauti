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
			return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
		}

		// Test calendar access
		const calendars = await supabaseCalendarService.listCalendars(user.id);

		return NextResponse.json({
			success: true,
			message: "Calendar access working",
			calendarsCount: calendars?.length || 0,
			userId: user.id,
		});
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
				message:
					"Calendar access failed - may need to re-authenticate with calendar scopes",
			},
			{ status: 500 }
		);
	}
}
