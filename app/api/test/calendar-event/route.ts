import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { supabaseCalendarService } from "@/lib/supabase-calendar";

export async function POST() {
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

		// Create a test calendar event
		const testEvent = {
			summary: "Sauti Salama - Test Appointment",
			description:
				"This is a test appointment created by Sauti Salama integration",
			start: {
				dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
				timeZone: "Africa/Nairobi",
			},
			end: {
				dateTime: new Date(
					Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000
				).toISOString(), // Tomorrow + 1 hour
				timeZone: "Africa/Nairobi",
			},
			attendees: user.email ? [{ email: user.email }] : [],
		};

		const event = await supabaseCalendarService.createEvent(user.id, testEvent);

		return NextResponse.json({
			success: true,
			message: "Test calendar event created successfully!",
			event: {
				id: event.id,
				summary: event.summary,
				htmlLink: event.htmlLink,
				start: event.start,
				end: event.end,
				attendees: event.attendees,
			},
		});
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				message: "Failed to create test calendar event",
				error: error instanceof Error ? error.message : "Unknown error",
				action: "Check your Google Calendar permissions and try again",
			},
			{ status: 500 }
		);
	}
}
