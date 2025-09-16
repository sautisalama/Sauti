import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { googleCalendarAuth } from "@/lib/google-calendar-auth";

export async function POST(request: Request) {
	try {
		const supabase = await createClient();
		const {
			data: { user },
		} = await supabase.auth.getUser();

		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = await request.json();
		const { action, appointmentId } = body;

		const calendar = await googleCalendarAuth.createCalendarClient(user.id);

		switch (action) {
			case "create":
				return await createCalendarEvent(calendar, appointmentId, supabase);

			case "update":
				return await updateCalendarEvent(calendar, appointmentId, supabase);

			case "delete":
				return await deleteCalendarEvent(calendar, appointmentId, supabase);

			case "sync_all":
				return await syncAllAppointments(calendar, user.id, supabase);

			default:
				return NextResponse.json({ error: "Invalid action" }, { status: 400 });
		}
	} catch (error) {
		console.error("Calendar sync error:", error);
		return NextResponse.json(
			{ error: "Failed to sync with calendar" },
			{ status: 500 }
		);
	}
}

async function createCalendarEvent(
	calendar: any,
	appointmentId: string,
	supabase: any
) {
	// Get appointment details
	const { data: appointment } = await supabase
		.from("appointments")
		.select(
			`
      *,
      professional:profiles!appointments_professional_id_fkey(*),
      survivor:profiles!appointments_survivor_id_fkey(*),
      matched_service:matched_services(
        support_service:support_services(*),
        report:reports(*)
      )
    `
		)
		.eq("appointment_id", appointmentId)
		.single();

	if (!appointment) {
		throw new Error("Appointment not found");
	}

	const event = {
		summary: `Appointment - ${
			appointment.matched_service?.support_service?.name || "Support Session"
		}`,
		description: `Support appointment for ${
			appointment.matched_service?.report?.type_of_incident || "incident"
		}`,
		start: {
			dateTime: new Date(appointment.appointment_date).toISOString(),
			timeZone: "Africa/Nairobi",
		},
		end: {
			dateTime: new Date(
				new Date(appointment.appointment_date).getTime() +
					(appointment.duration_minutes || 60) * 60000
			).toISOString(),
			timeZone: "Africa/Nairobi",
		},
		attendees: [
			{ email: appointment.professional?.email },
			{ email: appointment.survivor?.email },
		].filter((attendee) => attendee.email),
		reminders: {
			useDefault: false,
			overrides: [
				{ method: "email", minutes: 24 * 60 }, // 1 day before
				{ method: "popup", minutes: 60 }, // 1 hour before
			],
		},
	};

	const response = await calendar.events.insert({
		calendarId: "primary",
		requestBody: event,
	});

	// Store Google Calendar event ID
	await supabase
		.from("appointments")
		.update({ google_calendar_event_id: response.data.id })
		.eq("appointment_id", appointmentId);

	return NextResponse.json({
		success: true,
		eventId: response.data.id,
		eventUrl: response.data.htmlLink,
	});
}

async function updateCalendarEvent(
	calendar: any,
	appointmentId: string,
	supabase: any
) {
	const { data: appointment } = await supabase
		.from("appointments")
		.select("google_calendar_event_id, appointment_date, duration_minutes")
		.eq("appointment_id", appointmentId)
		.single();

	if (!appointment?.google_calendar_event_id) {
		throw new Error("No Google Calendar event ID found");
	}

	const event = {
		summary: `Appointment - Updated`,
		start: {
			dateTime: new Date(appointment.appointment_date).toISOString(),
			timeZone: "Africa/Nairobi",
		},
		end: {
			dateTime: new Date(
				new Date(appointment.appointment_date).getTime() +
					(appointment.duration_minutes || 60) * 60000
			).toISOString(),
			timeZone: "Africa/Nairobi",
		},
	};

	await calendar.events.update({
		calendarId: "primary",
		eventId: appointment.google_calendar_event_id,
		requestBody: event,
	});

	return NextResponse.json({ success: true });
}

async function deleteCalendarEvent(
	calendar: any,
	appointmentId: string,
	supabase: any
) {
	const { data: appointment } = await supabase
		.from("appointments")
		.select("google_calendar_event_id")
		.eq("appointment_id", appointmentId)
		.single();

	if (appointment?.google_calendar_event_id) {
		await calendar.events.delete({
			calendarId: "primary",
			eventId: appointment.google_calendar_event_id,
		});
	}

	return NextResponse.json({ success: true });
}

async function syncAllAppointments(
	calendar: any,
	userId: string,
	supabase: any
) {
	// Get all appointments for the user
	const { data: appointments } = await supabase
		.from("appointments")
		.select("*")
		.or(`professional_id.eq.${userId},survivor_id.eq.${userId}`)
		.is("google_calendar_event_id", null);

	const results = [];
	for (const appointment of appointments || []) {
		try {
			const result = await createCalendarEvent(
				calendar,
				appointment.appointment_id,
				supabase
			);
			results.push({ appointmentId: appointment.appointment_id, success: true });
		} catch (error) {
			results.push({
				appointmentId: appointment.appointment_id,
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			});
		}
	}

	return NextResponse.json({
		success: true,
		synced: results.filter((r) => r.success).length,
		failed: results.filter((r) => !r.success).length,
		results,
	});
}
