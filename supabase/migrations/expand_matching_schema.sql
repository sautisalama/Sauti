-- ============================================================================
-- Sauti Salama: Enhanced Matching Schema Migration
-- Safe for existing data — all operations are additive (IF NOT EXISTS / IF NOT EXISTS)
-- ============================================================================

-- ─────────────────────────────────────────
-- 1. Enum Expansions
-- ─────────────────────────────────────────

-- Incident types
ALTER TYPE incident_type ADD VALUE IF NOT EXISTS 'child_labor';
ALTER TYPE incident_type ADD VALUE IF NOT EXISTS 'neglect';
ALTER TYPE incident_type ADD VALUE IF NOT EXISTS 'trafficking';
ALTER TYPE incident_type ADD VALUE IF NOT EXISTS 'stalking';
ALTER TYPE incident_type ADD VALUE IF NOT EXISTS 'cyber';
ALTER TYPE incident_type ADD VALUE IF NOT EXISTS 'racial';

-- Support service types
ALTER TYPE support_service_type ADD VALUE IF NOT EXISTS 'police_reporting';
ALTER TYPE support_service_type ADD VALUE IF NOT EXISTS 'child_protection';
ALTER TYPE support_service_type ADD VALUE IF NOT EXISTS 'disability_support';
ALTER TYPE support_service_type ADD VALUE IF NOT EXISTS 'substance_abuse';

-- ─────────────────────────────────────────
-- 2. New columns on support_services
-- ─────────────────────────────────────────

ALTER TABLE support_services ADD COLUMN IF NOT EXISTS specialises_in_disability BOOLEAN DEFAULT false;
ALTER TABLE support_services ADD COLUMN IF NOT EXISTS specialises_in_queer_support BOOLEAN DEFAULT false;
ALTER TABLE support_services ADD COLUMN IF NOT EXISTS specialises_in_children BOOLEAN DEFAULT false;

-- ─────────────────────────────────────────
-- 3. New columns on matched_services
-- ─────────────────────────────────────────

ALTER TABLE matched_services ADD COLUMN IF NOT EXISTS escalation_required BOOLEAN DEFAULT false;
ALTER TABLE matched_services ADD COLUMN IF NOT EXISTS match_reason TEXT;
ALTER TABLE matched_services ADD COLUMN IF NOT EXISTS hrd_profile_id UUID REFERENCES profiles(id);

-- ─────────────────────────────────────────
-- 4. New column on reports
-- ─────────────────────────────────────────

ALTER TABLE reports ADD COLUMN IF NOT EXISTS is_workplace_incident BOOLEAN DEFAULT false;

-- ─────────────────────────────────────────
-- 5. Performance Indexes
-- ─────────────────────────────────────────

-- Active verified services (primary matching query)
CREATE INDEX IF NOT EXISTS idx_support_services_active_verified
  ON support_services (is_active, verification_status)
  WHERE is_active = true AND is_banned = false AND is_permanently_suspended = false;

-- Service types lookup
CREATE INDEX IF NOT EXISTS idx_support_services_service_types
  ON support_services (service_types);

-- Active matches for load balancing queries
CREATE INDEX IF NOT EXISTS idx_matched_services_status
  ON matched_services (match_status_type)
  WHERE match_status_type IN ('pending', 'accepted');

CREATE INDEX IF NOT EXISTS idx_matched_services_hrd
  ON matched_services (hrd_profile_id)
  WHERE hrd_profile_id IS NOT NULL;

-- Unmatched reports for batch processing
CREATE INDEX IF NOT EXISTS idx_reports_unmatched
  ON reports (ismatched)
  WHERE ismatched = false;

-- HRD profile lookup
CREATE INDEX IF NOT EXISTS idx_profiles_hrd
  ON profiles (professional_title, verification_status)
  WHERE professional_title = 'Human rights defender';

-- ─────────────────────────────────────────
-- 6. Utility Functions
-- ─────────────────────────────────────────

-- Counts active (pending + accepted) cases for a provider
CREATE OR REPLACE FUNCTION get_active_case_count(provider_user_id UUID)
RETURNS INTEGER AS $$
  SELECT COALESCE(COUNT(*)::INTEGER, 0)
  FROM matched_services ms
  LEFT JOIN support_services ss ON ms.service_id = ss.id
  WHERE (ss.user_id = provider_user_id OR ms.hrd_profile_id = provider_user_id)
    AND ms.match_status_type IN ('pending', 'accepted');
$$ LANGUAGE SQL STABLE;
