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

		// Update match status to accepted
		const { error: updateError } = await supabase
			.from("matched_services")
			.update({ 
				match_status_type: "accepted",
				updated_at: new Date().toISOString()
			})
			.eq("id", matchId);

		if (updateError) throw updateError;

		// Create appointment record
		const { error: appointmentError } = await supabase
			.from("appointments")
			.insert({
				matched_services: matchId,
				created_at: new Date().toISOString(),
				appointment_date: null, // Will be set when scheduling
				professional_id: matchData.support_service.user_id,
				survivor_id: matchData.survivor_id,
				status: "pending"
			});

		if (appointmentError) throw appointmentError;

	} catch (error) {
		console.error("Error accepting match:", error);
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
