import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { BanRequest } from "@/types/admin-types";

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

		const { targetType, targetId, action, reason } = await request.json();

		if (!targetType || !targetId || !action) {
			return NextResponse.json(
				{ error: "Missing required fields" },
				{ status: 400 }
			);
		}

		const table = targetType === "user" ? "profiles" : "support_services";
		const ban = action === "ban";

		// Update ban status
		const updateData: any = {
			is_banned: ban,
			banned_at: ban ? new Date().toISOString() : null,
			banned_by: ban ? user.id : null,
			ban_reason: ban ? reason || "Banned by admin" : null,
		};

		if (targetType === "service") {
			updateData.is_active = !ban;
		}

		const { error: updateError } = await supabase
			.from(table)
			.update(updateData)
			.eq("id", targetId);

		if (updateError) throw updateError;

		// Log admin action
		const { error: logError } = await supabase.from("admin_actions").insert({
			admin_id: user.id,
			action_type: ban ? `ban_${targetType}` : `unban_${targetType}`,
			target_type: targetType,
			target_id: targetId,
			details: {
				ban_reason: reason,
				action: ban ? "banned" : "unbanned",
			},
		});

		if (logError) console.error("Error logging admin action:", logError);

		return NextResponse.json({
			success: true,
			message: `${targetType} ${ban ? "banned" : "unbanned"} successfully`,
		});
	} catch (error) {
		console.error("Error processing ban action:", error);
		return NextResponse.json(
			{ error: "Failed to process ban action" },
			{ status: 500 }
		);
	}
}
