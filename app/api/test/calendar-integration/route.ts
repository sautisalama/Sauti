import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

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

		// Calendar integration is now optional - return success without requiring tokens
		return NextResponse.json({
			success: true,
			message: "Calendar integration available (optional)",
			data: {
				userId: user.id,
				calendarsCount: 0,
				calendars: [],
				syncEnabled: false,
				tokenExpiry: null,
				note: "Calendar integration is optional and can be enabled later",
			},
		});
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
