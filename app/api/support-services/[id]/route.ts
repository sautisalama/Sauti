import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(
	request: Request,
	{ params }: { params: { id: string } }
) {
	const supabase = await createClient();

	try {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Verify ownership before deletion
		const { data: service } = await supabase
			.from("support_services")
			.select("user_id")
			.eq("id", params.id)
			.single();

		if (!service || service.user_id !== user.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
		}

		const { error } = await supabase
			.from("support_services")
			.delete()
			.eq("id", params.id);

		if (error) throw error;

		return NextResponse.json({ message: "Service deleted successfully" });
	} catch (error) {
		console.error("Error deleting service:", error);
		return NextResponse.json(
			{ error: "Failed to delete service" },
			{ status: 500 }
		);
	}
}
