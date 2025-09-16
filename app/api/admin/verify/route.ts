import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { VerificationRequest } from "@/types/admin-types";

export async function POST(request: Request) {
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

		const { targetType, targetId, action, notes } = await request.json();

		if (!targetType || !targetId || !action) {
			return NextResponse.json(
				{ error: "Missing required fields" },
				{ status: 400 }
			);
		}

		const table = targetType === "user" ? "profiles" : "support_services";
		const verificationStatus = action === "verify" ? "verified" : "rejected";

		// Update verification status
		const updateData: any = {
			verification_status: verificationStatus,
			verification_notes: notes || null,
			verification_updated_at: new Date().toISOString(),
		};

		if (action === "verify") {
			updateData.verified_by = user.id;
			updateData.verified_at = new Date().toISOString();
			if (targetType === "service") {
				updateData.is_active = true;
			}
		}

		const { error: updateError } = await supabase
			.from(table)
			.update(updateData)
			.eq("id", targetId);

		if (updateError) throw updateError;

		// Log admin action
		const { error: logError } = await supabase.from("admin_actions").insert({
			admin_id: user.id,
			action_type:
				action === "verify" ? `verify_${targetType}` : `reject_${targetType}`,
			target_type: targetType,
			target_id: targetId,
			details: {
				verification_notes: notes,
				new_status: verificationStatus,
			},
		});

		if (logError) console.error("Error logging admin action:", logError);

		return NextResponse.json({
			success: true,
			message: `${targetType} ${
				action === "verify" ? "verified" : "rejected"
			} successfully`,
		});
	} catch (error) {
		console.error("Error processing verification:", error);
		return NextResponse.json(
			{ error: "Failed to process verification" },
			{ status: 500 }
		);
	}
}
