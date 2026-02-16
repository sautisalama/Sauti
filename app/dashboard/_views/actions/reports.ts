"use server";

import { createClient } from "@/utils/supabase/server";
import { Tables } from "@/types/db-schema";

// Step 1: Fetch basic reports for the user
export async function fetchUserReports(
	userId: string
): Promise<Tables<"reports">[]> {
	const supabase = await createClient();

	try {
		const { data: reports, error } = await supabase
			.from("reports")
			.select(`
				*,
				matched_services (
					match_status_type,
					service_details:support_services (
						name
					),
					appointments (
						appointment_date,
						status
					)
				)
			`)
			.eq("user_id", userId)
			.order("submission_timestamp", { ascending: false });

		if (error) {
			console.error("Error fetching reports (Supabase):", error);
			return [];
		}

		return reports || [];
	} catch (error) {
		console.error("Error in fetchUserReports:", JSON.stringify(error, null, 2));
		// Return empty array to prevent UI crash
		return [];
	}
}

// Delete report function
export async function deleteReport(reportId: string) {
	const supabase = await createClient();

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

// export async function submitReport(reportData: {
// 	first_name: string | null;
// 	last_name: string | null;
// 	user_id: string;
// 	phone: string | null;
// 	type_of_incident: string;
// 	incident_description: string;
// 	urgency: string;
// 	consent: string;
// 	contact_preference: string;
// 	required_services: string[];
// 	latitude: number | null;
// 	longitude: number | null;
// }) {
// 	const supabase = await createClient();

// 	try {
// 		const { data, error } = await supabase
// 			.from("reports")
// 			.insert([
// 				{
// 					...reportData,
// 					ismatched: false,
// 					submission_timestamp: new Date().toISOString(),
// 				},
// 			])
// 			.select()
// 			.single();

// 		if (error) throw error;

// 		return { success: true, data };
// 	} catch (error) {
// 		console.error("Error submitting report:", error);
// 		throw error;
// 	}
// }
