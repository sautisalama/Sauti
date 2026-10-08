import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin-client";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
	try {
		const { email } = await request.json();
		
		if (!email) {
			return NextResponse.json({ error: "Email is required" }, { status: 400 });
		}

		const address = String(email).trim().toLowerCase();
		if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(address) || address.endsWith("@anon.sautisalama.org")) {
			return NextResponse.json({ error: "Please enter a valid email address." }, { status: 400 });
		}

		const supabase = await createClient();
		
		// Get current user
		const { data: { user }, error: userError } = await supabase.auth.getUser();
		
		if (userError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Only an anonymous account can be converted, and the address must not belong to someone else.
		const admin = createAdminClient();
		const { data: me } = await admin.from("profiles").select("is_anonymous").eq("id", user.id).maybeSingle();
		if (!me?.is_anonymous) return NextResponse.json({ error: "This account is already a full account." }, { status: 409 });
		const { data: taken } = await admin.from("profiles").select("id").ilike("email", address).neq("id", user.id).maybeSingle();
		if (taken) return NextResponse.json({ error: "That email is already used by another account." }, { status: 409 });

		// Update profile status
		const { error: profileError } = await supabase
			.from("profiles")
			.update({
				is_anonymous: false,
				user_type: "survivor", // Ensure they remain as survivor
				email: address, // Update email in profile too
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
