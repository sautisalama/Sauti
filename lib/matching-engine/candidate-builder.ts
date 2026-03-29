/**
 * Matching Engine — Candidate Builder
 *
 * Stage 1: Candidate Aggregation.
 * Compiles a unified candidate pool from two sources:
 *   Source A: Verified Support Services
 *   Source B: Verified Standalone Professionals (HRDs, Paralegals)
 *
 * Also applies the OOO hard filter at source level.
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/db-schema';
import { CandidateObject, MatchingTraits } from './types';

interface ProfileSettings {
  matching_traits?: MatchingTraits;
  [key: string]: unknown;
}

/**
 * Fetches and builds the unified candidate pool (Spec Section 6.1).
 *
 * @param supabase - Supabase client (admin or authenticated)
 * @param options - Additional options for pool control
 * @returns Array of normalized CandidateObject entries
 */
export async function buildCandidatePool(
  supabase: SupabaseClient<Database>,
  options?: {
    /** Include unverified candidates for visualization (default: false) */
    include_unverified?: boolean;
  },
): Promise<{
  verified: CandidateObject[];
  unverified: CandidateObject[];
}> {

  // ─── Source A: Support Services ────────────────────────────────────────────

  let serviceQuery = supabase
    .from('support_services')
    .select('*, profile:profiles!support_services_user_id_fkey(*)')
    .eq('is_banned', false)
    .eq('is_permanently_suspended', false);

  if (!options?.include_unverified) {
    serviceQuery = serviceQuery
      .eq('is_active', true)
      .eq('verification_status', 'verified');
  }

  const { data: allServices, error: servicesError } = await serviceQuery;
  if (servicesError) throw servicesError;

  // Split verified vs unverified
  const verifiedServices = (allServices || []).filter(
    s => s.verification_status === 'verified' && s.is_active,
  );
  const unverifiedServices = options?.include_unverified
    ? (allServices || []).filter(s => s.verification_status !== 'verified' || !s.is_active)
    : [];

  // ─── Source B: Standalone Professionals ────────────────────────────────────

  const { data: standaloneProfiles, error: standaloneError } = await supabase
    .from('profiles')
    .select('*')
    .in('professional_title', ['Human rights defender', 'Paralegal'])
    .eq('verification_status', 'verified');

  if (standaloneError) throw standaloneError;

  // Deduplicate: exclude standalone profiles already represented via a service
  const serviceOwnerIds = new Set(
    verifiedServices.map(s => s.user_id).filter(Boolean),
  );
  const activeStandaloneProfiles = (standaloneProfiles || []).filter(
    p => !serviceOwnerIds.has(p.id) && !p.is_banned,
  );

  // ─── Normalize into CandidateObjects ──────────────────────────────────────

  const normalizeService = (
    s: (typeof allServices extends (infer T)[] | null ? T : never),
    isVerified: boolean,
  ): CandidateObject => {
    const profile = s.profile as unknown as {
      professional_title: string | null;
      settings: ProfileSettings | null;
      bio: string | null;
      first_name: string | null;
      last_name: string | null;
      out_of_office: boolean | null;
    } | null;

    return {
      source_type: 'service',
      entity_id: s.id,
      owner_user_id: s.user_id || '',
      display_name: s.name || 'Service',
      service_capabilities: [s.service_types],
      professional_title: profile?.professional_title || null,
      latitude: s.latitude,
      longitude: s.longitude,
      coverage_radius_km: s.coverage_area_radius || 50,
      is_remote: s.coverage_area_radius === null,
      availability_profile: s.availability || 'flexible',
      specialises_disability: s.specialises_in_disability || false,
      specialises_queer: s.specialises_in_queer_support || false,
      specialises_children: s.specialises_in_children || false,
      matching_traits: (profile?.settings as ProfileSettings)?.matching_traits || {},
      bio_snapshot: profile?.bio || null,
      location_snapshot: null, // Will be enriched from profile if available
      owner_first_name: profile?.first_name || null,
      owner_last_name: profile?.last_name || null,
    };
  };

  const normalizeProfile = (p: NonNullable<typeof standaloneProfiles>[number]): CandidateObject => {
    const settings = p.settings as ProfileSettings | null;
    return {
      source_type: 'profile',
      entity_id: p.id,
      owner_user_id: p.id,
      display_name: `${p.first_name || ''} ${p.last_name || ''}`.trim() || p.professional_title || 'Expert',
      service_capabilities: p.professional_title === 'Paralegal' ? ['legal'] : ['other'],
      professional_title: p.professional_title,
      latitude: null, // Profiles don't have lat/lon in current schema
      longitude: null,
      coverage_radius_km: p.professional_title === 'Paralegal' ? 60 : 100,
      is_remote: false,
      availability_profile: 'flexible',
      specialises_disability: false,
      specialises_queer: false,
      specialises_children: p.professional_title === 'Human rights defender',
      matching_traits: settings?.matching_traits || {},
      bio_snapshot: p.bio || null,
      location_snapshot: null,
      owner_first_name: p.first_name || null,
      owner_last_name: p.last_name || null,
    };
  };

  // ─── Apply OOO Filter (Spec: OOO professionals excluded from new matching) ─

  const filterOOO = (candidates: CandidateObject[], profiles: Map<string, boolean>): CandidateObject[] => {
    return candidates.filter(c => {
      const isOOO = profiles.get(c.owner_user_id);
      return !isOOO;
    });
  };

  // Build OOO lookup from service profiles
  const oooLookup = new Map<string, boolean>();
  for (const s of allServices || []) {
    const profile = s.profile as unknown as { out_of_office: boolean | null } | null;
    if (s.user_id && profile?.out_of_office) {
      oooLookup.set(s.user_id, true);
    }
  }
  for (const p of activeStandaloneProfiles) {
    if (p.out_of_office) {
      oooLookup.set(p.id, true);
    }
  }

  const verified = filterOOO(
    [
      ...verifiedServices.map(s => normalizeService(s, true)),
      ...activeStandaloneProfiles.map(normalizeProfile),
    ],
    oooLookup,
  );

  const unverified = unverifiedServices.map(s => normalizeService(s, false));

  return { verified, unverified };
}
