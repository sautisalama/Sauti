import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
		}

		// Calendar integration is now optional - return success without requiring tokens
		return NextResponse.json({
			success: true,
			message: "Google Calendar integration available (optional)",
			calendarsCount: 0,
			userId: user.id,
			syncEnabled: false,
			note: "Calendar integration is optional and can be enabled later",
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
