import { createClient } from "@/utils/supabase/server";
import { Database } from "@/types/db-schema";
import { SupabaseClient } from "@supabase/supabase-js";
import { sendNotification } from "@/lib/notifications";
import {
	matchFoundProfessionalEmail,
	matchFoundSurvivorEmail,
} from "@/lib/notifications/templates";

type SupportService = Database["public"]["Tables"]["support_services"]["Row"];
type Report = Database["public"]["Tables"]["reports"]["Row"];

/**
 * Calculates the distance between two points using the Haversine formula
 * @param lat1 Latitude of first point
 * @param lon1 Longitude of first point
 * @param lat2 Latitude of second point
 * @param lon2 Longitude of second point
 * @returns Distance in kilometers
 */
function calculateDistance(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number
): number {
	const R = 6371; // Earth's radius in kilometers
	const dLat = (lat2 - lat1) * (Math.PI / 180);
	const dLon = (lon2 - lon1) * (Math.PI / 180);
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(lat1 * (Math.PI / 180)) *
			Math.cos(lat2 * (Math.PI / 180)) *
			Math.sin(dLon / 2) *
			Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	return R * c;
}


/**
 * Matches a report with appropriate support services based on service types and location
 * @param reportId The ID of the report to match
 * @param customClient Optional Supabase client (e.g. admin client) to use
 * @returns Array of matched services with their distances
 */
export async function matchReportWithServices(reportId: string, customClient?: SupabaseClient<Database>) {
	const supabase = customClient || await createClient();

	try {
		// Fetch the report with required services
		const { data: report, error: reportError } = await supabase
			.from("reports")
			.select("*")
			.eq("report_id", reportId)
			.single();

		if (reportError || !report) {
			console.error("Report fetch error:", reportError);
			throw new Error("Failed to fetch report");
		}

		// Fetch all support services
		const { data: services, error: servicesError } = await supabase
			.from("support_services")
			.select("*");

		if (servicesError || !services) {
			console.error("Services fetch error:", servicesError);
			throw new Error("Failed to fetch support services");
		}

		// Fetch profiles for service owners to check verification completeness
		const userIds = Array.from(new Set(services.map(s => s.user_id).filter(Boolean))) as string[];
		const profilesById = new Map<string, { first_name: string | null; phone: string | null; professional_title: string | null }>();
		if (userIds.length > 0) {
			const { data: profiles, error: profileErr } = await supabase
				.from("profiles")
				.select("id, first_name, phone, professional_title")
				.in("id", userIds);
			if (!profileErr && profiles) {
				profiles.forEach((p: any) => profilesById.set(p.id, p));
			}
		}
		const isVerified = (userId: string | null) => {
			if (!userId) return false;
			const p = profilesById.get(userId);
			if (!p) return false;
			return Boolean(p.first_name && p.phone && p.professional_title);
		};

		// Ensure required_services is properly typed and handled
		const requiredServices = (report.required_services as string[]) || [];

		// First, filter services by type match AND only include verified providers
		const matchingServices = services.filter((service) => {
			const serviceType = service.service_types;
			const typeMatch = requiredServices.some((required: string) => serviceType === required);
			return typeMatch && isVerified(service.user_id);
		});

		// Then, calculate distances and scores for matching services
		const servicesWithDistances = matchingServices.map((service) => {
			let distance = Infinity;

			if (
				report.latitude &&
				report.longitude &&
				service.latitude &&
				service.longitude
			) {
				distance = calculateDistance(
					report.latitude,
					report.longitude,
					service.latitude,
					service.longitude
				);
			}

			// Scoring: base for type match + proximity + availability, scaled by urgency
			const radius = Number(service.coverage_area_radius) || 50;
			const distanceScore = isFinite(distance)
				? Math.max(0, 20 * (1 - Math.min(distance / radius, 1)))
				: 0;
			const availabilityBonus = /24\/7|open|available|always/i.test(service.availability || "")
				? 10
				: 0;
			const base = 60; // service type match
			const urgencyMult = report.urgency === "high" ? 1.15 : report.urgency === "medium" ? 1.05 : 1.0;
			const score = Math.round((base + distanceScore + availabilityBonus) * urgencyMult);

			return {
				service,
				distance,
				score,
			};
		});

		// Sort by score desc (then by distance asc) and take top 5
		const closestMatches = servicesWithDistances
			.sort((a, b) => (b.score - a.score) || (a.distance - b.distance))
			.slice(0, 5);

		// Update the report's match status
		if (closestMatches.length > 0) {
			const { error: updateError } = await supabase
				.from("reports")
				.update({
					ismatched: true,
					match_status:
						"pending" as Database["public"]["Enums"]["match_status_type"],
				})
				.eq("report_id", reportId);

			if (updateError) {
				console.error("Report update error:", updateError);
			}

			const matches = closestMatches.map((match) => ({
				report_id: reportId,
				service_id: match.service.id,
				match_date: new Date().toISOString(),
				match_score: match.score,
				match_status_type:
					"pending" as Database["public"]["Enums"]["match_status_type"],
				description: report.incident_description,
				feedback: null,
				notes: null,
				support_service: match.service.service_types, // Use the enum type directly
				survivor_id: report.user_id,
				updated_at: new Date().toISOString(),
			}));

			const { error: matchError } = await supabase
				.from("matched_services")
				.insert(matches);

			if (matchError) {
				console.error("Match insert error:", matchError);
				throw new Error("Failed to insert matches");
			}

			// --- SEND NOTIFICATIONS ---
			// 1. Notify each matched Professional
			for (const match of closestMatches) {
				if (match.service.user_id) {
					await sendNotification({
						userId: match.service.user_id,
						type: "match_found", // Or 'new_referral'
						title: "New Case Assignment",
						message: `You have been matched with a new case requiring ${match.service.service_types} services.`,
						link: "/dashboard/cases",
						metadata: {
							report_id: reportId,
							service_id: match.service.id,
						},
						sendEmail: true,
						emailHtml: matchFoundProfessionalEmail(match.service.service_types),
					});
				}
			}

			// 2. Notify the Survivor (User) - Send ONE summary notification
			if (report.user_id) {
				const primaryMatch = closestMatches[0];
				await sendNotification({
					userId: report.user_id,
					type: "match_found",
					title: "Match Found",
					message: `We have matched you with verified professionals for your request. View the details in your dashboard.`,
					link: "/dashboard/cases", // Or /dashboard/reports?
					metadata: { report_id: reportId },
					sendEmail: true,
					emailHtml: matchFoundSurvivorEmail(
						primaryMatch.service.name || "a verified professional",
						primaryMatch.service.service_types
					),
				});
			}
		}

		return closestMatches;
	} catch (error) {
		console.error("Error in matchReportWithServices:", error);
		throw error;
	}
}
