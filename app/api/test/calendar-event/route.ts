import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

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

		// Calendar integration is now optional - return mock success
		return NextResponse.json({
			success: true,
			message: "Calendar integration is optional - no event created",
			event: {
				id: "mock-event-id",
				summary: "Sauti Salama - Test Appointment (Mock)",
				htmlLink: "#",
				start: {
					dateTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
					timeZone: "Africa/Nairobi",
				},
				end: {
					dateTime: new Date(
						Date.now() + 24 * 60 * 60 * 1000 + 60 * 60 * 1000
					).toISOString(),
					timeZone: "Africa/Nairobi",
				},
				attendees: user.email ? [{ email: user.email }] : [],
			},
			note: "Calendar integration is optional and can be enabled later",
		});
	} catch (error) {
		return NextResponse.json(
			{
				success: false,
				message: "Failed to create test calendar event",
				error: error instanceof Error ? error.message : "Unknown error",
				action: "Calendar integration is optional",
			},
			{ status: 500 }
		);
	}
}
