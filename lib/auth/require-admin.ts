import { createClient } from "@/utils/supabase/server";

/**
 * Server-side admin gate for actions and route handlers.
 * RLS enforces the same rule in the database; this gives a clean error (and
 * protects service-role code paths, which bypass RLS).
 */
export async function requireAdmin() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return { ok: false as const, error: "Please sign in." };

	const { data: profile } = await supabase
		.from("profiles")
		.select("id, first_name, last_name, is_admin, is_banned")
		.eq("id", user.id)
		.maybeSingle();
	if (!profile?.is_admin || profile.is_banned) {
		return { ok: false as const, error: "Only administrators can do this." };
	}
	const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || user.email || "Admin";
	return { ok: true as const, supabase, user, name };
}
