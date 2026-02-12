import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
	try {
		const { email } = await request.json();
		
		if (!email) {
			return NextResponse.json({ error: "Email is required" }, { status: 400 });
		}

		console.log("Upgrading account to permanent for email:", email);
		
		const supabase = await createClient();
		
		// Get current user
		const { data: { user }, error: userError } = await supabase.auth.getUser();
		
		if (userError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Update profile status
		const { error: profileError } = await supabase
			.from("profiles")
			.update({
				is_anonymous: false,
				user_type: "survivor", // Ensure they remain as survivor
				email: email, // Update email in profile too
				updated_at: new Date().toISOString()
			})
			.eq("id", user.id);

		if (profileError) {
			console.error("Profile update error:", profileError);
			return NextResponse.json({ error: "Failed to update profile" }, { status: 500 });
		}

		// Optionally delete from anonymous_accounts table if you want to clean up
		// await supabase.from("anonymous_accounts").delete().eq("user_id", user.id);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Upgrade error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
