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
			service_details:support_services(*)
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
		// First get the match details
		const { data: matchData, error: matchError } = await supabase
			.from("matched_services")
			.select(`
				*,
				service_details:support_services(
					user_id,
					name
				)
			`)
			.eq("id", matchId)
			.single();

		if (matchError) throw matchError;
		if (!matchData) throw new Error("Match not found");

		// Update match status in matched_services
		const { error: matchUpdateError } = await supabase
			.from("matched_services")
			.update({ 
				match_status_type: "accepted",
				updated_at: new Date().toISOString()
			})
			.eq("id", matchId);

		if (matchUpdateError) throw matchUpdateError;

		// Update match status in reports
		await updateReportMatchStatus(matchData.report_id!, "accepted");

	} catch (error) {
		console.error("Error accepting match:", error);
		throw error;
	}
}

// Move appointment creation to a separate transaction
export async function createMatchAppointment(
	matchId: string,
	appointmentDate: Date,
	professionalId: string,
	survivorId: string
) {
	const supabase = createClient();

	try {
		const { error: appointmentError } = await supabase
			.from("appointments")
			.insert({
				matched_services: matchId,
				created_at: new Date().toISOString(),
				appointment_date: appointmentDate.toISOString(),
				professional_id: professionalId,
				survivor_id: survivorId,
				status: "confirmed"
			});

		if (appointmentError) throw appointmentError;

	} catch (error) {
		console.error("Error creating appointment:", error);
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

export async function updateMatchFeedback(matchId: string, feedback: string) {
	const supabase = createClient();
	const { error } = await supabase
		.from("matched_services")
		.update({ feedback, updated_at: new Date().toISOString() })
		.eq("id", matchId);
	if (error) throw error;
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
