import * as ics from "ics";

export interface CalendarEvent {
	title: string;
	start: Date;
	end: Date;
	description?: string;
	location?: string;
	attendees?: string[];
}

// Google Calendar service functions moved to API routes for server-side execution

// Generate ICS file for direct calendar download
export function generateICSFile(event: CalendarEvent): string {
	const icsEvent = {
		start: [
			event.start.getFullYear(),
			event.start.getMonth() + 1,
			event.start.getDate(),
			event.start.getHours(),
			event.start.getMinutes(),
		] as [number, number, number, number, number],
		end: [
			event.end.getFullYear(),
			event.end.getMonth() + 1,
			event.end.getDate(),
			event.end.getHours(),
			event.end.getMinutes(),
		] as [number, number, number, number, number],
		title: event.title,
		description: event.description || "",
		location: event.location || "",
		url: typeof window !== "undefined" ? window.location.origin : "",
		geo: { lat: 0, lon: 0 },
		categories: ["Appointment", "Healthcare"],
		status: "CONFIRMED" as const,
		busyStatus: "BUSY" as const,
		organizer: { name: "Sauti Platform", email: "support@sauti.com" },
		attendees: event.attendees?.map((email) => ({ name: email, email })) || [],
	};

	try {
		const { error, value } = ics.createEvent(icsEvent);
		if (error) {
			console.error("Error creating ICS:", error);
			throw error;
		}
		return value || "";
	} catch (error) {
		console.error("Error generating ICS file:", error);
		throw error;
	}
}

// Create calendar URLs for various providers
export function generateCalendarUrls(event: CalendarEvent) {
	const startDate =
		event.start.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
	const endDate =
		event.end.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
	const details = encodeURIComponent(event.description || "");
	const location = encodeURIComponent(event.location || "");
	const title = encodeURIComponent(event.title);

	return {
		google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startDate}/${endDate}&details=${details}&location=${location}`,
		outlook: `https://outlook.live.com/calendar/0/deeplink/compose?subject=${title}&startdt=${startDate}&enddt=${endDate}&body=${details}&location=${location}`,
		office365: `https://outlook.office.com/calendar/0/deeplink/compose?subject=${title}&startdt=${startDate}&enddt=${endDate}&body=${details}&location=${location}`,
		yahoo: `https://calendar.yahoo.com/?v=60&view=d&type=20&title=${title}&st=${startDate}&et=${endDate}&desc=${details}&in_loc=${location}`,
	};
}

// OAuth functions moved to API routes for server-side execution
