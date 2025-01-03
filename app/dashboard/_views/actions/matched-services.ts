import { createClient } from "@/utils/supabase/client";
import { Tables } from "@/types/db-schema";

export async function fetchMatchedServices(userId: string) {
	const supabase = createClient();
	const serviceIds = await getServiceIdsByUserId(userId);

	const { data, error } = await supabase
		.from("matched_services")
		.select(`
			*,
			report:reports(*),
			support_service:support_services(*)
		`)
		.in("service_id", serviceIds)
		.order("match_date", { ascending: false });

	if (error) throw error;
	return data || [];
}

async function updateReportMatchStatus(reportId: string, status: string) {
	const supabase = createClient();
	
	const { error } = await supabase
		.from("reports")
		.update({ match_status: status })
		.eq("report_id", reportId);

	if (error) throw error;
}

export async function acceptMatch(matchId: string) {
	const supabase = createClient();

	try {
		// First get the match details to create the appointment
		const { data: matchData, error: matchError } = await supabase
			.from("matched_services")
			.select(`
				*,
				support_service:support_services(
					user_id,
					name
				)
			`)
			.eq("id", matchId)
			.single();

		if (matchError) throw matchError;
		if (!matchData) throw new Error("Match not found");

		// Start a transaction by updating both tables
		const [matchUpdate, reportUpdate, appointmentCreate] = await Promise.all([
			// Update match status in matched_services
			supabase
				.from("matched_services")
				.update({ 
					match_status_type: "accepted",
					updated_at: new Date().toISOString()
				})
				.eq("id", matchId),

			// Update match status in reports
			updateReportMatchStatus(matchData.report_id!, "accepted"),

			// Create appointment record
			supabase
				.from("appointments")
				.insert({
					matched_services: matchId,
					created_at: new Date().toISOString(),
					appointment_date: null, // Will be set when scheduling
					professional_id: matchData.support_service.user_id,
					survivor_id: matchData.survivor_id,
					status: "pending"
				})
		]);

		// Check for any errors in the updates
		if (matchUpdate.error) throw matchUpdate.error;
		if (appointmentCreate.error) throw appointmentCreate.error;

	} catch (error) {
		console.error("Error accepting match:", error);
		throw error;
	}
}

// Add new function to handle other status updates
export async function updateMatchStatus(
	matchId: string, 
	reportId: string, 
	status: "pending" | "declined" | "completed" | "cancelled"
) {
	const supabase = createClient();

	try {
		const [matchUpdate, reportUpdate] = await Promise.all([
			supabase
				.from("matched_services")
				.update({ 
					match_status_type: status,
					updated_at: new Date().toISOString()
				})
				.eq("id", matchId),
			updateReportMatchStatus(reportId, status)
		]);

		if (matchUpdate.error) throw matchUpdate.error;

	} catch (error) {
		console.error("Error updating match status:", error);
		throw error;
	}
}

export async function getServiceIdsByUserId(userId: string) {
	const supabase = createClient();

	const { data, error } = await supabase
		.from("support_services")
		.select("id")
		.eq("user_id", userId);

	if (error) throw error;
	return data?.map(service => service.id) || [];
}
