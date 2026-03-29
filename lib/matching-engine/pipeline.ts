/**
 * Matching Engine — Pipeline Orchestrator
 *
 * Entry point for the complete 10-stage matching pipeline.
 * Handles pre-flight checks, candidate building, scoring, selection,
 * persistence, and notification dispatch.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/db-schema';

import {
  MatchResult,
  MatchingContext,
  MatchingPipelineOptions,
  ParsedAdditionalInfo,
  Report,
  SimulationCandidate,
  SimulationResult,
  UrgencyType,
  CandidateObject,
} from './types';

import { buildCandidatePool } from './candidate-builder';
import { scoreCandidate, selectTopCandidates } from './scoring';


// ─── Context Builder ────────────────────────────────────────────────────────

/**
 * Builds a MatchingContext from a report record.
 */
export function buildMatchingContext(report: Report): MatchingContext {
  // Parse additional_info
  let additionalInfo: ParsedAdditionalInfo = {};
  try {
    if (report.additional_info) {
      additionalInfo = typeof report.additional_info === 'string'
        ? JSON.parse(report.additional_info)
        : (report.additional_info as unknown as ParsedAdditionalInfo);
    }
  } catch {
    // Fail safe — empty additional_info
  }

  const incidentType = report.type_of_incident || 'other';
  const isChildCase = incidentType === 'child_abuse' || incidentType === 'child_labor';
  const reportAge = report.submission_timestamp
    ? (Date.now() - new Date(report.submission_timestamp).getTime()) / (1000 * 60 * 60)
    : 0;

  return {
    report,
    additional_info: additionalInfo,
    is_child_case: isChildCase,
    report_age_hours: reportAge,
    is_temporally_relaxed: reportAge > 24,
    required_services: (report.required_services as string[] | null) || [],
    incident_type: incidentType,
    urgency: (report.urgency || 'medium') as UrgencyType,
  };
}


// ─── Active Case Count Fetcher ──────────────────────────────────────────────

/**
 * Fetches the count of truly active cases for a candidate.
 */
async function getActiveCaseCount(
  supabase: SupabaseClient<Database>,
  candidate: CandidateObject,
): Promise<number> {
  const { data: activeCases } = await supabase
    .from('matched_services')
    .select('id, feedback, match_status_type')
    .or(`service_id.eq.${candidate.entity_id},hrd_profile_id.eq.${candidate.entity_id}`)
    .not('match_status_type', 'eq', 'declined')
    .not('match_status_type', 'eq', 'completed')
    .not('match_status_type', 'eq', 'cancelled');

  // Filter out cases where the professional has marked completion
  const trulyActive = (activeCases || []).filter(m => {
    try {
      if (m.feedback && typeof m.feedback === 'object') {
        return !(m.feedback as Record<string, unknown>).is_prof_complete;
      }
      if (m.feedback && typeof m.feedback === 'string' && (m.feedback as string).startsWith('{')) {
        const parsed = JSON.parse(m.feedback as string);
        return !parsed.is_prof_complete;
      }
    } catch { /* ignore parse errors */ }
    return true;
  });

  return trulyActive.length;
}


// ─── Main Pipeline ──────────────────────────────────────────────────────────

/**
 * Runs the full matching pipeline for a report.
 *
 * Stage 0: Pre-flight checks
 * Stage 1: Candidate aggregation
 * Stage 2–9: Scoring
 * Stage 10: Selection & persistence
 *
 * @returns Array of selected MatchResult (or empty if no matches / pre-flight fails)
 */
export async function runMatchingPipeline(
  reportId: string,
  supabase: SupabaseClient<Database>,
  options: MatchingPipelineOptions = {},
): Promise<MatchResult[]> {
  const cascadeLevel = options.cascade_level ?? 0;
  const maxMatches = options.max_matches ?? 5;

  // ─── Stage 0: Pre-flight Checks ───────────────────────────────────────────

  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select('*')
    .eq('report_id', reportId)
    .single();

  if (reportError || !report) {
    console.error('Matching pipeline: Report fetch error', reportError);
    throw new Error('Failed to fetch report');
  }

  const context = buildMatchingContext(report);

  // Pre-flight: Record-Only Gate (exceptions for child cases per spec)
  if (report.record_only && !context.is_child_case) {
    console.log(`[Matching] Skipping record-only report ${reportId}`);
    return [];
  }

  // Pre-flight: Already-Matched Gate (no duplicate matching)
  if (report.ismatched && cascadeLevel === 0) {
    // Only block at cascade level 0 — higher levels may be re-matching
    console.log(`[Matching] Report ${reportId} already matched at cascade level 0, skipping`);
    return [];
  }

  // ─── Stage 1: Candidate Aggregation ───────────────────────────────────────

  const { verified: candidates } = await buildCandidatePool(supabase, {
    reporter_id: report.user_id,
  });

  if (candidates.length === 0) {
    console.log(`[Matching] No candidates available for report ${reportId}`);
    // Flag for manual review since there are zero candidates
    if (!options.dry_run) {
      await supabase.from('reports').update({
        requires_manual_review: true,
      }).eq('report_id', reportId);
    }
    return [];
  }

  // ─── Stages 2–9: Score All Candidates ─────────────────────────────────────

  // Fetch active case counts in parallel for all candidates
  const activeCaseCounts = await Promise.all(
    candidates.map(c => getActiveCaseCount(supabase, c)),
  );

  // Check existing matches for this report (to pass existing_match_status)
  const { data: existingMatches } = await supabase
    .from('matched_services')
    .select('service_id, hrd_profile_id, match_status_type')
    .eq('report_id', reportId);

  const existingMatchMap = new Map<string, string>();
  existingMatches?.forEach(m => {
    const id = m.service_id || m.hrd_profile_id;
    if (id) existingMatchMap.set(id, m.match_status_type || '');
  });

  const scoredResults: MatchResult[] = candidates.map((candidate, idx) => {
    return scoreCandidate(
      candidate,
      context,
      activeCaseCounts[idx],
      cascadeLevel,
      existingMatchMap.get(candidate.entity_id) || null,
    );
  });

  // ─── Stage 10: Final Selection ────────────────────────────────────────────

  const selection = selectTopCandidates(scoredResults);

  // ─── Persistence (skip in dry_run mode) ────────────────────────────────────

  if (options.dry_run) {
    return selection.selected;
  }

  if (selection.requires_manual_review) {
    await supabase.from('reports').update({
      requires_manual_review: true,
    }).eq('report_id', reportId);
    console.log(`[Matching] Report ${reportId} flagged for manual review — no viable candidates`);
    return [];
  }

  if (selection.selected.length > 0) {
    // Update report status
    await supabase.from('reports').update({
      ismatched: true,
      match_status: 'pending',
    }).eq('report_id', reportId);

    // Build match inserts
    const matchInserts = selection.selected.map(m => ({
      report_id: reportId,
      service_id: m.candidate.source_type === 'service' ? m.candidate.entity_id : null,
      hrd_profile_id: m.candidate.source_type === 'profile' ? m.candidate.entity_id : null,
      match_date: new Date().toISOString(),
      match_score: Math.round(m.score),
      match_status_type: 'pending' as const,
      match_reason: m.reasons.join(', '),
      description: m.candidate.bio_snapshot || null,
      notes: m.candidate.location_snapshot || null,
      escalation_required: context.is_child_case,
      support_service: (m.candidate.service_capabilities[0] || 'other') as Database['public']['Enums']['support_service_type'],
      survivor_id: report.user_id,
      updated_at: new Date().toISOString(),
      is_fallback_match: m.is_fallback,
      cascade_level: cascadeLevel,
      cascade_phase_triggered_at: cascadeLevel > 0 ? new Date().toISOString() : null,
    }));

    const { error: matchError } = await supabase
      .from('matched_services')
      .insert(matchInserts as any);

    if (matchError) {
      console.error('[Matching] Failed to insert matches:', matchError);
      throw matchError;
    }
  }

  return selection.selected;
}


// ─── Simulation Runner (for Admin Visualizer) ───────────────────────────────

/**
 * Runs a read-only simulation of the matching pipeline for visualization.
 * Includes unverified candidates (shown as bounced) for completeness.
 */
export async function runSimulation(
  reportId: string,
  supabase: SupabaseClient<Database>,
): Promise<SimulationResult> {
  // Fetch report
  const { data: report, error: reportError } = await supabase
    .from('reports')
    .select('*')
    .eq('report_id', reportId)
    .single();

  if (reportError || !report) throw new Error('Failed to fetch report');

  const context = buildMatchingContext(report);

  // Get ALL candidates (including unverified for viz)
  const { verified, unverified } = await buildCandidatePool(supabase, {
    include_unverified: true,
    reporter_id: report.user_id,
  });

  // Get existing matches for this report
  const { data: existingMatches } = await supabase
    .from('matched_services')
    .select('service_id, hrd_profile_id, match_status_type')
    .eq('report_id', reportId);

  const existingMatchMap = new Map<string, string>();
  existingMatches?.forEach(m => {
    const id = m.service_id || m.hrd_profile_id;
    if (id) existingMatchMap.set(id, m.match_status_type || '');
  });

  // Score verified candidates
  const verifiedResults: SimulationCandidate[] = await Promise.all(
    verified.map(async candidate => {
      const activeCases = await getActiveCaseCount(supabase, candidate);
      const result = scoreCandidate(
        candidate,
        context,
        activeCases,
        0,
        existingMatchMap.get(candidate.entity_id) || null,
      );
      return { ...result, is_verified: true };
    }),
  );

  // Unverified shown as bounced
  const unverifiedResults: SimulationCandidate[] = unverified.map(candidate => ({
    candidate,
    score: 0,
    reasons: [],
    breakdown: {
      clinical_specialty: 0, proximity: 0, professional_authority: 0,
      availability: 0, language: 0, gender: 0, disability: 0,
      queer_support: 0, child_case_penalty: 0, load_balancing: 0,
      urgency_multiplier: 1, raw_total: 0, final_score: 0,
    },
    is_bounced: true,
    bounce_reason: 'Unverified service provider',
    is_fallback: false,
    existing_match_status: existingMatchMap.get(candidate.entity_id) as any || null,
    is_verified: false,
  }));

  const allResults = [...verifiedResults, ...unverifiedResults]
    .sort((a, b) => b.score - a.score)
    .slice(0, 20); // UI limit

  return { report, candidates: allResults };
}
