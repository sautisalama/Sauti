import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST(request: Request) {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const { appointmentId, event } = body as {
			appointmentId: string;
			event: any;
		};

		// Calendar integration is now optional - return mock success
		const mockEventId = `mock-event-${Date.now()}`;

		return NextResponse.json({
			success: true,
			eventId: mockEventId,
			note: "Calendar integration is optional - no event created",
		});
	} catch (error) {
		console.error("Error creating calendar event:", error);
		return NextResponse.json(
			{ error: "Failed to create calendar event" },
			{ status: 500 }
		);
	}
}
