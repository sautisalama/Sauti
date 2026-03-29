/**
 * Matching Engine — Public API
 *
 * Barrel export for the matching engine module.
 * All matching logic should be consumed via this index.
 */

// Types
export type {
  CandidateObject,
  MatchResult,
  MatchingContext,
  MatchingPipelineOptions,
  ScoringBreakdown,
  SimulationCandidate,
  SimulationResult,
  ParsedAdditionalInfo,
  MatchingTraits,
} from './types';

// Pipeline (main entry points)
export {
  runMatchingPipeline,
  runSimulation,
  buildMatchingContext,
} from './pipeline';

// Scoring (for simulation/visualization or advanced usage)
export {
  scoreCandidate,
  selectTopCandidates,
  haversineDistance,
  applyHardFilters,
  scoreClinicalSpecialty,
  scoreProximity,
  scoreProfessionalAuthority,
  scoreAvailability,
  scoreDemographics,
  scoreLoadBalancing,
  applyUrgencyMultiplier,
} from './scoring';

// Candidate Builder
export { buildCandidatePool } from './candidate-builder';

// Constants (for UI display and reference)
export {
  INCIDENT_SPECIALTY_MAP,
  PROFESSIONAL_AUTHORITY,
  AVAILABILITY_SCORE,
  SCORE,
  THRESHOLD,
  URGENCY_MULTIPLIER,
  CASCADE_TIMING,
  GEO_BOUNDARY,
} from './constants';
