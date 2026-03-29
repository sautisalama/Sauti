/**
 * Matching Engine — Scoring Functions
 *
 * Pure, stateless functions for each scoring stage of the matching pipeline.
 * These functions are designed to be testable and composable.
 *
 * Stages follow the Matching Engine Specification v2.0:
 *   Stage 2: Hard Filters
 *   Stage 3: Clinical Specialty Scoring
 *   Stage 4: Proximity Scoring
 *   Stage 5: Professional Authority Scoring
 *   Stage 6: Availability Alignment
 *   Stage 7: Demographic & Special Needs Alignment
 *   Stage 8: Load Balancing
 *   Stage 9: Urgency Multiplier
 *   Stage 10: Final Selection
 */

import {
  CandidateObject,
  MatchingContext,
  MatchResult,
  ScoringBreakdown,
} from './types';

import {
  INCIDENT_SPECIALTY_MAP,
  PROFESSIONAL_AUTHORITY,
  AVAILABILITY_SCORE,
  LOAD_BALANCE_SCORES,
  LOAD_BALANCE_DEFAULT,
  LOAD_BALANCE_HARD_EXCLUDE_THRESHOLD,
  SCORE,
  THRESHOLD,
  URGENCY_MULTIPLIER,
  GEO_BOUNDARY,
} from './constants';


// ─── Haversine Distance ──────────────────────────────────────────────────────

/**
 * Calculates the great-circle distance between two points using the Haversine formula.
 * @returns Distance in kilometers.
 */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * (Math.PI / 180)) *
    Math.cos(lat2 * (Math.PI / 180)) *
    Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}


// ─── Stage 2: Hard Filters ──────────────────────────────────────────────────

export interface HardFilterResult {
  passed: boolean;
  reason: string;
}

/**
 * Applies all hard filters from Spec Section 6.2.
 * A candidate failing any hard filter is eliminated (sentinel score -∞).
 */
export function applyHardFilters(
  candidate: CandidateObject,
  context: MatchingContext,
  activeCaseCount: number,
  cascadeLevel: number,
): HardFilterResult {

  // Hard Filter 1 — Consent Restriction
  if (
    context.report.consent === 'no' &&
    !context.is_child_case &&
    (candidate.professional_title === 'Lawyer' || candidate.professional_title === 'Law firm')
  ) {
    return { passed: false, reason: 'Legal consent withheld' };
  }

  // Hard Filter 2 — Service Type Relevance
  if (context.incident_type !== 'other') {
    const mapping = INCIDENT_SPECIALTY_MAP[context.incident_type];
    if (mapping) {
      const hasRelevantService = candidate.service_capabilities.some(
        t => mapping.primary.includes(t) ||
          mapping.secondary.includes(t) ||
          context.required_services.includes(t),
      );
      if (!hasRelevantService) {
        return { passed: false, reason: 'No relevant specialty match' };
      }
    }
  }

  // Hard Filter 3 — Geographic Hard Boundary
  if (
    !candidate.is_remote &&
    context.report.latitude != null && context.report.longitude != null &&
    candidate.latitude != null && candidate.longitude != null
  ) {
    const distance = haversineDistance(
      context.report.latitude, context.report.longitude,
      candidate.latitude, candidate.longitude,
    );

    let boundaryMultiplier: number | null = GEO_BOUNDARY.PHASE_0_MULTIPLIER;
    if (cascadeLevel >= 3) {
      boundaryMultiplier = null; // Phase 3+: no geographic boundary
    } else if (cascadeLevel >= 2) {
      boundaryMultiplier = GEO_BOUNDARY.PHASE_2_MULTIPLIER;
    }

    if (
      boundaryMultiplier !== null &&
      distance > candidate.coverage_radius_km * boundaryMultiplier &&
      !context.is_temporally_relaxed
    ) {
      return { passed: false, reason: `Outside hard geographic boundary (${Math.round(distance)}km > ${Math.round(candidate.coverage_radius_km * boundaryMultiplier)}km)` };
    }
  }

  // Hard Filter — Capacity (5+ truly active cases)
  if (activeCaseCount >= LOAD_BALANCE_HARD_EXCLUDE_THRESHOLD) {
    return { passed: false, reason: `At capacity (${activeCaseCount} active cases)` };
  }

  return { passed: true, reason: '' };
}


// ─── Stage 3: Clinical Specialty Scoring ────────────────────────────────────

export function scoreClinicalSpecialty(
  candidate: CandidateObject,
  context: MatchingContext,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];
  const mapping = INCIDENT_SPECIALTY_MAP[context.incident_type] || { primary: [], secondary: [] };

  const isPrimary = candidate.service_capabilities.some(t => mapping.primary.includes(t));
  const isSecondary = candidate.service_capabilities.some(t => mapping.secondary.includes(t));
  const isExplicitlyRequested = candidate.service_capabilities.some(t => context.required_services.includes(t));

  if (isPrimary) {
    score += SCORE.CLINICAL_PRIMARY;
    reasons.push(`Primary specialty for ${context.incident_type} (+${SCORE.CLINICAL_PRIMARY})`);
  } else if (isSecondary) {
    score += SCORE.CLINICAL_SECONDARY;
    reasons.push(`Secondary specialty for ${context.incident_type} (+${SCORE.CLINICAL_SECONDARY})`);
  }

  if (isExplicitlyRequested) {
    score += SCORE.CLINICAL_EXPLICIT_REQUEST;
    reasons.push(`Requested by survivor (+${SCORE.CLINICAL_EXPLICIT_REQUEST})`);
  }

  return { score, reasons };
}


// ─── Stage 4: Proximity Scoring ─────────────────────────────────────────────

export function scoreProximity(
  candidate: CandidateObject,
  context: MatchingContext,
): { score: number; reasons: string[] } {
  const reasons: string[] = [];

  // Remote candidates: flat bonus
  if (candidate.is_remote) {
    return { score: SCORE.PROXIMITY_REMOTE, reasons: [`Remote service available (+${SCORE.PROXIMITY_REMOTE})`] };
  }

  // No location data: skip proximity (score 0)
  if (
    context.report.latitude == null || context.report.longitude == null ||
    candidate.latitude == null || candidate.longitude == null
  ) {
    return { score: 0, reasons: [] };
  }

  const distance = haversineDistance(
    context.report.latitude, context.report.longitude,
    candidate.latitude, candidate.longitude,
  );
  const radius = candidate.coverage_radius_km || 50;

  if (distance <= radius) {
    const proximityScore = Math.max(0, SCORE.PROXIMITY_MAX * (1 - distance / radius));
    const rounded = Math.round(proximityScore * 10) / 10;
    reasons.push(`Proximity score (+${Math.round(rounded)}, ${Math.round(distance)}km within ${radius}km radius)`);
    return { score: rounded, reasons };
  }

  // Outside coverage, but temporally relaxed
  if (context.is_temporally_relaxed) {
    reasons.push(`Available via temporal relaxation (+${SCORE.PROXIMITY_TEMPORAL_RELAXATION}, ${Math.round(distance)}km)`);
    return { score: SCORE.PROXIMITY_TEMPORAL_RELAXATION, reasons };
  }

  // Outside coverage, not relaxed
  reasons.push(`Outside regular service area (${SCORE.PROXIMITY_OUTSIDE_PENALTY})`);
  return { score: SCORE.PROXIMITY_OUTSIDE_PENALTY, reasons };
}


// ─── Stage 5: Professional Authority Scoring ────────────────────────────────

export function scoreProfessionalAuthority(
  candidate: CandidateObject,
  context: MatchingContext,
): { score: number; reasons: string[] } {
  if (!candidate.professional_title || !context.incident_type) {
    return { score: 0, reasons: [] };
  }

  const authority = PROFESSIONAL_AUTHORITY[candidate.professional_title]?.[context.incident_type] ?? 0;
  if (authority > 0) {
    return {
      score: authority,
      reasons: [`Professional authority: ${candidate.professional_title} (+${authority})`],
    };
  }
  return { score: 0, reasons: [] };
}


// ─── Stage 6: Availability Alignment ────────────────────────────────────────

export function scoreAvailability(
  candidate: CandidateObject,
  context: MatchingContext,
): { score: number; reasons: string[] } {
  const availKey = candidate.availability_profile || 'flexible';
  const urgency = context.urgency || 'medium';
  const availScore = AVAILABILITY_SCORE[availKey]?.[urgency] ?? 5;

  return {
    score: availScore,
    reasons: [`Availability alignment (+${availScore})`],
  };
}


// ─── Stage 7: Demographic & Special Needs Alignment ─────────────────────────

export function scoreDemographics(
  candidate: CandidateObject,
  context: MatchingContext,
): { score: number; reasons: string[] } {
  let score = 0;
  const reasons: string[] = [];

  // Language Match
  if (
    context.report.preferred_language &&
    candidate.matching_traits.languages?.includes(context.report.preferred_language)
  ) {
    score += SCORE.LANGUAGE_MATCH;
    reasons.push(`Language match: ${context.report.preferred_language} (+${SCORE.LANGUAGE_MATCH})`);
  }

  // Gender Preference
  if (
    context.report.gender &&
    candidate.matching_traits.gender &&
    candidate.matching_traits.gender === context.report.gender
  ) {
    score += SCORE.GENDER_MATCH;
    reasons.push(`Gender preference match (+${SCORE.GENDER_MATCH})`);
  }

  // Disability Specialisation
  if (
    context.additional_info.special_needs?.disabled &&
    candidate.specialises_disability
  ) {
    score += SCORE.DISABILITY_MATCH;
    reasons.push(`Disability specialist (+${SCORE.DISABILITY_MATCH})`);
  }

  // Queer Support Specialisation
  if (
    context.additional_info.special_needs?.queer_support &&
    candidate.specialises_queer
  ) {
    score += SCORE.QUEER_MATCH;
    reasons.push(`Queer support specialist (+${SCORE.QUEER_MATCH})`);
  }

  // Child case penalty for non-specialists (Hard Filter 4 from spec — applied as penalty not elimination)
  if (
    context.is_child_case &&
    !candidate.specialises_children &&
    !candidate.service_capabilities.includes('child_protection')
  ) {
    score += SCORE.CHILD_NON_SPECIALIST_PENALTY;
    reasons.push(`No child specialisation penalty (${SCORE.CHILD_NON_SPECIALIST_PENALTY})`);
  }

  return { score, reasons };
}


// ─── Stage 8: Load Balancing ────────────────────────────────────────────────

export function scoreLoadBalancing(
  activeCaseCount: number,
): { score: number; reasons: string[] } {
  // Note: 5+ is handled by hard filter, so we'll never see it here
  const score = LOAD_BALANCE_SCORES[activeCaseCount] ?? LOAD_BALANCE_DEFAULT;
  const reasons: string[] = [];

  if (activeCaseCount === 0) {
    reasons.push(`High immediate capacity (+${score})`);
  } else {
    reasons.push(`Load balance: ${activeCaseCount} active case${activeCaseCount > 1 ? 's' : ''} (${score})`);
  }

  return { score, reasons };
}


// ─── Stage 9: Urgency Multiplier ────────────────────────────────────────────

export function applyUrgencyMultiplier(
  rawScore: number,
  urgency: string,
): { score: number; multiplier: number } {
  const multiplier = URGENCY_MULTIPLIER[urgency] ?? 1.0;
  return {
    score: Math.round(rawScore * multiplier),
    multiplier,
  };
}


// ─── Stage 10: Final Selection ──────────────────────────────────────────────

export interface SelectionResult {
  selected: MatchResult[];
  is_fallback: boolean;
  requires_manual_review: boolean;
}

/**
 * Selects the top candidates from scored results (Spec Section 6.10).
 *
 * 1. Filter to score >= 10, take top 5
 * 2. Fallback: filter to score > -50, take top 3, flag as is_fallback
 * 3. If no candidates above -50: flag requires_manual_review
 */
export function selectTopCandidates(
  results: MatchResult[],
): SelectionResult {
  // Primary selection: score >= threshold, top N
  const primaryCandidates = results
    .filter(r => !r.is_bounced && r.score >= THRESHOLD.PRIMARY)
    .sort((a, b) => b.score - a.score)
    .slice(0, THRESHOLD.TOP_N_PRIMARY);

  if (primaryCandidates.length > 0) {
    return {
      selected: primaryCandidates,
      is_fallback: false,
      requires_manual_review: false,
    };
  }

  // Fallback selection: score > -50, top 3
  const fallbackCandidates = results
    .filter(r => !r.is_bounced && r.score > THRESHOLD.FALLBACK)
    .sort((a, b) => b.score - a.score)
    .slice(0, THRESHOLD.TOP_N_FALLBACK);

  if (fallbackCandidates.length > 0) {
    return {
      selected: fallbackCandidates.map(c => ({
        ...c,
        is_fallback: true,
        reasons: [...c.reasons, 'Matched as best available provider (fallback)'],
      })),
      is_fallback: true,
      requires_manual_review: false,
    };
  }

  // Total failure: no candidates even at fallback
  return {
    selected: [],
    is_fallback: false,
    requires_manual_review: true,
  };
}


// ─── Full Scoring Pipeline (per candidate) ──────────────────────────────────

/**
 * Runs the complete 10-stage scoring pipeline for a single candidate.
 * Returns a fully scored MatchResult.
 */
export function scoreCandidate(
  candidate: CandidateObject,
  context: MatchingContext,
  activeCaseCount: number,
  cascadeLevel: number = 0,
  existingMatchStatus: string | null = null,
): MatchResult {

  const breakdown: ScoringBreakdown = {
    clinical_specialty: 0,
    proximity: 0,
    professional_authority: 0,
    availability: 0,
    language: 0,
    gender: 0,
    disability: 0,
    queer_support: 0,
    child_case_penalty: 0,
    load_balancing: 0,
    urgency_multiplier: 1,
    raw_total: 0,
    final_score: 0,
  };

  const allReasons: string[] = [];

  // Stage 2: Hard Filters
  const hardFilter = applyHardFilters(candidate, context, activeCaseCount, cascadeLevel);
  if (!hardFilter.passed) {
    return {
      candidate,
      score: -Infinity,
      reasons: [hardFilter.reason],
      breakdown,
      is_bounced: true,
      bounce_reason: hardFilter.reason,
      is_fallback: false,
      existing_match_status: (existingMatchStatus as MatchResult['existing_match_status']),
    };
  }

  // Stage 3: Clinical Specialty
  const clinical = scoreClinicalSpecialty(candidate, context);
  breakdown.clinical_specialty = clinical.score;
  allReasons.push(...clinical.reasons);

  // Stage 4: Proximity
  const proximity = scoreProximity(candidate, context);
  breakdown.proximity = proximity.score;
  allReasons.push(...proximity.reasons);

  // Stage 5: Professional Authority
  const authority = scoreProfessionalAuthority(candidate, context);
  breakdown.professional_authority = authority.score;
  allReasons.push(...authority.reasons);

  // Stage 6: Availability
  const availability = scoreAvailability(candidate, context);
  breakdown.availability = availability.score;
  allReasons.push(...availability.reasons);

  // Stage 7: Demographics & Special Needs
  const demographics = scoreDemographics(candidate, context);
  // Separate the sub-components for breakdown
  if (context.report.preferred_language && candidate.matching_traits.languages?.includes(context.report.preferred_language)) {
    breakdown.language = SCORE.LANGUAGE_MATCH;
  }
  if (context.report.gender && candidate.matching_traits.gender === context.report.gender) {
    breakdown.gender = SCORE.GENDER_MATCH;
  }
  if (context.additional_info.special_needs?.disabled && candidate.specialises_disability) {
    breakdown.disability = SCORE.DISABILITY_MATCH;
  }
  if (context.additional_info.special_needs?.queer_support && candidate.specialises_queer) {
    breakdown.queer_support = SCORE.QUEER_MATCH;
  }
  if (context.is_child_case && !candidate.specialises_children && !candidate.service_capabilities.includes('child_protection')) {
    breakdown.child_case_penalty = SCORE.CHILD_NON_SPECIALIST_PENALTY;
  }
  allReasons.push(...demographics.reasons);

  // Stage 8: Load Balancing
  const load = scoreLoadBalancing(activeCaseCount);
  breakdown.load_balancing = load.score;
  allReasons.push(...load.reasons);

  // Sum raw score
  const rawTotal =
    breakdown.clinical_specialty +
    breakdown.proximity +
    breakdown.professional_authority +
    breakdown.availability +
    demographics.score +
    breakdown.load_balancing;

  breakdown.raw_total = rawTotal;

  // Stage 9: Urgency Multiplier
  const { score: finalScore, multiplier } = applyUrgencyMultiplier(rawTotal, context.urgency);
  breakdown.urgency_multiplier = multiplier;
  breakdown.final_score = finalScore;

  if (multiplier !== 1.0) {
    allReasons.push(`Urgency multiplier (×${multiplier})`);
  }

  return {
    candidate,
    score: finalScore,
    reasons: allReasons,
    breakdown,
    is_bounced: false,
    bounce_reason: '',
    is_fallback: false,
    existing_match_status: (existingMatchStatus as MatchResult['existing_match_status']),
  };
}
