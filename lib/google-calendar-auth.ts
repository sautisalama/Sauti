import { createClient } from "@/utils/supabase/server";

export interface CalendarTokens {
	access_token: string;
	refresh_token?: string;
	expiry_date?: number;
}

export class GoogleCalendarAuth {
	/**
	 * Calendar integration is now optional - return mock auth URL
	 */
	generateAuthUrl(userId: string): string {
		console.log("Calendar integration is optional - returning mock auth URL");
		return "#";
	}

	/**
	 * Calendar integration is now optional - return mock tokens
	 */
	async exchangeCodeForTokens(code: string): Promise<CalendarTokens> {
		console.log("Calendar integration is optional - returning mock tokens");
		return {
			access_token: "mock-token",
			refresh_token: "mock-refresh-token",
			expiry_date: Date.now() + 3600000, // 1 hour from now
		};
	}

	/**
	 * Calendar integration is now optional - return null
	 */
	async getValidAccessToken(userId: string): Promise<string | null> {
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
	 * Calendar integration is now optional - return mock success
	 */
	async revokeAccess(userId: string): Promise<boolean> {
		console.log("Calendar integration is optional - mock revoke");
		return true;
	}
}

export const googleCalendarAuth = new GoogleCalendarAuth();
