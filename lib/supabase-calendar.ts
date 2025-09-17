import { createClient } from "@/utils/supabase/server";

export class SupabaseCalendarService {
	private supabase = createClient();

	/**
	 * Calendar integration is now optional - return mock data
	 */
	async getAccessToken(userId: string): Promise<string | null> {
		console.log("Calendar integration is optional - no token required");
		return null;
	}

	/**
	 * Calendar integration is now optional - return mock client
	 */
	async createCalendarClient(userId: string) {
		console.log("Calendar integration is optional - returning mock client");
		return {
			events: {
				insert: async () => ({ data: { id: "mock-event-id", htmlLink: "#" } }),
				update: async () => ({ data: {} }),
				delete: async () => ({ data: {} }),
			},
			calendarList: {
				list: async () => ({ data: { items: [] } }),
			},
		};
	}

	/**
	 * Create calendar event (mock implementation)
	 */
	async createEvent(
		userId: string,
		eventData: {
			summary: string;
			description?: string;
			start: { dateTime: string; timeZone: string };
			end: { dateTime: string; timeZone: string };
			attendees?: { email: string }[];
		}
	) {
		console.log("Calendar integration is optional - returning mock event");
		return {
			id: `mock-event-${Date.now()}`,
			summary: eventData.summary,
			description: eventData.description,
			start: eventData.start,
			end: eventData.end,
			attendees: eventData.attendees,
			htmlLink: "#",
		};
	}

	/**
	 * Update calendar event (mock implementation)
	 */
	async updateEvent(userId: string, eventId: string, eventData: any) {
		console.log("Calendar integration is optional - mock update");
		return { id: eventId, ...eventData };
	}

	/**
	 * Delete calendar event (mock implementation)
	 */
	async deleteEvent(userId: string, eventId: string) {
		console.log("Calendar integration is optional - mock delete");
		return true;
	}

	/**
	 * List user's calendars (mock implementation)
	 */
	async listCalendars(userId: string) {
		console.log(
			"Calendar integration is optional - returning empty calendar list"
		);
		return [];
	}
}

export const supabaseCalendarService = new SupabaseCalendarService();
