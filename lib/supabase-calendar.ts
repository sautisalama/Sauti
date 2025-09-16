import { createClient } from "@/utils/supabase/server";
import { google } from "googleapis";

export class SupabaseCalendarService {
	private supabase = createClient();

	/**
	 * Get Google access token from stored profile
	 */
	async getAccessToken(userId: string): Promise<string | null> {
		try {
			const supabase = await this.supabase;
			const { data: profile } = await supabase
				.from("profiles")
				.select("google_calendar_token, google_calendar_token_expiry")
				.eq("id", userId)
				.single();

			if (!profile?.google_calendar_token) {
				console.error("No Google Calendar token found for user");
				return null;
			}

			// Check if token is expired
			const isExpired =
				profile.google_calendar_token_expiry &&
				new Date().getTime() > profile.google_calendar_token_expiry;

			if (isExpired) {
				console.error("Google Calendar token is expired");
				return null;
			}

			return profile.google_calendar_token;
		} catch (error) {
			console.error("Error getting access token:", error);
			return null;
		}
	}

	/**
	 * Create authenticated Google Calendar client
	 */
	async createCalendarClient(userId: string) {
		const accessToken = await this.getAccessToken(userId);

		if (!accessToken) {
			throw new Error("No valid Google access token");
		}

		const oauth2Client = new google.auth.OAuth2();
		oauth2Client.setCredentials({
			access_token: accessToken,
		});

		return google.calendar({ version: "v3", auth: oauth2Client });
	}

	/**
	 * Create calendar event
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
		const calendar = await this.createCalendarClient(userId);

		const event = {
			summary: eventData.summary,
			description: eventData.description,
			start: eventData.start,
			end: eventData.end,
			attendees: eventData.attendees,
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

		return response.data;
	}

	/**
	 * Update calendar event
	 */
	async updateEvent(userId: string, eventId: string, eventData: any) {
		const calendar = await this.createCalendarClient(userId);

		const response = await calendar.events.update({
			calendarId: "primary",
			eventId: eventId,
			requestBody: eventData,
		});

		return response.data;
	}

	/**
	 * Delete calendar event
	 */
	async deleteEvent(userId: string, eventId: string) {
		const calendar = await this.createCalendarClient(userId);

		await calendar.events.delete({
			calendarId: "primary",
			eventId: eventId,
		});

		return true;
	}

	/**
	 * List user's calendars
	 */
	async listCalendars(userId: string) {
		const calendar = await this.createCalendarClient(userId);

		const response = await calendar.calendarList.list();
		return response.data.items;
	}
}

export const supabaseCalendarService = new SupabaseCalendarService();
