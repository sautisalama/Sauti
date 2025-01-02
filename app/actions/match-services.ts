import { createClient } from "@/utils/supabase/server";
import { Database } from "@/types/db-schema";

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
 * @returns Array of matched services with their distances
 */
export async function matchReportWithServices(reportId: string) {
	const supabase = await createClient();

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

		const requiredServices = Array.isArray(report.required_services)
			? report.required_services
			: [];

		console.log("Required services:", requiredServices);

		// First, filter services by type match
		const matchingServices = services.filter((service) => {
			const serviceTypes = service.service_types
				.split(",")
				.map((s: string) => s.trim().toLowerCase());
			console.log(`Checking service ${service.id}:`, {
				serviceTypes,
				requiredServices,
				isMatch: requiredServices.some((required: string) =>
					serviceTypes.includes(required.toLowerCase())
				),
			});
			return requiredServices.some((required: string) =>
				serviceTypes.includes(required.toLowerCase())
			);
		});

		console.log("Services after type matching:", matchingServices.length);

		// Then, calculate distances for matching services
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
				console.log(`Distance for service ${service.id}:`, distance, "km");
			} else {
				console.log(`Missing coordinates for service ${service.id}`);
			}

			return {
				service,
				distance,
			};
		});

		// Sort by distance and take the top 5 closest matches
		const closestMatches = servicesWithDistances
			.sort((a, b) => a.distance - b.distance)
			.slice(0, 5);

		console.log("Final closest matches:", closestMatches);

		// Insert matches into matched_services table
		if (closestMatches.length > 0) {
			const matches = closestMatches.map((match) => ({
				report_id: reportId,
				service_id: match.service.id,
				match_date: new Date().toISOString(),
				match_score:
					match.distance === Infinity ? 0 : 100 - Math.min(match.distance, 100),
				match_status_type: "pending",
				description: report.incident_description,
				feedback: null,
				notes: null,
				support_service: match.service.name,
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
		} else {
			console.log("No matching services found for report:", reportId);
		}

		return closestMatches;
	} catch (error) {
		console.error("Error in matchReportWithServices:", error);
		throw error;
	}
}
