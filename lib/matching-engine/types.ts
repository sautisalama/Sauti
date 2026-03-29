/**
 * Matching Engine — Type Definitions
 *
 * Strongly typed interfaces conforming to the Matching Engine Specification v2.0.
 * These types are the single source of truth for the entire matching pipeline.
 */

import { Database } from '@/types/db-schema';

// ─── Database Type Aliases ───────────────────────────────────────────────────

export type Report = Database['public']['Tables']['reports']['Row'];
export type SupportService = Database['public']['Tables']['support_services']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];
export type MatchedService = Database['public']['Tables']['matched_services']['Row'];
export type MatchStatusType = Database['public']['Enums']['match_status_type'];
export type IncidentType = Database['public']['Enums']['incident_type'];
export type UrgencyType = Database['public']['Enums']['urgency_type'];
export type SupportServiceType = Database['public']['Enums']['support_service_type'];

// ─── Candidate Object (Spec Section 5 — Unified Schema) ─────────────────────

export interface CandidateObject {
  /** Discriminator: where this candidate was sourced from */
  source_type: 'service' | 'profile';
  /** The entity ID (service.id or profile.id) */
  entity_id: string;
  /** The owning user's profile ID */
  owner_user_id: string;
  /** Display name for the candidate */
  display_name: string;
  /** Array of service type strings the candidate offers */
  service_capabilities: string[];
  /** Professional title from the owner's profile */
  professional_title: string | null;
  /** Latitude of the service/profile location */
  latitude: number | null;
  /** Longitude of the service/profile location */
  longitude: number | null;
  /** Maximum coverage radius in km. NULL treated as remote */
  coverage_radius_km: number;
  /** True if coverage_radius is null (infinite/remote) */
  is_remote: boolean;
  /** Availability profile string (e.g. '24/7', 'weekdays_9_5') */
  availability_profile: string;
  /** Whether the candidate specialises in disability support */
  specialises_disability: boolean;
  /** Whether the candidate specialises in queer-affirming support */
  specialises_queer: boolean;
  /** Whether the candidate specialises in children's cases */
  specialises_children: boolean;
  /** Matching traits from profile settings (languages, gender) */
  matching_traits: MatchingTraits;
  /** Bio snapshot for match record */
  bio_snapshot: string | null;
  /** Location snapshot for match record (city, country) */
  location_snapshot: string | null;
  /** Owner's first name (for display) */
  owner_first_name: string | null;
  /** Owner's last name (for display) */
  owner_last_name: string | null;
}

export interface MatchingTraits {
  languages?: string[];
  gender?: string;
}

// ─── Scoring Breakdown (for visualization / audit) ───────────────────────────

export interface ScoringBreakdown {
  clinical_specialty: number;
  proximity: number;
  professional_authority: number;
  availability: number;
  language: number;
  gender: number;
  disability: number;
  queer_support: number;
  child_case_penalty: number;
  load_balancing: number;
  urgency_multiplier: number;
  raw_total: number;
  final_score: number;
}

// ─── Match Result ────────────────────────────────────────────────────────────

export interface MatchResult {
  candidate: CandidateObject;
  score: number;
  reasons: string[];
  breakdown: ScoringBreakdown;
  /** Whether this candidate was bounced (hard-filtered) */
  is_bounced: boolean;
  /** If bounced, the reason */
  bounce_reason: string;
  /** Whether this is a fallback match (threshold relaxation applied) */
  is_fallback: boolean;
  /** The existing match status if this candidate was already matched to this report */
  existing_match_status: MatchStatusType | null;
}

// ─── Matching Context ────────────────────────────────────────────────────────

export interface MatchingContext {
  report: Report;
  /** Parsed additional_info JSON */
  additional_info: ParsedAdditionalInfo;
  /** Whether this is a child abuse or child labor case */
  is_child_case: boolean;
  /** Report age in hours since submission */
  report_age_hours: number;
  /** Whether temporal relaxation should apply (>24h) */
  is_temporally_relaxed: boolean;
  /** Required services explicitly requested by survivor */
  required_services: string[];
  /** Incident type, falls back to 'other' */
  incident_type: string;
  /** Urgency level, defaults to 'medium' */
  urgency: UrgencyType;
}

export interface ParsedAdditionalInfo {
  special_needs?: {
    disabled?: boolean;
    queer_support?: boolean;
    child_involved?: boolean;
  };
  [key: string]: unknown;
}

// ─── Pipeline Options ────────────────────────────────────────────────────────

export interface MatchingPipelineOptions {
  /** Current cascade level to control pool widening (default: 0) */
  cascade_level?: number;
  /** If true, only simulate — don't persist matches */
  dry_run?: boolean;
  /** Maximum number of top candidates to select */
  max_matches?: number;
  /** Include unverified candidates in results (for visualization only) */
  include_unverified?: boolean;
}

// ─── Simulation Result (for admin visualizer) ────────────────────────────────

export interface SimulationCandidate extends MatchResult {
  /** Whether the candidate is verified (visualizer may show unverified as bounced) */
  is_verified: boolean;
}

export interface SimulationResult {
  report: Report;
  candidates: SimulationCandidate[];
}
