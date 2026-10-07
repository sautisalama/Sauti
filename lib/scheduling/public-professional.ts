import { createAdminClient } from "@/utils/supabase/admin-client";

export interface BookableProfessional {
	id: string;
	first_name: string | null;
	last_name: string | null;
	professional_title: string | null;
	bio: string | null;
	cal_link: string | null;
	out_of_office: boolean;
	services: { id: string; name: string; service_types: string }[];
}

/**
 * Who a visitor may book. The public schedule page and the booking API are used by people who are
 * NOT signed in, and row-level security (correctly) hides profiles from them, so this runs with the
 * service role — but only ever returns a verified, public-booking professional with at least one
 * verified, active service, and only the fields that are safe to show (never email or phone).
 */
export async function getBookableProfessional(idOrSlug: string): Promise<BookableProfessional | null> {
	const id = idOrSlug.startsWith("sauti-") ? idOrSlug.slice(6) : idOrSlug;
	if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
	const admin = createAdminClient();

	const { data: profile } = await admin
		.from("profiles")
		.select("id, first_name, last_name, professional_title, bio, cal_link, is_public_booking, isVerified, is_banned, user_type, out_of_office")
		.eq("id", id)
		.maybeSingle();
	if (!profile || !profile.is_public_booking || !profile.isVerified || profile.is_banned) return null;
	if (profile.user_type !== "professional" && profile.user_type !== "ngo") return null;

	const { data: services } = await admin
		.from("support_services")
		.select("id, name, service_types")
		.eq("user_id", id)
		.eq("verification_status", "verified")
		.eq("is_active", true)
		.eq("is_banned", false);
	if (!services?.length) return null;

	return {
		id: profile.id,
		first_name: profile.first_name,
		last_name: profile.last_name,
		professional_title: profile.professional_title,
		bio: profile.bio,
		cal_link: profile.cal_link,
		out_of_office: !!profile.out_of_office,
		services: services.map((s) => ({ id: s.id, name: s.name, service_types: String(s.service_types) })),
	};
}
