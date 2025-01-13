import { createClient } from "@/utils/supabase/server";
import { matchReportWithServices } from "./match-services";

export async function checkUnmatchedReports() {
	const supabase = await createClient();

	try {
		// Fetch all unmatched reports
		const { data: unmatchedReports, error } = await supabase
			.from("reports")
			.select("report_id")
			.eq("ismatched", false);

		if (error) throw error;

		if (!unmatchedReports || unmatchedReports.length === 0) {
			return;
		}

		// Try to match each unmatched report
		const matchPromises = unmatchedReports.map((report) =>
			matchReportWithServices(report.report_id)
		);

		await Promise.all(matchPromises);
	} catch (error) {
		console.error("Error checking unmatched reports:", error);
		throw error;
	}
}
