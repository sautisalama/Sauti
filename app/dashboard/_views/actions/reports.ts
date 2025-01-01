import { createClient } from "@/utils/supabase/client";
import { Tables } from "@/types/db-schema";

// Step 1: Fetch basic reports for the user
export async function fetchUserReports(
	userId: string
): Promise<Tables<"reports">[]> {
	const supabase = createClient();

	try {
		const { data: reports, error } = await supabase
			.from("reports")
			.select("*")
			.eq("user_id", userId)
			.order("submission_timestamp", { ascending: false });

		if (error) {
			console.error("Error fetching reports:", error);
			throw error;
		}

		return reports || [];
	} catch (error) {
		console.error("Error in fetchUserReports:", error);
		throw error;
	}
}

// Delete report function
export async function deleteReport(reportId: string) {
	const supabase = createClient();

	try {
		const { error } = await supabase
			.from("reports")
			.delete()
			.eq("report_id", reportId);

		if (error) {
			throw error;
		}

		return true;
	} catch (error) {
		console.error("Error deleting report:", error);
		throw error;
	}
}
