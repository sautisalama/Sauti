import { createClient } from "@/utils/supabase/client";
import { Tables } from "@/types/db-schema";

// Fetch support services for the user
export async function fetchUserSupportServices(
	userId: string
): Promise<Tables<"support_services">[]> {
	const supabase = createClient();

	try {
		const { data: services, error } = await supabase
			.from("support_services")
			.select("*")
			.eq("user_id", userId)
			.order("created_at", { ascending: false });

		if (error) {
			console.error("Error fetching support services:", error);
			throw error;
		}

		return services || [];
	} catch (error) {
		console.error("Error in fetchUserSupportServices:", error);
		throw error;
	}
}

// Delete support service function
export async function deleteSupportService(serviceId: string) {
	const supabase = createClient();

	try {
		const { error } = await supabase
			.from("support_services")
			.delete()
			.eq("id", serviceId);

		if (error) {
			throw error;
		}

		return true;
	} catch (error) {
		console.error("Error deleting support service:", error);
		throw error;
	}
}
