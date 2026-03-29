"use server";

import { createClient } from "@/utils/supabase/server";
import { Database } from "@/types/db-schema";
import { SupabaseClient, createClient as createAdminClient } from "@supabase/supabase-js";
import { runSimulation as runSharedSimulation, type SimulationResult } from "@/lib/matching-engine";

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


// ─── Data Fetchers ──────────────────────────────────────────────────────────

export async function getReportedCases() {
    try {
        const { data, error } = await getSupabaseAdmin()
            .from("reports")
            .select("report_id, type_of_incident, submission_timestamp, urgency, ismatched, record_only, first_name, last_name, requires_manual_review")
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
            .select("id, service_id, hrd_profile_id, match_status_type, report_id, is_fallback_match, cascade_level")
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
                hasActiveMatch: profMatches.length > 0,
                fallbackMatchCount: profMatches.filter(m => m.is_fallback_match).length,
                cascadeMatches: profMatches.filter(m => (m.cascade_level ?? 0) > 0).length,
            };
        });

        return professionalStatus;
    } catch (err) {
        console.error("Error in getProfessionalMatchStatus:", err);
        throw err;
    }
}


// ─── Simulation (delegates to shared engine) ────────────────────────────────

/**
 * Runs a simulation of the matching pipeline for a specific report.
 * Uses the shared matching engine's simulation runner.
 *
 * Returns the report and all evaluated candidates with full scoring breakdowns.
 */
export async function simulateMatch(reportId: string) {
    const admin = getSupabaseAdmin();
    const result: SimulationResult = await runSharedSimulation(reportId, admin);

    // Transform for the visualizer's expected format
    return {
        report: result.report,
        candidates: result.candidates.map(c => ({
            cand: {
                id: c.candidate.entity_id,
                type: c.candidate.source_type,
                name: c.candidate.display_name,
                user_id: c.candidate.owner_user_id,
                userId: c.candidate.owner_user_id,
                serviceTypes: c.candidate.service_capabilities,
                profTitle: c.candidate.professional_title,
                lat: c.candidate.latitude,
                lon: c.candidate.longitude,
                radius: c.candidate.coverage_radius_km,
                isRemote: c.candidate.is_remote,
                availability: c.candidate.availability_profile,
                specialisesInDisability: c.candidate.specialises_disability,
                specialisesInQueer: c.candidate.specialises_queer,
                specialisesInChildren: c.candidate.specialises_children,
                matchingTraits: c.candidate.matching_traits,
                owner_first_name: c.candidate.owner_first_name,
                owner_last_name: c.candidate.owner_last_name,
                verified: c.is_verified,
            },
            score: c.score === -Infinity ? -100 : Math.round(c.score),
            reasons: c.reasons,
            bounced: c.is_bounced,
            bounceReason: c.bounce_reason,
            matchStatus: c.existing_match_status,
            isFallback: c.is_fallback,
            breakdown: c.breakdown,
        })),
    };
}


// ─── Cascade Trigger (manual admin action) ──────────────────────────────────

/**
 * Manually triggers the next cascade phase for a report.
 * This is the admin-driven version of the Temporal Cascade Protocol.
 */
export async function triggerCascadePhase(reportId: string) {
    const admin = getSupabaseAdmin();

    // Get current cascade state
    const { data: currentMatches, error } = await admin
        .from("matched_services")
        .select("cascade_level")
        .eq("report_id", reportId)
        .order("cascade_level", { ascending: false })
        .limit(1);

    if (error) throw error;

    const currentLevel = currentMatches?.[0]?.cascade_level ?? 0;
    const nextLevel = Math.min(currentLevel + 1, 5);

    if (nextLevel > 5) {
        return { status: "max_cascade_reached", level: currentLevel };
    }

    // Import and re-run the pipeline at next cascade level
    const { runMatchingPipeline } = await import("@/lib/matching-engine");
    const newMatches = await runMatchingPipeline(reportId, admin, {
        cascade_level: nextLevel,
    });

    return {
        status: "cascade_triggered",
        level: nextLevel,
        new_matches: newMatches.length,
    };
}
