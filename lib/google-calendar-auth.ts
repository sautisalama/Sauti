import { google } from "googleapis";
import { createClient } from "@/utils/supabase/server";

export interface CalendarTokens {
	access_token: string;
	refresh_token?: string;
	expiry_date?: number;
}

export class GoogleCalendarAuth {
	private oauth2Client: any;

	constructor() {
		this.oauth2Client = new google.auth.OAuth2(
			process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
			process.env.GOOGLE_CLIENT_SECRET,
			`${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google-calendar/callback`
		);
	}

	/**
	 * Generate OAuth URL for calendar permissions
	 */
	generateAuthUrl(userId: string): string {
		return this.oauth2Client.generateAuthUrl({
			access_type: "offline",
			scope: [
				"https://www.googleapis.com/auth/calendar.events",
				"https://www.googleapis.com/auth/calendar",
				"https://www.googleapis.com/auth/calendar.readonly",
			],
			prompt: "consent",
			state: userId, // Pass user ID for security
		});
	}

	/**
	 * Exchange authorization code for tokens
	 */
	async exchangeCodeForTokens(code: string): Promise<CalendarTokens> {
		const { tokens } = await this.oauth2Client.getToken(code);
		return {
			access_token: tokens.access_token,
			refresh_token: tokens.refresh_token,
			expiry_date: tokens.expiry_date,
		};
	}

	/**
	 * Get valid access token (refresh if needed)
	 */
	async getValidAccessToken(userId: string): Promise<string | null> {
		const supabase = await createClient();

		// Get stored tokens
		const { data: profile } = await supabase
			.from("profiles")
			.select(
				"google_calendar_token, google_calendar_refresh_token, google_calendar_token_expiry"
			)
			.eq("id", userId)
			.single();

		if (!profile?.google_calendar_token) {
			return null;
		}

		// Check if token is expired
		const isExpired =
			profile.google_calendar_token_expiry &&
			new Date().getTime() > profile.google_calendar_token_expiry;

		if (isExpired && profile.google_calendar_refresh_token) {
			// Refresh the token
			this.oauth2Client.setCredentials({
				refresh_token: profile.google_calendar_refresh_token,
			});

			try {
				const { credentials } = await this.oauth2Client.refreshAccessToken();

				// Update stored tokens
				await supabase
					.from("profiles")
					.update({
						google_calendar_token: credentials.access_token,
						google_calendar_token_expiry: credentials.expiry_date,
					})
					.eq("id", userId);

				return credentials.access_token;
			} catch (error) {
				console.error("Failed to refresh calendar token:", error);
				return null;
			}
		}

		return profile.google_calendar_token;
	}

	/**
	 * Create authenticated calendar client
	 */
	async createCalendarClient(userId: string) {
		const accessToken = await this.getValidAccessToken(userId);

		if (!accessToken) {
			throw new Error("No valid calendar access token");
		}

		this.oauth2Client.setCredentials({
			access_token: accessToken,
		});

		return google.calendar({ version: "v3", auth: this.oauth2Client });
	}

	/**
	 * Revoke calendar access
	 */
	async revokeAccess(userId: string): Promise<boolean> {
		const supabase = await createClient();

		try {
			const { data: profile } = await supabase
				.from("profiles")
				.select("google_calendar_token, google_calendar_refresh_token")
				.eq("id", userId)
				.single();

			if (profile?.google_calendar_refresh_token) {
				await this.oauth2Client.revokeToken(profile.google_calendar_refresh_token);
			}

			// Clear tokens from database
			await supabase
				.from("profiles")
				.update({
					google_calendar_token: null,
					google_calendar_refresh_token: null,
					google_calendar_token_expiry: null,
				})
				.eq("id", userId);

			return true;
		} catch (error) {
			console.error("Failed to revoke calendar access:", error);
			return false;
		}
	}
}

export const googleCalendarAuth = new GoogleCalendarAuth();
