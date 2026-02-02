import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;
	const supabase = await createClient();

	try {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { status } = await request.json();

		const { error } = await supabase
			.from("matched_services")
			.update({ status })
			.eq("id", id)
			.eq("service_id", user.id);

		if (error) throw error;

		return NextResponse.json({ message: "Match status updated successfully" });
	} catch (error) {
		console.error("Error updating match status:", error);
		return NextResponse.json(
			{ error: "Failed to update match status" },
			{ status: 500 }
		);
	}
}
