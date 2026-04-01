"use server";

import { createClient, getUser } from "@/utils/supabase/server";
import { cookies } from "next/headers";
import { Tables } from "@/types/db-schema";
import { fetchUserReports } from "@/app/dashboard/_views/actions/reports";
import {
	AppointmentWithDetails,
	MatchedServiceWithRelations,
	ReportWithRelations,
} from "@/app/dashboard/_types";

export type AggregatedDashboardData = {
	userId: string;
	profile: Tables<"profiles">;
	userType: Tables<"profiles">["user_type"] | null;
	reports: ReportWithRelations[];
	matchedServices: MatchedServiceWithRelations[];
	supportServices: Tables<"support_services">[];
	appointments: AppointmentWithDetails[];
	casesCount: number;
	unreadChatCount: number; // to be filled client-side quickly
	preloaded: boolean;
	verification?: {
		overallStatus: string;
		lastChecked?: string | null;
		documentsCount?: number;
	};
};

export async function fetchDashboardData(): Promise<AggregatedDashboardData | null> {
	try {
		const profile = await getUser();
		if (!profile) {
			console.log("No profile found in fetchDashboardData");
			return null;
		}

		const supabase = await createClient();

		console.log(
			"Fetching dashboard data for user:",
			profile.id,
			"type:",
			profile.user_type
		);

		const userId = profile.id;
		const userType = profile.user_type ?? null;

		const isPro = userType === "professional" || userType === "ngo";

		const supportServicesPromise = isPro
			? supabase
					.from("support_services")
					.select("*")
					.eq("user_id", userId)
					.order("created_at", { ascending: false })
					.then(({ data }) => (data as Tables<"support_services">[]) || [])
			: Promise.resolve([] as Tables<"support_services">[]);

		const reportsPromise = fetchUserReports(userId).catch(
			() => [] as ReportWithRelations[]
		);

		const matchedServicesPromise = (async (): Promise<
			MatchedServiceWithRelations[]
		> => {
			if (!isPro) return [] as MatchedServiceWithRelations[];
			const { data: services } = await supabase
				.from("support_services")
				.select("id")
				.eq("user_id", userId);
			const ids = (services || []).map((s: any) => s.id);

            let query = supabase.from("matched_services").select(`
                *,
                report:reports(*),
                service_details:support_services(*),
                appointments:appointments(*)
            `);

            if (ids.length > 0) {
                query = query.or(`service_id.in.("${ids.join('","')}"),hrd_profile_id.eq."${userId}"`);
            } else {
                query = query.eq("hrd_profile_id", userId);
            }

			const { data } = await query.order("match_date", { ascending: false });
			
			// Backfill matched_service into nested appointments for type compatibility
			const transformedData = data?.map((match: any) => ({
				...match,
				appointments: match.appointments?.map((appt: any) => ({
					...appt,
					matched_service: {
						id: match.id,
						service_details: match.service_details,
						report: match.report,
					},
				})),
			}));

			return (transformedData as MatchedServiceWithRelations[]) || [];
		})();

		const appointmentsPromise = (async (): Promise<AppointmentWithDetails[]> => {
			let query = supabase.from("appointments").select(
				`
      *,
      matched_service:matched_services (
        *,
        service_details:support_services (*),
        report:reports (*)
      ),
      professional:profiles!appointments_professional_id_fkey (*),
      survivor:profiles!appointments_survivor_id_fkey (*)
    `
			);
			if (isPro) {
				// Professionals: include both roles (they may create with themselves)
				query = query.or(`professional_id.eq.${userId},survivor_id.eq.${userId}`);
			} else {
				query = query.eq("survivor_id", userId);
			}
			const { data } = await query;
			return (data as any) || [];
		})();

		const casesCountPromise = (async (): Promise<number> => {
			if (!isPro) return 0;
			const { data: services } = await supabase
				.from("support_services")
				.select("id")
				.eq("user_id", userId);
			const ids = (services || []).map((s: any) => s.id);

            let query = supabase.from("matched_services").select("id", { count: "exact", head: true });
            
            if (ids.length > 0) {
                query = query.or(`service_id.in.("${ids.join('","')}"),hrd_profile_id.eq."${userId}"`);
            } else {
                query = query.eq("hrd_profile_id", userId);
            }

			const { count } = await query;
			return count || 0;
		})();

		const verificationPromise = (async () => {
			try {
				const { data } = await supabase
					.from("profiles")
					.select(
						"verification_status, last_verification_check, accreditation_files_metadata"
					)
					.eq("id", userId)
					.single();
				const metadata = data?.accreditation_files_metadata;
				const docs = metadata
					? Array.isArray(metadata)
						? metadata
						: typeof metadata === 'string'
							? JSON.parse(metadata)
							: metadata
					: [];
				return {
					overallStatus: data?.verification_status || "pending",
					lastChecked: data?.last_verification_check || null,
					documentsCount: (docs || []).length,
				};
			} catch {
				return { overallStatus: "pending", lastChecked: null, documentsCount: 0 };
			}
		})();

		const [
			supportServices,
			reports,
			matchedServices,
			appointments,
			casesCount,
			verification,
		] = await Promise.all([
			supportServicesPromise,
			reportsPromise,
			matchedServicesPromise,
			appointmentsPromise,
			casesCountPromise,
			verificationPromise,
		]);

		const result = {
			userId,
			profile,
			userType,
			reports: (reports as any) || [],
			matchedServices: (matchedServices as any) || [],
			supportServices: supportServices || [],
			appointments: (appointments as any) || [],
			casesCount: casesCount || 0,
			unreadChatCount: 0, // computed on client quickly
			preloaded: true,
			verification,
		};

		// console.log("Dashboard data fetched successfully:", {
		// 	userId: result.userId,
		// 	userType: result.userType,
		// 	reportsCount: result.reports.length,
		// 	supportServicesCount: result.supportServices.length,
		// 	matchedServicesCount: result.matchedServices.length,
		// 	appointmentsCount: result.appointments.length,
		// 	casesCount: result.casesCount,
		// });

		return result;
	} catch (error) {
		console.error("Error in fetchDashboardData:", error);
		return null;
	}
}
