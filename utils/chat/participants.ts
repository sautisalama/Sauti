import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db-schema";

type ChatWithParticipants = { id: string; participants?: Array<{ user_id: string; user?: unknown }> | null };

/**
 * Fill in `participant.user` for people the profiles RLS policy hides.
 *
 * `profiles` only lets you read your own row (plus admins and verified public
 * professionals), so a plain embed returns null for most chat counterparts and
 * the UI showed "Unknown User". The RPC returns just display fields, and only
 * for people who share a chat with the caller. Safe to call from server or browser.
 */
export async function withParticipantProfiles<T extends ChatWithParticipants>(
	supabase: SupabaseClient<Database>,
	chats: T[]
): Promise<T[]> {
	const missing = chats.filter((c) => c.participants?.some((p) => !p.user));
	if (!missing.length) return chats;

	const { data, error } = await supabase.rpc("get_chat_participant_profiles", { p_chat_ids: missing.map((c) => c.id) });
	if (error || !data) {
		console.error("[chat] could not load participant profiles:", error?.message);
		return chats;
	}
	const byId = new Map(data.map((p) => [p.id, p]));
	return chats.map((c) =>
		c.participants?.some((p) => !p.user)
			? { ...c, participants: c.participants.map((p) => (p.user ? p : { ...p, user: byId.get(p.user_id) ?? p.user })) }
			: c
	);
}
