"use server";

import { createClient } from "@/utils/supabase/server";
import { Database } from "@/types/db-schema";
import { SupabaseClient, createClient as createAdminClient } from "@supabase/supabase-js";
import { Tables } from "@/types/db-schema";

let _supabaseAdmin: SupabaseClient<Database> | null = null;

function getSupabaseAdmin(): SupabaseClient<Database> {
    if (_supabaseAdmin) return _supabaseAdmin;
    
    _supabaseAdmin = createAdminClient<Database>(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY!,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
                detectSessionInUrl: false
            }
        }
    );
    return _supabaseAdmin;
}


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

const AVAILABILITY_SCORE: Record<string, Record<string, number>> = {
	"24/7": { high: 10, medium: 8, low: 5 },
	"weekdays_extended": { high: 6, medium: 10, low: 8 },
	"weekdays_9_5": { high: 3, medium: 8, low: 10 },
	"weekends": { high: 4, medium: 6, low: 8 },
	"flexible": { high: 7, medium: 8, low: 8 },
	"by_appointment": { high: 1, medium: 5, low: 8 },
};

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const R = 6371;
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

export async function getReportedCases() {
    try {
        const { data, error } = await getSupabaseAdmin()
            .from("reports")
            .select("report_id, type_of_incident, submission_timestamp, urgency, ismatched, record_only, first_name, last_name")
            .order("submission_timestamp", { ascending: false })
            .limit(50);

        if (error) {
            console.error("Failed to fetch reports:", error);
            throw new Error(error.message);
        }
        
        return data || [];
    } catch (err) {
        console.error("Error in getReportedCases:", err);
        throw err;
    }
}

export async function getProfessionalMatchStatus() {
    try {
        // 1. Fetch all professional profiles
        const { data: profiles, error: profileError } = await getSupabaseAdmin()
            .from("profiles")
            .select("id, first_name, last_name, professional_title, verification_status, out_of_office")
            .eq("user_type", "professional")
            .order("first_name", { ascending: true });

        if (profileError) throw profileError;

        // 2. Fetch all services for these professionals
        const { data: services, error: serviceError } = await getSupabaseAdmin()
            .from("support_services")
            .select("id, user_id, name, service_types, verification_status")
            .in("user_id", profiles.map(p => p.id));

        if (serviceError) throw serviceError;

        // 3. Fetch all active matches
        const { data: matches, error: matchError } = await getSupabaseAdmin()
            .from("matched_services")
            .select("id, service_id, hrd_profile_id, match_status_type, report_id")
            .not("match_status_type", "in", "(declined,completed,cancelled)");

        if (matchError) throw matchError;

        // 4. Combine data
        const professionalStatus = profiles.map(profile => {
            const profServices = (services || []).filter(s => s.user_id === profile.id);
            const profMatches = (matches || []).filter(m => 
                profServices.some(s => s.id === m.service_id) || 
                m.hrd_profile_id === profile.id
            );

            return {
                id: profile.id,
                name: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Anonymous',
                title: profile.professional_title,
                verification: profile.verification_status,
                outOfOffice: profile.out_of_office,
                services: profServices.map(s => ({
                    id: s.id,
                    name: s.name,
                    types: [s.service_types],
                    verification: s.verification_status
                })),
                matchCount: profMatches.length,
                hasActiveMatch: profMatches.length > 0
            };
        });

        return professionalStatus;
    } catch (err) {
        console.error("Error in getProfessionalMatchStatus:", err);
        throw err;
    }
}


export async function simulateMatch(reportId: string) {
    // 1. Fetch Report Data
    const { data: report, error: reportError } = await getSupabaseAdmin()
        .from("reports")
        .select("*")
        .eq("report_id", reportId)
        .single();

    if (reportError || !report) throw new Error("Failed to fetch report");

    let additionalInfo: Record<string, any> = {};
    if (report.additional_info) {
        additionalInfo = typeof report.additional_info === 'string' 
            ? JSON.parse(report.additional_info) 
            : (report.additional_info as Record<string, any>);
    }

    // 2. Fetch Candidates
    const { data: services } = await getSupabaseAdmin()
        .from("support_services")
        .select("*, profile:profiles!support_services_user_id_fkey(*)")
        .eq("is_active", true)
        .eq("is_banned", false)
        .eq("is_permanently_suspended", false);

    const { data: standaloneProfiles } = await getSupabaseAdmin()
        .from("profiles")
        .select("*")
        .in("professional_title", ["Human rights defender", "Paralegal"]);

    const providerUserIds = new Set((services || []).filter(s => s.verification_status === "verified").map(s => s.user_id).filter(Boolean));
    const activeStandaloneProfiles = (standaloneProfiles || []).filter(p => p.verification_status === "verified" && !providerUserIds.has(p.id));

    // Also get unverified for visualization bounce
    const unverifiedServices = (services || []).filter(s => s.verification_status !== "verified");
    
    const verifiedServices = (services || []).filter(s => s.verification_status === "verified");

    const candidates = [
        ...verifiedServices.map(s => ({
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
            owner_first_name: (s as any).profile?.first_name,
            owner_last_name: (s as any).profile?.last_name,
            verified: true
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
            owner_first_name: p.first_name,
            owner_last_name: p.last_name,
            verified: true
        })),
        ...unverifiedServices.map(s => ({
            type: 'unverified' as const,
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
            owner_first_name: (s as any).profile?.first_name,
            owner_last_name: (s as any).profile?.last_name,
            verified: false
        }))
    ];

    const isChildCase = report.type_of_incident === 'child_abuse' || report.type_of_incident === 'child_labor';
    const reportAgeHours = (new Date().getTime() - new Date(report.submission_timestamp!).getTime()) / (1000 * 60 * 60);
    const isOldReport = reportAgeHours > 24;

    // Simulate existing matched services to visualize connected accepted ones
    const { data: existingMatches } = await getSupabaseAdmin()
        .from("matched_services")
        .select("service_id, hrd_profile_id, match_status_type")
        .eq("report_id", reportId);

    const matchedServiceIds = new Map();
    existingMatches?.forEach((m: any) => {
        const id = m.service_id || m.hrd_profile_id;
        if (id) matchedServiceIds.set(id, m.match_status_type);
    });

    const evaluatedCandidates = await Promise.all(candidates.map(async (cand) => {
        let score = 0;
        const reasons: string[] = [];
        let bounced = false;
        let bounceReason = "";

        if (!cand.verified) {
            bounced = true;
            bounceReason = "Unverified service provider";
            return { cand, score: 0, reasons, bounced, bounceReason, matchStatus: null };
        }

        const requiredBySurvivor = (report.required_services as string[]) || [];
        const mapping = INCIDENT_SPECIALTY_MAP[report.type_of_incident || 'other'];
        
        const matchedTypes = cand.serviceTypes.filter((t: any) => 
            mapping?.primary.includes(t) || 
            mapping?.secondary.includes(t) || 
            requiredBySurvivor.includes(t)
        );

        if (matchedTypes.length === 0 && report.type_of_incident !== 'other') {
            bounced = true;
            bounceReason = "No relevant specialty match";
            return { cand, score: -100, reasons, bounced, bounceReason, matchStatus: null };
        }

        if (cand.serviceTypes.some((t: any) => mapping?.primary.includes(t))) {
            score += 25; reasons.push("Primary specialty rules (+25)");
        } else if (cand.serviceTypes.some((t: any) => mapping?.secondary.includes(t))) {
            score += 15; reasons.push("Secondary specialty (+15)");
        }
        
        if (cand.serviceTypes.some((t: any) => requiredBySurvivor.includes(t))) {
            score += 20; reasons.push("Requested by survivor (+20)");
        }

        if (report.latitude && report.longitude && cand.lat && cand.lon && !cand.isRemote) {
            const dist = calculateDistance(report.latitude, report.longitude, cand.lat, cand.lon);
            const radius = cand.radius || 50;

            if (dist <= radius) {
                const distScore = Math.max(0, 20 * (1 - dist / radius));
                score += distScore;
                reasons.push(`Proximity score (+${Math.round(distScore)})`);
            } else if (isOldReport) {
                score += 5; reasons.push(`Outside area relaxation (+5)`);
            } else {
                score -= 10; reasons.push("Outside regular service area (-10)");
            }
        } else if (cand.isRemote) {
            score += 15; reasons.push("Remote service available (+15)");
        }

        if (cand.profTitle && report.type_of_incident) {
            const authority = PROFESSIONAL_AUTHORITY[cand.profTitle]?.[report.type_of_incident] || 0;
            if (authority > 0) {
                score += authority;
                reasons.push(`Professional authority (+${authority})`);
            }
        }

        const urgency = (report.urgency || 'medium') as 'high' | 'medium' | 'low';
        const availKey = cand.availability || 'flexible';
        const availScore = AVAILABILITY_SCORE[availKey]?.[urgency] || 5;
        score += availScore; reasons.push(`Availability score (+${availScore})`);

        if (additionalInfo.special_needs?.disabled && cand.specialisesInDisability) {
            score += 15; reasons.push("Disability specialist (+15)");
        }
        
        if (report.preferred_language && cand.matchingTraits.languages?.includes(report.preferred_language)) {
            score += 15; reasons.push("Language match (+15)");
        }
        
        if (report.consent === 'no' && !isChildCase && (cand.profTitle === 'Lawyer' || cand.profTitle === 'Law firm')) {
            bounced = true;
            bounceReason = "Legal Consent Withheld (-100 penalty)";
            score -= 100; 
        }

        if (urgency === 'high') score *= 1.2;
        else if (urgency === 'medium') score *= 1.1;

        const matchStatus = matchedServiceIds.get(cand.id) || null;
        
        if (score < 10 && !bounced) {
             bounced = true;
             bounceReason = `Score too low (${Math.round(score)} < 10)`;
        }

        return { cand, score: Math.round(score), reasons, bounced, bounceReason, matchStatus };
    }));

    return {
        report,
        candidates: evaluatedCandidates.sort((a,b) => b.score - a.score).slice(0, 20) // Limit to top 20 for UI
    };
}
