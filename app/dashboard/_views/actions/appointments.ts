import { createClient } from "@/utils/supabase/server";
import { Tables, TablesInsert } from "@/types/db-schema";
import { AppointmentWithDetails } from "@/app/dashboard/_types";
import { syncAppointmentToGoogleCalendar } from "@/lib/notifications/calendar-sync";
import { sendEmail } from "@/lib/notifications/email";
import { getAppointmentConfirmedTemplate, getAppointmentScheduledTemplate } from "@/lib/notifications/templates";
import { format } from "date-fns";

export async function createAppointment(
	appointment: TablesInsert<"appointments">
) {
	const supabase = await createClient();

	const { error } = await supabase.from("appointments").insert([appointment]);

	if (error) {
		console.error("Error creating appointment:", error);
		throw error;
	}
}

export async function fetchUserAppointments(
	userId: string,
	userType: "professional" | "survivor",
	includeBothRoles = false
) {
	const supabase = await createClient();

	let query = supabase.from("appointments").select(`
			*,
			matched_service:matched_services (
				*,
				service_details:support_services (*),
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
	status: "confirmed" | "requested" | "pending"
) {
	const supabase = await createClient();

	const { error } = await supabase
		.from("appointments")
		.update({ status })
		.eq("appointment_id", appointmentId);

	if (error) {
		console.error("Error updating appointment status:", error);
		throw error;
	}
}

// Add this new function
export async function fetchAppointmentById(appointmentId: string) {
	const supabase = await createClient();

	const { data, error } = await supabase
		.from("appointments")
		.select(
			`
			*,
			matched_service:matched_services (
				*,
				service_details:support_services (*),
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
	const supabase = await createClient();

	const { error } = await supabase
		.from("appointments")
		.update({ notes })
		.eq("appointment_id", appointmentId);

	if (error) {
		console.error("Error updating appointment notes:", error);
		throw error;
	}
}

// Confirm a suggested appointment
export async function confirmAppointment(appointmentId: string) {
	const supabase = await createClient();

	const { error } = await supabase
		.from("appointments")
		.update({ status: "confirmed" })
		.eq("appointment_id", appointmentId);

	if (error) {
		console.error("Error confirming appointment:", error);
		throw error;
	}

	const appt = await fetchAppointmentById(appointmentId);
	if (appt) {
		const survivorId = appt.survivor_id;
		const profId = appt.professional_id;
		if (survivorId) await syncAppointmentToGoogleCalendar(appointmentId, survivorId);
		if (profId) await syncAppointmentToGoogleCalendar(appointmentId, profId);
		
		const survivor = appt.survivor as any;
		const prof = appt.professional as any;
		if (survivor?.email && prof) {
			const survivorName = survivor.is_anonymous ? (survivor.anon_username || "Survivor") : (survivor.first_name || "Survivor");
			const profName = prof.first_name || "Professional";
			try {
				await sendEmail(
					survivor.email,
					"Support Session Confirmed",
					getAppointmentConfirmedTemplate({
						userName: survivorName,
						professionalName: profName,
						date: appt.appointment_date ? format(new Date(appt.appointment_date), "PPPP") : "TBD",
						time: appt.appointment_date ? format(new Date(appt.appointment_date), "p") : "TBD",
						type: appt.appointment_type || "Virtual Session",
						actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
					})
				);
			} catch (err) {}
		}
	}
}

// Reschedule an appointment
export async function rescheduleAppointment(
	appointmentId: string,
	newDate: string,
	notes?: string,
	status: "confirmed" | "requested" = "confirmed"
) {
	const supabase = await createClient();

	const { error } = await supabase
		.from("appointments")
		.update({
			appointment_date: newDate,
			status: status,
			notes: notes || "Rescheduled",
		})
		.eq("appointment_id", appointmentId);

	if (error) {
		console.error("Error rescheduling appointment:", error);
		throw error;
	}

	const appt = await fetchAppointmentById(appointmentId);
	if (appt) {
		const survivorId = appt.survivor_id;
		const profId = appt.professional_id;
		if (survivorId) await syncAppointmentToGoogleCalendar(appointmentId, survivorId);
		if (profId) await syncAppointmentToGoogleCalendar(appointmentId, profId);

		const survivor = appt.survivor as any;
		const prof = appt.professional as any;
		
		// Send notification emails
		try {
			const dateStr = format(new Date(newDate), "PPPP");
			const timeStr = format(new Date(newDate), "p");
			
			if (survivor?.email && prof) {
				const survivorName = survivor.is_anonymous ? (survivor.anon_username || "Survivor") : (survivor.first_name || "Survivor");
				const profName = prof.first_name || "Professional";
				
				await sendEmail(
					survivor.email,
					"Support Session Rescheduled",
					getAppointmentScheduledTemplate({
						userName: survivorName,
						professionalName: profName,
						date: dateStr,
						time: timeStr,
						type: appt.appointment_type || "Virtual Session",
						actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
					})
				);
				
				if (prof.email) {
					await sendEmail(
						prof.email,
						"Case Session Rescheduled",
						getAppointmentScheduledTemplate({
							userName: profName,
							professionalName: survivorName,
							date: dateStr,
							time: timeStr,
							type: appt.appointment_type || "Virtual Session",
							actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
						})
					);
				}
			}
		} catch (err) {}
	}
}

// Confirm a reschedule request
export async function confirmReschedule(appointmentId: string, matchId: string) {
	const supabase = await createClient();

	const { error: apptError } = await supabase
		.from("appointments")
		.update({ status: "confirmed" })
		.eq("appointment_id", appointmentId);

	if (apptError) throw apptError;

	const { error: matchError } = await supabase
		.from("matched_services")
		.update({ match_status_type: "accepted", updated_at: new Date().toISOString() })
		.eq("id", matchId);

	if (matchError) throw matchError;

	const appt = await fetchAppointmentById(appointmentId);
	if (appt) {
		const survivorId = appt.survivor_id;
		const profId = appt.professional_id;
		if (survivorId) await syncAppointmentToGoogleCalendar(appointmentId, survivorId);
		if (profId) await syncAppointmentToGoogleCalendar(appointmentId, profId);

		const survivor = appt.survivor as any;
		const prof = appt.professional as any;
		
		if (survivor?.email && prof) {
			const survivorName = survivor.is_anonymous ? (survivor.anon_username || "Survivor") : (survivor.first_name || "Survivor");
			const profName = prof.first_name || "Professional";
			try {
				const dateStr = appt.appointment_date ? format(new Date(appt.appointment_date), "PPPP") : "TBD";
				const timeStr = appt.appointment_date ? format(new Date(appt.appointment_date), "p") : "TBD";

				await sendEmail(
					survivor.email,
					"Support Session Confirmed",
					getAppointmentConfirmedTemplate({
						userName: survivorName,
						professionalName: profName,
						date: dateStr,
						time: timeStr,
						type: appt.appointment_type || "Virtual Session",
						actionUrl: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`
					})
				);
			} catch (err) {}
		}
	}
    return { success: true };
}

