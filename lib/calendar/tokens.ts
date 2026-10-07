import { createAdminClient } from "@/utils/supabase/admin-client";
import { decryptField, encryptField } from "@/lib/security/crypto";

/**
 * Google Calendar OAuth tokens. Server-only on purpose: the table has no client
 * policies, tokens are encrypted at rest, and browsers only learn "connected or
 * not" through the `get_calendar_connection` RPC.
 */
export interface CalendarTokens {
	access_token: string | null;
	refresh_token: string | null;
	expiry_date: number | null;
}

export async function getCalendarTokens(userId: string): Promise<CalendarTokens | null> {
	const { data, error } = await createAdminClient()
		.from("profile_calendar_tokens")
		.select("access_token, refresh_token, expiry_date")
		.eq("user_id", userId)
		.maybeSingle();
	if (error) throw new Error(`calendar tokens read failed: ${error.message}`);
	if (!data) return null;
	return {
		access_token: decryptField(data.access_token),
		refresh_token: decryptField(data.refresh_token),
		expiry_date: data.expiry_date,
	};
}

/** Merge new values over the stored ones (Google only returns a refresh token on first consent). */
export async function saveCalendarTokens(userId: string, patch: Partial<CalendarTokens>): Promise<void> {
	const admin = createAdminClient();
	const row: Record<string, unknown> = { user_id: userId };
	if (patch.access_token !== undefined) row.access_token = encryptField(patch.access_token);
	if (patch.refresh_token) row.refresh_token = encryptField(patch.refresh_token); // never overwrite with empty
	if (patch.expiry_date !== undefined) row.expiry_date = patch.expiry_date;
	const { error } = await admin.from("profile_calendar_tokens").upsert(row as never, { onConflict: "user_id" });
	if (error) throw new Error(`calendar tokens save failed: ${error.message}`);
}

export async function clearCalendarTokens(userId: string): Promise<void> {
	const { error } = await createAdminClient().from("profile_calendar_tokens").delete().eq("user_id", userId);
	if (error) throw new Error(`calendar tokens clear failed: ${error.message}`);
}
