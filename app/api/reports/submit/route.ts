import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";
import { matchReportWithServices } from "@/app/actions/match-services";

export async function POST(request: Request) {
	const supabase = await createClient();

	try {
		const data = await request.json();

		// Insert the report
		const { data: insertedReport, error } = await supabase
			.from("reports")
			.insert([data])
			.select()
			.single();

		if (error) throw error;

		// Match the report with services
		await matchReportWithServices(insertedReport.report_id);

		return NextResponse.json({
			message: "Report submitted and matched successfully",
			report: insertedReport,
		});
	} catch (error) {
		console.error("Error in report submission:", error);
		return NextResponse.json(
			{ error: "Failed to submit report" },
			{ status: 500 }
		);
	}
}
