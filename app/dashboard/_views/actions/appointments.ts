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
	userType: "professional" | "survivor",
	includeBothRoles = false
) {
	const supabase = createClient();

	let query = supabase.from("appointments").select(`
			*,
			matched_service:matched_services (
				*,
				support_service:support_services (*),
				report:reports (
					*,
					user:profiles (*)
				)
			),
			professional:profiles!appointments_professional_id_fkey (*),
			survivor:profiles!appointments_survivor_id_fkey (*)
		`);

	if (includeBothRoles && userType === "professional") {
		// For professionals, show appointments where they are either the professional or survivor
		query = query.or(`professional_id.eq.${userId},survivor_id.eq.${userId}`);
	} else {
		// For other cases, use the original logic
		query = query.eq(
			userType === "professional" ? "professional_id" : "survivor_id",
			userId
		);
	}

	const { data, error } = await query;

	if (error) {
		console.error("Error fetching appointments:", error);
		throw error;
	}

	return data;
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

// Add this new function
export async function fetchAppointmentById(appointmentId: string) {
	const supabase = createClient();

	const { data, error } = await supabase
		.from("appointments")
		.select(
			`
			*,
			matched_service:matched_services (
				*,
				support_service:support_services (*),
				report:reports (
					*,
					user:profiles (*)
				)
			),
			professional:profiles!appointments_professional_id_fkey (*),
			survivor:profiles!appointments_survivor_id_fkey (*)
		`
		)
		.eq("appointment_id", appointmentId)
		.single();

	if (error) {
		console.error("Error fetching appointment:", error);
		throw error;
	}

	return data;
}

// Add this new function
export async function updateAppointmentNotes(
	appointmentId: string,
	notes: string
) {
	const supabase = createClient();

	const { error } = await supabase
		.from("appointments")
		.update({ notes })
		.eq("appointment_id", appointmentId);

	if (error) {
		console.error("Error updating appointment notes:", error);
		throw error;
	}
}
