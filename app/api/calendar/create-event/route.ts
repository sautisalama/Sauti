import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import {
	isGoogleCalendarConfigured,
	createOAuth2ClientFromTokens,
} from "@/lib/google-calendar-oauth";
import { google } from "googleapis";

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
		const { appointmentId, event } = body as {
			appointmentId?: string;
			event: {
				title: string;
				start: string;
				end: string;
				description?: string;
				location?: string;
				attendees?: string[];
			};
		};

		// Check if Google Calendar is configured
		if (!isGoogleCalendarConfigured()) {
			return NextResponse.json(
				{ error: "Google Calendar is not configured on this server" },
				{ status: 501 }
			);
		}

		// Fetch user's Google Calendar tokens from separate columns
		const { data: profile, error: profileError } = await supabase
			.from("profiles")
			.select("google_calendar_token, google_calendar_refresh_token, google_calendar_token_expiry")
			.eq("id", user.id)
			.single();

		if (profileError || !profile?.google_calendar_token) {
			return NextResponse.json(
				{ error: "Google Calendar not connected" },
				{ status: 400 }
			);
		}

		const tokens = {
			access_token: profile.google_calendar_token,
			refresh_token: profile.google_calendar_refresh_token || undefined,
			expiry_date: profile.google_calendar_token_expiry || undefined,
		};

		// Create OAuth2 client with the user's tokens
		const oauth2Client = createOAuth2ClientFromTokens(tokens);

		// If the token is expired, try refreshing it
		if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
			try {
				const { credentials } = await oauth2Client.refreshAccessToken();
				// Update stored tokens in separate columns
				await supabase
					.from("profiles")
					.update({
						google_calendar_token: credentials.access_token || tokens.access_token,
						google_calendar_refresh_token: credentials.refresh_token || tokens.refresh_token || null,
						google_calendar_token_expiry: credentials.expiry_date || null,
					})
					.eq("id", user.id);
				oauth2Client.setCredentials(credentials);
			} catch {
				return NextResponse.json(
					{ error: "Google Calendar token expired. Please reconnect." },
					{ status: 401 }
				);
			}
		}

		// Create the calendar event
		const calendar = google.calendar({ version: "v3", auth: oauth2Client });

		const calendarEvent = {
			summary: event.title,
			description: event.description || "",
			location: event.location || "",
			start: {
				dateTime: event.start,
				timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			},
			end: {
				dateTime: event.end,
				timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
			},
			reminders: {
				useDefault: false,
				overrides: [
					{ method: "popup", minutes: 30 },
					{ method: "email", minutes: 60 },
				],
			},
			...(event.attendees && event.attendees.length > 0
				? {
						attendees: event.attendees.map((email: string) => ({
							email,
						})),
					}
				: {}),
		};

		const response = await calendar.events.insert({
			calendarId: "primary",
			requestBody: calendarEvent,
		});

		return NextResponse.json({
			success: true,
			eventId: response.data.id,
			eventLink: response.data.htmlLink,
		});
	} catch (error) {
		console.error("Error creating calendar event:", error);
		return NextResponse.json(
			{ error: "Failed to create calendar event" },
			{ status: 500 }
		);
	}
}
