import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(
	request: Request,
	{ params }: { params: { id: string } }
) {
	const supabase = await createClient();

	try {
		const {
			data: { session },
		} = await supabase.auth.getSession();
		if (!session) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		// Verify ownership before deletion
		const { data: report } = await supabase
			.from("reports")
			.select("user_id")
			.eq("report_id", params.id)
			.single();

		if (!report || report.user_id !== session.user.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
		}

		const { error } = await supabase
			.from("reports")
			.delete()
			.eq("report_id", params.id);

		if (error) throw error;

		return NextResponse.json({ message: "Report deleted successfully" });
	} catch (error) {
		console.error("Error deleting report:", error);
		return NextResponse.json(
			{ error: "Failed to delete report" },
			{ status: 500 }
		);
	}
}
