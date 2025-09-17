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
		const { action, appointmentId } = body;

		// Calendar integration is now optional - return mock success
		switch (action) {
			case "create":
				return NextResponse.json({
					success: true,
					eventId: "mock-event-id",
					eventUrl: "#",
					note: "Calendar integration is optional - no event created",
				});

			case "update":
				return NextResponse.json({
					success: true,
					note: "Calendar integration is optional - no event updated",
				});

			case "delete":
				return NextResponse.json({
					success: true,
					note: "Calendar integration is optional - no event deleted",
				});

			case "sync_all":
				return NextResponse.json({
					success: true,
					synced: 0,
					failed: 0,
					results: [],
					note: "Calendar integration is optional - no events synced",
				});

			default:
				return NextResponse.json({ error: "Invalid action" }, { status: 400 });
		}
	} catch (error) {
		console.error("Calendar sync error:", error);
		return NextResponse.json(
			{ error: "Failed to sync with calendar" },
			{ status: 500 }
		);
	}
}
