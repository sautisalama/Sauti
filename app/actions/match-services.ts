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
type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/**
 * INCIDENT TO SPECIALTY MAPPING
 * Maps incident types to primary and secondary support specialties.
 * Used to focus initial matching on the most relevant providers.
 */
const INCIDENT_SPECIALTY_MAP: Record<string, { primary: string[]; secondary: string[] }> = {
	physical: { primary: ["medical", "legal"], secondary: ["mental_health", "shelter"] },
	emotional: { primary: ["mental_health"], secondary: ["legal", "shelter"] },
	sexual: { primary: ["medical", "mental_health", "legal"], secondary: ["shelter"] },
	financial: { primary: ["legal", "financial_assistance"], secondary: ["mental_health"] },
	child_abuse: { primary: ["legal", "medical"], secondary: ["mental_health", "shelter", "child_protection"] },
	child_labor: { primary: ["legal", "child_protection"], secondary: ["mental_health", "shelter"] },
	neglect: { primary: ["medical", "mental_health"], secondary: ["shelter", "legal", "child_protection"] },
	trafficking: { primary: ["legal", "police_reporting"], secondary: ["shelter", "mental_health"] },
	stalking: { primary: ["legal", "police_reporting"], secondary: ["mental_health"] },
	cyber: { primary: ["legal"], secondary: ["mental_health"] },
	racial: { primary: ["legal"], secondary: ["mental_health"] },
	other: { primary: [], secondary: [] },
};

/**
 * PROFESSIONAL AUTHORITY SCORING
 * Boosts matching scores based on the professional's title and the incident type.
 * Higher values indicate higher expertise/authority for that specific incident.
 */
const PROFESSIONAL_AUTHORITY: Record<string, Record<string, number>> = {
	"Doctor": { physical: 10, sexual: 10, child_abuse: 8, emotional: 3, neglect: 8 },
	"Mental health expert": { emotional: 10, sexual: 8, physical: 5, child_abuse: 5, stalking: 5 },
	"Lawyer": { child_abuse: 10, child_labor: 10, financial: 10, physical: 8, sexual: 8, trafficking: 10, stalking: 10, cyber: 10, racial: 10 },
	"Paralegal": { financial: 6, physical: 4, emotional: 4, child_labor: 6 },
	"Human rights defender": { child_abuse: 8, child_labor: 8, other: 8, emotional: 6, physical: 4, trafficking: 8, racial: 8 },
	"Law firm": { child_abuse: 10, financial: 10, sexual: 8, child_labor: 10 },
	"Rescue Center": { child_abuse: 8, physical: 8, sexual: 6, child_labor: 8, shelter: 10 },
	"Hospital/Clinic": { physical: 10, sexual: 10, child_abuse: 8 },
	"Local NGO": { emotional: 6, financial: 6, other: 8 },
};

/**
 * AVAILABILITY SCORING MATRIX
 * Weights availability profiles based on the urgency of the report.
 */
const AVAILABILITY_SCORE: Record<string, Record<string, number>> = {
	"24/7": { high: 10, medium: 8, low: 5 },
	"weekdays_extended": { high: 6, medium: 10, low: 8 },
	"weekdays_9_5": { high: 3, medium: 8, low: 10 },
	"weekends": { high: 4, medium: 6, low: 8 },
	"flexible": { high: 7, medium: 8, low: 8 },
	"by_appointment": { high: 1, medium: 5, low: 8 },
};

/**
 * Calculates the distance between two points using the Haversine formula
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
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
 * Matches a report with appropriate support services.
 */
export async function matchReportWithServices(reportId: string, customClient?: SupabaseClient<Database>) {
	const supabase = customClient || await createClient();

	try {
		// 1. Fetch Report Data
		const { data: report, error: reportError } = await supabase
			.from("reports")
			.select("*")
			.eq("report_id", reportId)
			.single();

		if (reportError || !report) {
			console.error("Report fetch error:", reportError);
			throw new Error("Failed to fetch report");
		}

		// Pre-filter: Skip record-only matches unless it's child abuse/labor
		const isChildCase = report.type_of_incident === 'child_abuse' || report.type_of_incident === 'child_labor';
		if (report.record_only && !isChildCase) {
			console.log(`Skipping matching for record-only report ${reportId}`);
			return [];
		}

		// Parse additional_info
		let additionalInfo: any = {};
		try {
			if (report.additional_info) {
				additionalInfo = typeof report.additional_info === 'string' 
					? JSON.parse(report.additional_info) 
					: report.additional_info;
			}
		} catch (e) {
			console.warn("Failed to parse additional_info:", e);
		}

		// 2. Fetch All Eligible Providers
		// We fetch: verified support services AND verified standalone professionals (HRDs and Paralegals)
		
		// Get all verified support services
		const { data: services, error: servicesError } = await supabase
			.from("support_services")
			.select("*, profile:profiles!support_services_user_id_fkey(*)")
			.eq("is_active", true)
			.eq("is_banned", false)
			.eq("is_permanently_suspended", false)
			.eq("verification_status", "verified");

		if (servicesError) throw servicesError;

		// Get all verified standalone profiles (those with specific clinical titles)
		const { data: standaloneProfiles, error: standaloneError } = await supabase
			.from("profiles")
			.select("*")
			.in("professional_title", ["Human rights defender", "Paralegal"])
			.eq("verification_status", "verified");

		if (standaloneError) throw standaloneError;

		const providerUserIds = new Set((services || []).map(s => s.user_id).filter(Boolean));
		const activeStandaloneProfiles = (standaloneProfiles || []).filter(p => !providerUserIds.has(p.id));

		// Merge into a common matching structure
		const candidates = [
			...(services || []).map(s => ({
				type: 'service' as const,
				id: s.id,
				name: s.name,
				userId: s.user_id,
				serviceTypes: [s.service_types],
				profTitle: (s as any).profile?.professional_title,
				lat: s.latitude,
				lon: s.longitude,
				radius: s.coverage_area_radius || 50,
				isRemote: s.coverage_area_radius === null,
				availability: s.availability,
				specialisesInDisability: (s as any).specialises_in_disability || false,
				specialisesInQueer: (s as any).specialises_in_queer_support || false,
				specialisesInChildren: (s as any).specialises_in_children || false,
				matchingTraits: ((s as any).profile?.settings as any)?.matching_traits || {},
				bio: (s as any).profile?.bio || null,
				city: (s as any).profile?.city || null,
				country: (s as any).profile?.country || null
			})),
			...activeStandaloneProfiles.map(p => ({
				type: 'profile' as const,
				id: p.id,
				name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.professional_title || 'Expert',
				userId: p.id,
				serviceTypes: p.professional_title === "Paralegal" ? ["legal"] : ["other"], 
				profTitle: p.professional_title,
				lat: (p as any).latitude || null,
				lon: (p as any).longitude || null,
				radius: p.professional_title === "Paralegal" ? 60 : 100, 
				isRemote: false,
				availability: "flexible",
				specialisesInDisability: false,
				specialisesInQueer: false,
				specialisesInChildren: p.professional_title === "Human rights defender", 
				matchingTraits: (p.settings as any)?.matching_traits || {},
				bio: p.bio || null,
				city: (p as any).city || null,
				country: (p as any).country || null
			}))
		];

		// Check if report is "old" (more than 24h) or force matching
		const reportAgeHours = (new Date().getTime() - new Date(report.submission_timestamp!).getTime()) / (1000 * 60 * 60);
		const isOldReport = reportAgeHours > 24;

		// 3. Scoring
		const results = await Promise.all(candidates.map(async (cand) => {
			let score = 0;
			const matchReasons: string[] = [];

			// A. Service Type Matching
			const requiredBySurvivor = (report.required_services as string[]) || [];
			const mapping = INCIDENT_SPECIALTY_MAP[report.type_of_incident || 'other'];
			
			const matchedTypes = cand.serviceTypes.filter(t => 
				mapping?.primary.includes(t) || 
				mapping?.secondary.includes(t) || 
				requiredBySurvivor.includes(t)
			);

			if (matchedTypes.length === 0 && report.type_of_incident !== 'other') {
				// Hard filter: MUST provide at least one relevant service
				return { cand, score: -100, reasons: [] };
			}

			const isPrimary = cand.serviceTypes.some(t => mapping?.primary.includes(t));
			const isSecondary = cand.serviceTypes.some(t => mapping?.secondary.includes(t));
			const isExplicitlyRequested = cand.serviceTypes.some(t => requiredBySurvivor.includes(t));

			if (isPrimary) {
				score += 25;
				matchReasons.push(`Primary specialty for ${report.type_of_incident}`);
			} else if (isSecondary) {
				score += 15;
				matchReasons.push(`Secondary specialty for ${report.type_of_incident}`);
			}
			
			if (isExplicitlyRequested) {
				score += 20;
				matchReasons.push("Requested by survivor");
			}

			// B. Distance Scoring & Relaxation
			if (report.latitude && report.longitude && cand.lat && cand.lon && !cand.isRemote) {
				const dist = calculateDistance(report.latitude, report.longitude, cand.lat, cand.lon);
				const radius = cand.radius || 50;

				if (dist <= radius) {
					const distScore = Math.max(0, 20 * (1 - dist / radius));
					score += distScore;
					if (distScore > 15) matchReasons.push("Very close proximity");
				} else if (isOldReport) {
					// Relaxed distance for old reports: don't penalize, just don't give bonus
					matchReasons.push(`Available (Distance: ${Math.round(dist)}km)`);
					score += 5; // Small consolation bonus for being available even if far
				} else {
					// Far away: small penalty if not old
					score -= 10;
					matchReasons.push("Outside regular service area");
				}
			} else if (cand.isRemote) {
				score += 15;
				matchReasons.push("Remote service available");
			}

			// C. Professional Authority
			if (cand.profTitle && report.type_of_incident) {
				const authority = PROFESSIONAL_AUTHORITY[cand.profTitle]?.[report.type_of_incident] || 0;
				score += authority;
				if (authority >= 8) matchReasons.push(`Expert in ${report.type_of_incident}`);
			}

			// D. Availability
			const urgency = (report.urgency || 'medium') as 'high' | 'medium' | 'low';
			const availKey = cand.availability || 'flexible';
			const availScore = AVAILABILITY_SCORE[availKey]?.[urgency] || 5;
			score += availScore;

			// E. Special Needs
			if (additionalInfo.special_needs?.disabled && cand.specialisesInDisability) {
				score += 15;
				matchReasons.push("Disability specialist");
			}
			if (additionalInfo.special_needs?.queer_support && cand.specialisesInQueer) {
				score += 15;
				matchReasons.push("Queer support specialist");
			}
			
			// F. Language and Gender Matching
			if (report.preferred_language && cand.matchingTraits.languages) {
				if (cand.matchingTraits.languages.includes(report.preferred_language)) {
					score += 15;
					matchReasons.push(`Matches preferred language (${report.preferred_language})`);
				}
			}
			
			if (report.gender && cand.matchingTraits.gender) {
				if (cand.matchingTraits.gender === report.gender) {
					score += 10;
					matchReasons.push(`Matches gender preference`);
				}
			}

			// G. Consent
			if (report.consent === 'no' && !isChildCase && (cand.profTitle === 'Lawyer' || cand.profTitle === 'Law firm')) {
				score -= 100; // Hard filter for no legal consent
			}

			// H. Load Balancing & Freshness
			if (cand.userId) {
				const { data: caseCount } = await supabase.rpc('get_active_case_count', { provider_user_id: cand.userId });
				if (typeof caseCount === 'number') {
					if (caseCount > 0) {
						score -= (caseCount * 5);
					} else {
						// NEW: Bonus for professionals with NO cases (Lone service/Fresh service)
						score += 20;
						matchReasons.push("High capacity available");
					}
				}
			}

			// I. Urgency Multiplier
			if (urgency === 'high') score *= 1.2;
			else if (urgency === 'medium') score *= 1.1;

			return { cand, score, reasons: matchReasons };
		}));

		// 4. Filter & Select Top Matches
		let finalMatches = results
			.filter(r => r.score >= 10)
			.sort((a, b) => b.score - a.score)
			.slice(0, 5);

		// FALLBACK: If no matches above threshold, but we have candidates with score > 0
		if (finalMatches.length === 0 && results.some(r => r.score > 0)) {
			console.log(`Report ${reportId}: No high-scoring matches. Falling back to best available candidate.`);
			finalMatches = results
				.filter(r => r.score > -50) // Allow some slightly lower scores if they match specialty
				.sort((a, b) => b.score - a.score)
				.slice(0, 3);
			
			if (finalMatches.length > 0) {
				finalMatches[0].reasons.push("Matched as best available provider");
			}
		}

		if (finalMatches.length > 0) {
			await supabase.from("reports").update({
				ismatched: true,
				match_status: "pending"
			}).eq("report_id", reportId);

			const matchInserts = finalMatches.map(m => ({
				report_id: reportId,
				service_id: m.cand.type === 'service' ? m.cand.id : null,
				hrd_profile_id: m.cand.type === 'profile' ? m.cand.id : null,
				match_date: new Date().toISOString(),
				match_score: Math.round(m.score),
				match_status_type: "pending" as any,
				match_reason: m.reasons.join(", "),
				description: (m.cand as any).bio || null,
				notes: [(m.cand as any).city, (m.cand as any).country].filter(Boolean).join(", ") || null,
				escalation_required: isChildCase,
				support_service: (m.cand as any).serviceTypes[0] as any,
				survivor_id: report.user_id,
				updated_at: new Date().toISOString(),
			}));

			const { error: matchError } = await supabase.from("matched_services").insert(matchInserts);
			if (matchError) throw matchError;

			// 5. Notifications
			for (const m of finalMatches) {
				if (m.cand.userId) {
					await sendNotification({
						userId: m.cand.userId,
						type: "match_found",
						title: isChildCase ? "URGENT: Child Case Escalation" : "New Case Assignment",
						message: isChildCase 
							? `Mandatory alert: You have been matched with a child-related case (${report.type_of_incident}).`
							: `You have been matched with a new case requiring ${m.cand.serviceTypes[0]} services.`,
						link: "/dashboard/cases",
						metadata: { report_id: reportId },
						sendEmail: true,
						emailHtml: matchFoundProfessionalEmail(m.cand.serviceTypes[0]),
					});
				}
			}

			if (report.user_id) {
				await sendNotification({
					userId: report.user_id,
					type: "match_found",
					title: "Help is on the way",
					message: `We've matched your report with verified specialists. View them in your dashboard.`,
					link: "/dashboard/cases",
					metadata: { report_id: reportId },
					sendEmail: true,
					emailHtml: matchFoundSurvivorEmail(finalMatches[0].cand.name || "Specialist", finalMatches[0].cand.serviceTypes[0]),
				});
			}
		}



		return finalMatches;

	} catch (error) {
		console.error("Critical matching engine error:", error);
		throw error;
	}
}

/**
 * BACKFILL MATCHING
 * Searches for reports that currently have no matches and attempts to match them.
 * Usually triggered when a new professional or service is verified.
 */
export async function backfillUnmatchedReports() {
	const supabase = await createClient();
	
	try {
		// Find all reports that are not record-only and haven't been matched yet
		const { data: unmatchedReports, error } = await supabase
			.from("reports")
			.select("report_id")
			.eq("ismatched", false)
			.eq("record_only", false);

		if (error) throw error;
		if (!unmatchedReports || unmatchedReports.length === 0) return;

		console.log(`Starting backfill for ${unmatchedReports.length} unmatched reports...`);

		// Process each unmatched report
		// We use a sequential approach to avoid hitting rate limits or overwhelming the DB
		for (const report of unmatchedReports) {
			try {
				await matchReportWithServices(report.report_id);
			} catch (matchErr) {
				console.error(`Backfill failed for report ${report.report_id}:`, matchErr);
			}
		}

		return { processed: unmatchedReports.length };
	} catch (error) {
		console.error("Backfill matching error:", error);
		throw error;
	}
}

/**
 * REVERSE MATCHING (Proactive matching for a professional)
 * Triggered when a professional who has no cases refreshes their dashboard.
 * This finds reports that match this professional's specific services.
 */
export async function matchProfessionalWithUnmatchedReports(professionalUserId: string) {
	const supabase = await createClient();

	try {
		// 1. Check if the professional has verified services
		const { data: services } = await supabase
			.from("support_services")
			.select("id, verification_status")
			.eq("user_id", professionalUserId)
			.eq("verification_status", "verified");

		// Only proceed if professional has verified services
		if (!services || services.length === 0) return { matched: 0 };

		const serviceIds = services.map(s => s.id);

		// 2. Check current active matches (excluding completed ones)
		const { count: activeMatchCount } = await supabase
			.from("matched_services")
			.select("id", { count: 'exact', head: true })
			.in("service_id", serviceIds)
			.not("match_status_type", "eq", "completed");

		// Rule: Only proactive match if they have NO cases yet.
		// This is the "Fresh Provider" boost.
		if ((activeMatchCount || 0) > 0) return { status: "has_cases", count: activeMatchCount };

		// 3. Find unmatched reports that are not record-only
		const { data: unmatchedReports } = await supabase
			.from("reports")
			.select("report_id")
			.eq("ismatched", false)
			.eq("record_only", false)
			.order("submission_timestamp", { ascending: false })
			.limit(15); 

		if (!unmatchedReports || unmatchedReports.length === 0) return { status: "no_unmatched_reports" };

		console.log(`[Proactive Matching] Checking ${unmatchedReports.length} reports for professional ${professionalUserId}...`);

		let newlyMatchedCount = 0;
		
		// 4. Run standard matching for each unmatched report
		// The matching engine automatically considers this professional as a candidate
		// and gives them the "High capacity available" bonus we added earlier.
		for (const report of unmatchedReports) {
			try {
				const matches = await matchReportWithServices(report.report_id, supabase);
				// Check if this professional's service was among the final matches
				if (matches && matches.some(m => serviceIds.includes(m.cand.id))) {
					newlyMatchedCount++;
				}
			} catch (err) {
				console.error(`Proactive match failed for report ${report.report_id}:`, err);
			}
		}

		return { status: "success", matched: newlyMatchedCount };
	} catch (error) {
		console.error("Proactive matching critical error:", error);
		throw error;
	}
}

