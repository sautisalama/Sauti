/**
 * Matching Engine — Constants
 *
 * Single source of truth for all scoring tables, thresholds, and matrices.
 * Values taken directly from the Matching Engine Specification v2.0.
 */

// ─── Clinical Specialty Map (Spec Section 6.3) ──────────────────────────────

export const INCIDENT_SPECIALTY_MAP: Record<string, { primary: string[]; secondary: string[] }> = {
  physical:    { primary: ['medical', 'legal'],                    secondary: ['mental_health', 'shelter'] },
  emotional:   { primary: ['mental_health'],                       secondary: ['legal', 'shelter'] },
  sexual:      { primary: ['medical', 'mental_health', 'legal'],   secondary: ['shelter'] },
  financial:   { primary: ['legal', 'financial_assistance'],       secondary: ['mental_health'] },
  child_abuse: { primary: ['legal', 'medical'],                    secondary: ['mental_health', 'shelter', 'child_protection'] },
  child_labor: { primary: ['legal', 'child_protection'],           secondary: ['mental_health', 'shelter'] },
  neglect:     { primary: ['medical', 'mental_health'],            secondary: ['shelter', 'legal', 'child_protection'] },
  trafficking: { primary: ['legal', 'police_reporting'],           secondary: ['shelter', 'mental_health'] },
  stalking:    { primary: ['legal', 'police_reporting'],           secondary: ['mental_health'] },
  cyber:       { primary: ['legal'],                               secondary: ['mental_health'] },
  racial:      { primary: ['legal'],                               secondary: ['mental_health'] },
  other:       { primary: [],                                      secondary: [] },
};

// ─── Professional Authority Matrix (Spec Section 6.5) ────────────────────────
// Complete matrix: 9 professional titles × 12 incident types

export const PROFESSIONAL_AUTHORITY: Record<string, Record<string, number>> = {
  'Doctor': {
    physical: 10, emotional: 3, sexual: 10, financial: 0,
    child_abuse: 8, child_labor: 0, neglect: 8, trafficking: 0,
    stalking: 0, cyber: 0, racial: 0, other: 2,
  },
  'Mental health expert': {
    physical: 5, emotional: 10, sexual: 8, financial: 0,
    child_abuse: 5, child_labor: 3, neglect: 6, trafficking: 4,
    stalking: 5, cyber: 4, racial: 4, other: 5,
  },
  'Lawyer': {
    physical: 8, emotional: 0, sexual: 8, financial: 10,
    child_abuse: 10, child_labor: 10, neglect: 0, trafficking: 10,
    stalking: 10, cyber: 10, racial: 10, other: 4,
  },
  'Paralegal': {
    physical: 4, emotional: 4, sexual: 4, financial: 6,
    child_abuse: 6, child_labor: 8, neglect: 4, trafficking: 6,
    stalking: 6, cyber: 6, racial: 6, other: 4,
  },
  'Human rights defender': {
    physical: 4, emotional: 6, sexual: 4, financial: 4,
    child_abuse: 8, child_labor: 8, neglect: 6, trafficking: 8,
    stalking: 6, cyber: 6, racial: 8, other: 10,
  },
  'Law firm': {
    physical: 8, emotional: 0, sexual: 8, financial: 10,
    child_abuse: 10, child_labor: 10, neglect: 0, trafficking: 10,
    stalking: 10, cyber: 8, racial: 10, other: 4,
  },
  'Rescue Center': {
    physical: 8, emotional: 4, sexual: 6, financial: 0,
    child_abuse: 8, child_labor: 8, neglect: 6, trafficking: 6,
    stalking: 4, cyber: 0, racial: 0, other: 4,
  },
  'Hospital/Clinic': {
    physical: 10, emotional: 2, sexual: 10, financial: 0,
    child_abuse: 8, child_labor: 0, neglect: 8, trafficking: 0,
    stalking: 0, cyber: 0, racial: 0, other: 2,
  },
  'Local NGO': {
    physical: 4, emotional: 6, sexual: 4, financial: 6,
    child_abuse: 6, child_labor: 6, neglect: 6, trafficking: 6,
    stalking: 4, cyber: 4, racial: 6, other: 8,
  },
};

// ─── Availability Scoring Matrix (Spec Section 6.6) ──────────────────────────

export const AVAILABILITY_SCORE: Record<string, Record<string, number>> = {
  '24/7':               { high: 10, medium: 8, low: 5 },
  'weekdays_extended':  { high: 6,  medium: 10, low: 8 },
  'weekdays_9_5':       { high: 3,  medium: 8,  low: 10 },
  'weekends':           { high: 4,  medium: 6,  low: 8 },
  'flexible':           { high: 7,  medium: 8,  low: 8 },
  'by_appointment':     { high: 1,  medium: 5,  low: 8 },
};

// ─── Load Balancing Thresholds (Spec Section 6.8) ────────────────────────────

export const LOAD_BALANCE_SCORES: Record<number, number> = {
  0: 30,   // High immediate capacity bonus
  1: -8,
  2: -16,
  3: -24,
};
// 4+ gets -40, 5+ is hard excluded (handled in scoring function)
export const LOAD_BALANCE_DEFAULT = -40;
export const LOAD_BALANCE_HARD_EXCLUDE_THRESHOLD = 5;

// ─── Score Weights (Spec Sections 6.3–6.9) ──────────────────────────────────

export const SCORE = {
  /** Primary clinical specialty match */
  CLINICAL_PRIMARY: 25,
  /** Secondary clinical specialty match */
  CLINICAL_SECONDARY: 15,
  /** Explicitly requested by survivor (stackable) */
  CLINICAL_EXPLICIT_REQUEST: 20,

  /** Maximum proximity score (at center of coverage) */
  PROXIMITY_MAX: 20,
  /** Flat bonus for remote services */
  PROXIMITY_REMOTE: 15,
  /** Penalty for being outside coverage area (non-relaxed) */
  PROXIMITY_OUTSIDE_PENALTY: -10,
  /** Temporal relaxation bonus for old reports */
  PROXIMITY_TEMPORAL_RELAXATION: 5,

  /** Language match bonus */
  LANGUAGE_MATCH: 15,
  /** Gender preference match bonus */
  GENDER_MATCH: 10,
  /** Disability specialisation match */
  DISABILITY_MATCH: 15,
  /** Queer support specialisation match */
  QUEER_MATCH: 15,

  /** Child case penalty for non-specialist */
  CHILD_NON_SPECIALIST_PENALTY: -50,
} as const;

// ─── Matching Thresholds (Spec Section 6.10) ─────────────────────────────────

export const THRESHOLD = {
  /** Minimum score for standard match selection */
  PRIMARY: 10,
  /** Minimum score for fallback match selection */
  FALLBACK: -50,
  /** Top N candidates for standard selection */
  TOP_N_PRIMARY: 5,
  /** Top N candidates for fallback selection */
  TOP_N_FALLBACK: 3,
} as const;

// ─── Urgency Multipliers (Spec Section 6.9) ─────────────────────────────────

export const URGENCY_MULTIPLIER: Record<string, number> = {
  high: 1.2,
  medium: 1.1,
  low: 1.0,
};

// ─── Geographic Hard Boundary Multipliers (Spec Sections 6.2, 7.8) ──────────

export const GEO_BOUNDARY = {
  /** Phase 0: Hard boundary = radius × 2.5 */
  PHASE_0_MULTIPLIER: 2.5,
  /** Phase 2: Relaxed boundary = radius × 4 */
  PHASE_2_MULTIPLIER: 4.0,
  /** Phase 3+: No geographic hard boundary */
  PHASE_3_NO_BOUNDARY: true,
} as const;

// ─── Temporal Cascade Timing (Spec Section 7) ────────────────────────────────
// Values in minutes

export const CASCADE_TIMING = {
  /** Standard timing */
  standard: {
    phase_1_nudge: 20,
    phase_2_extended_pool: 20,
    phase_3_full_pool: 720,      // 12 hours
    phase_4_full_hrd: 1080,      // 18 hours
    phase_5_admin_escalation: 1440, // 24 hours
  },
  /** High-urgency timing (all halved) */
  high_urgency: {
    phase_1_nudge: 10,
    phase_2_extended_pool: 10,
    phase_3_full_pool: 360,       // 6 hours
    phase_4_full_hrd: 540,        // 9 hours
    phase_5_admin_escalation: 720, // 12 hours
  },
} as const;
