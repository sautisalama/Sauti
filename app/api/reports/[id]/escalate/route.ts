import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { matchReportWithServices } from "@/app/actions/match-services";

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	try {
        const resolvedParams = await params;
		const reportId = resolvedParams.id;
		const supabase = await createClient();

		// Check if user is authorized for this report
		const { data: { user } } = await supabase.auth.getUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { data: report, error: fetchError } = await supabase
			.from("reports")
			.select("user_id")
			.eq("report_id", reportId)
			.single();

		if (fetchError || !report) {
			return NextResponse.json({ error: "Report not found" }, { status: 404 });
		}

		if (report.user_id !== user.id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
		}

		// Update report
		const { error: updateError } = await supabase
			.from("reports")
			.update({ record_only: false })
			.eq("report_id", reportId);

		if (updateError) throw updateError;

		// Trigger matching
		await matchReportWithServices(reportId);

		return NextResponse.json({ message: "Report escalated successfully" });
	} catch (error) {
		console.error("Escalation API error:", error);
		return NextResponse.json(
			{ error: "Failed to escalate report", details: error instanceof Error ? error.message : String(error) },
			{ status: 500 }
		);
	}
}
