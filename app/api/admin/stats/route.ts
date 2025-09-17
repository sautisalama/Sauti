import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
	try {
		const supabase = await createClient();

		// Check if user is admin
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { data: profile } = await supabase
			.from("profiles")
			.select("is_admin")
			.eq("id", user.id)
			.single();

		if (!profile?.is_admin) {
			return NextResponse.json({ error: "Forbidden" }, { status: 403 });
		}

		// Get dashboard statistics
		const { data: stats, error } = await supabase
			.from("admin_dashboard_stats")
			.select("*")
			.single();

		if (error) throw error;

		return NextResponse.json({ success: true, data: stats });
	} catch (error) {
		console.error("Error fetching admin stats:", error);
		return NextResponse.json(
			{ error: "Failed to fetch admin statistics" },
			{ status: 500 }
		);
	}
}
