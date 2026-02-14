import { google } from "googleapis";

// ─── Configuration ───────────────────────────────────────────────────────────
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const GOOGLE_REDIRECT_URI =
	process.env.GOOGLE_CALENDAR_REDIRECT_URI ||
	`${process.env.NEXT_PUBLIC_APP_URL}/api/auth/google/callback`;

// Scopes required for calendar integration
const CALENDAR_SCOPES = [
	"https://www.googleapis.com/auth/calendar.events",
	"https://www.googleapis.com/auth/calendar.readonly",
];

// ─── Types ───────────────────────────────────────────────────────────────────
export interface GoogleCalendarTokens {
	access_token: string;
	refresh_token?: string;
	expiry_date?: number;
	token_type?: string;
	scope?: string;
}

export interface GoogleCalendarEvent {
	summary: string;
	description?: string;
	location?: string;
	start: { dateTime: string; timeZone?: string };
	end: { dateTime: string; timeZone?: string };
	attendees?: Array<{ email: string; displayName?: string }>;
	reminders?: {
		useDefault: boolean;
		overrides?: Array<{ method: string; minutes: number }>;
	};
}

// ─── OAuth2 Client ───────────────────────────────────────────────────────────

/** Create a new OAuth2 client instance */
export function createOAuth2Client() {
	return new google.auth.OAuth2(
		GOOGLE_CLIENT_ID,
		GOOGLE_CLIENT_SECRET,
		GOOGLE_REDIRECT_URI
	);
}

/** Create an OAuth2 client pre-loaded with tokens */
export function createOAuth2ClientFromTokens(tokens: GoogleCalendarTokens) {
	const oauth2Client = createOAuth2Client();
	oauth2Client.setCredentials(tokens);
	return oauth2Client;
}

/** Generate the Google OAuth consent URL */
export function getGoogleAuthUrl(state?: string): string {
	const oauth2Client = createOAuth2Client();
	return oauth2Client.generateAuthUrl({
		access_type: "offline",
		scope: CALENDAR_SCOPES,
		prompt: "consent",
		state: state || "",
	});
}

/** Exchange an authorization code for tokens */
export async function exchangeCodeForTokens(
	code: string
): Promise<GoogleCalendarTokens> {
	const oauth2Client = createOAuth2Client();
	const { tokens } = await oauth2Client.getToken(code);
	return {
		access_token: tokens.access_token || "",
		refresh_token: tokens.refresh_token || undefined,
		expiry_date: tokens.expiry_date || undefined,
		token_type: tokens.token_type || "Bearer",
		scope: tokens.scope || "",
	};
}

/** Refresh an expired access token */
export async function refreshGoogleAccessToken(
	refreshToken: string
): Promise<GoogleCalendarTokens> {
	const oauth2Client = createOAuth2Client();
	oauth2Client.setCredentials({ refresh_token: refreshToken });
	const { credentials } = await oauth2Client.refreshAccessToken();
	return {
		access_token: credentials.access_token || "",
		refresh_token: credentials.refresh_token || refreshToken,
		expiry_date: credentials.expiry_date || undefined,
		token_type: credentials.token_type || "Bearer",
		scope: credentials.scope || "",
	};
}

// ─── Calendar API Helpers ────────────────────────────────────────────────────

function getCalendarClient(tokens: GoogleCalendarTokens) {
	const oauth2Client = createOAuth2Client();
	oauth2Client.setCredentials(tokens);
	return google.calendar({ version: "v3", auth: oauth2Client });
}

/** List the user's calendars */
export async function listGoogleCalendars(tokens: GoogleCalendarTokens) {
	const calendar = getCalendarClient(tokens);
	const response = await calendar.calendarList.list();
	return response.data.items || [];
}

/** Create a calendar event */
export async function createGoogleCalendarEvent(
	tokens: GoogleCalendarTokens,
	event: GoogleCalendarEvent,
	calendarId: string = "primary"
) {
	const calendar = getCalendarClient(tokens);
	const response = await calendar.events.insert({
		calendarId,
		requestBody: event,
		sendUpdates: "all",
	});
	return response.data;
}

/** Update a calendar event */
export async function updateGoogleCalendarEvent(
	tokens: GoogleCalendarTokens,
	eventId: string,
	event: Partial<GoogleCalendarEvent>,
	calendarId: string = "primary"
) {
	const calendar = getCalendarClient(tokens);
	const response = await calendar.events.patch({
		calendarId,
		eventId,
		requestBody: event,
	});
	return response.data;
}

/** Delete a calendar event */
export async function deleteGoogleCalendarEvent(
	tokens: GoogleCalendarTokens,
	eventId: string,
	calendarId: string = "primary"
) {
	const calendar = getCalendarClient(tokens);
	await calendar.events.delete({ calendarId, eventId });
}

/** List upcoming events */
export async function listGoogleUpcomingEvents(
	tokens: GoogleCalendarTokens,
	maxResults: number = 10,
	calendarId: string = "primary"
) {
	const calendar = getCalendarClient(tokens);
	const response = await calendar.events.list({
		calendarId,
		timeMin: new Date().toISOString(),
		maxResults,
		singleEvents: true,
		orderBy: "startTime",
	});
	return response.data.items || [];
}

/** Check if tokens are valid (not expired) */
export function areGoogleTokensValid(tokens: GoogleCalendarTokens): boolean {
	if (!tokens.access_token) return false;
	if (!tokens.expiry_date) return true;
	return tokens.expiry_date > Date.now();
}

/** Check if Google Calendar credentials are configured in env */
export function isGoogleCalendarConfigured(): boolean {
	return !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
}
