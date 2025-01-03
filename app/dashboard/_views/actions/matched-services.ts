import { createClient } from "@/utils/supabase/client";
import { Tables } from "@/types/db-schema";

export async function fetchMatchedServices(userId: string) {
	const supabase = createClient();
	const serviceIds = await getServiceIdsByUserId(userId);

	const { data, error } = await supabase
		.from("matched_services")
		.select(`
			*,
			report:reports(*),
			support_service:support_services(*)
		`)
		.in("service_id", serviceIds)
		.order("match_date", { ascending: false });

	if (error) throw error;
	return data || [];
}

export async function acceptMatch(matchId: string) {
	const supabase = createClient();

	const { error } = await supabase
		.from("matched_services")
		.update({ match_status_type: "accepted" })
		.eq("id", matchId);

	if (error) throw error;
}

export async function getServiceIdsByUserId(userId: string) {
	const supabase = createClient();

	const { data, error } = await supabase
		.from("support_services")
		.select("id")
		.eq("user_id", userId);

	if (error) throw error;
	return data?.map(service => service.id) || [];
}
