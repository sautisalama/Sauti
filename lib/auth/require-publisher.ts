import { createClient } from "@/utils/supabase/server";

/**
 * Gate for writing blogs and publications. Admins publish directly; professionals
 * and NGOs in good standing write too, but their work goes to an admin for approval.
 * RLS enforces the same limits in the database.
 */
export async function requirePublisher() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return { ok: false as const, error: "Please sign in." };

	const { data: profile } = await supabase
		.from("profiles")
		.select("id, first_name, last_name, is_admin, is_banned, user_type")
		.eq("id", user.id)
		.maybeSingle();
	const isAdmin = !!profile?.is_admin;
	const canWrite = isAdmin || profile?.user_type === "professional" || profile?.user_type === "ngo";
	if (!profile || profile.is_banned || !canWrite) {
		return { ok: false as const, error: "Only professionals, organisations and administrators can write posts." };
	}
	const name = [profile.first_name, profile.last_name].filter(Boolean).join(" ") || user.email || "A member";
	return { ok: true as const, supabase, user, name, isAdmin };
}
