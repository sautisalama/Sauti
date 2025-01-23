import { createClient } from "@/utils/supabase/client";
import { Tables, TablesInsert } from "@/types/db-schema";
import { AppointmentWithDetails } from "@/app/dashboard/_types";

export async function createAppointment(
	appointment: TablesInsert<"appointments">
) {
	const supabase = createClient();

	const { error } = await supabase.from("appointments").insert([appointment]);

	if (error) {
		console.error("Error creating appointment:", error);
		throw error;
	}
}

// Fetch appointments for a user (either as professional or survivor)
export async function fetchUserAppointments(
	userId: string,
	userType: "professional" | "survivor"
) {
	const supabase = createClient();

	try {
		// 1. First get all accepted matches for the user
		const { data: matchedServices, error: matchError } = await supabase
			.from("matched_services")
			.select(
				`
				id,
				match_status_type,
				service_id,
				support_service:support_services (
					id,
					name,
					email
				)
			`
			)
			.eq("survivor_id", userId)
			.eq("match_status_type", "accepted");

		if (matchError) throw matchError;

		if (!matchedServices?.length) return [];
		console.log("Matched Services...", matchedServices);

		// 2. Get appointments for these matched services
		const { data: appointments, error: appointmentsError } = await supabase
			.from("appointments")
			.select(`
				appointment_id,
				appointment_date,
				status,
				matched_services,
				professional_id,
				survivor_id,
				matched_services!inner (
					id,
					report:reports(*),
					support_service:support_services(*)
				)
			`)
			.in(
				"matched_services",
				matchedServices.map((match) => match.id)
			)
			.order("appointment_date", { ascending: true });

		if (appointmentsError) throw appointmentsError;

		// 3. Combine the data
		const appointmentsWithDetails = appointments?.map((appointment) => ({
			id: appointment.appointment_id,
			appointment_date: appointment.appointment_date,
			status: appointment.status,
			professional_id: appointment.professional_id,
			survivor_id: appointment.survivor_id,
			matched_service: {
				support_service: appointment.matched_services.support_service,
				report: appointment.matched_services.report
			},
		})) as AppointmentWithDetails[];

		return appointmentsWithDetails || [];
	} catch (error) {
		console.error("Error fetching appointments:", error);
		throw error;
	}
}

// Update appointment status
export async function updateAppointmentStatus(
	appointmentId: string,
	status: "confirmed" | "cancelled" | "completed"
) {
	const supabase = createClient();

	const { error } = await supabase
		.from("appointments")
		.update({ status })
		.eq("id", appointmentId);

	if (error) {
		console.error("Error updating appointment status:", error);
		throw error;
	}
}
