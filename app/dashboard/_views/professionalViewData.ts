// import { createClient } from "@/utils/supabase/client";
// import { Database } from "@/types/db-schema";

// export type ReportWithRelations =
// 	Database["public"]["Tables"]["reports"]["Row"] & {
// 		matched_services?: Array<{
// 			id: string;
// 			match_status_type: Database["public"]["Enums"]["match_status_type"];
// 			match_date: string | null;
// 			match_score: number | null;
// 			support_services: {
// 				id: string;
// 				name: string;
// 				service_types: Database["public"]["Enums"]["support_service_type"];
// 			};
// 			appointments?: Array<{
// 				id: string;
// 				date: string;
// 				status: Database["public"]["Enums"]["appointment_status_type"] | null;
// 				professional_id: string | null;
// 				survivor_id: string | null;
// 			}>;
// 		}>;
// 	};

// export const fetchProfessionalReports = async (userId: string) => {
// 	const supabase = createClient();
// 	console.log("Fetching reports for professional:", userId);

// 	// First get the professional's support service ID
// 	const { data: professionalProfile } = await supabase
// 		.from("professional_profiles")
// 		.select("*")
// 		.eq("user_id", userId)
// 		.single();

// 	if (!professionalProfile) {
// 		console.error("Professional profile not found");
// 		return [];
// 	}

// 	// Then fetch reports that are matched with this professional's service
// 	const { data, error } = await supabase
// 		.from("reports")
// 		.select(
// 			`
// 			*,
// 			matched_services:matched_services(
// 				id,
// 				match_status_type,
// 				match_date,
// 				match_score,
// 				support_services(
// 					id,
// 					name,
// 					service_types
// 				),
// 				appointments(
// 					id,
// 					date,
// 					status,
// 					professional_id,
// 					survivor_id
// 				)
// 			)
// 		`
// 		)
// 		.eq("matched_services.support_services.id", professionalProfile.id)
// 		.order("created_at", { ascending: false });

// 	if (error) {
// 		console.error("Error fetching reports:", error);
// 		return [];
// 	}

// 	// Process appointments if needed
// 	if (data && data.length > 0) {
// 		const reportsWithAppointments = data.map((report) => ({
// 			...report,
// 			matched_services: report.matched_services?.map((service) => ({
// 				...service,
// 				appointments: service.appointments?.sort(
// 					(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
// 				),
// 			})),
// 		}));

// 		console.log("Reports with appointments:", reportsWithAppointments);
// 		return reportsWithAppointments;
// 	}

// 	console.log("Fetched reports:", data);
// 	return data || [];
// };
