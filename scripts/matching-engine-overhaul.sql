-- ============================================================================
-- Matching Engine Overhaul — Database Migration
-- Created: 2026-03-29
-- Purpose: Aligns the database schema with the Matching Engine Spec v2.0
-- ============================================================================

-- ============================================================================
-- 1. FIX: handle_out_of_office_change trigger (42P17 recursive update bug)
--    The BEFORE UPDATE trigger was doing UPDATE on the same profiles table,
--    causing a recursive trigger invocation error. The fix stores the
--    services snapshot directly on NEW instead of via separate UPDATE.
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."handle_out_of_office_change"()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.out_of_office = true AND (OLD.out_of_office = false OR OLD.out_of_office IS NULL) THEN
        -- Store current active service IDs directly on the NEW row (no recursive UPDATE)
        NEW.services_active_before_ooo := COALESCE(
            (
                SELECT jsonb_agg(id)
                FROM "public"."support_services"
                WHERE user_id = NEW.id AND is_active = true AND auto_inactive_when_ooo = true
            ),
            '[]'::jsonb
        );

        -- Deactivate services (different table — safe from recursion)
        UPDATE "public"."support_services"
        SET is_active = false
        WHERE user_id = NEW.id AND auto_inactive_when_ooo = true;

    ELSIF NEW.out_of_office = false AND (OLD.out_of_office = true) THEN
        -- Reactivate previously active services
        IF OLD.services_active_before_ooo IS NOT NULL
           AND OLD.services_active_before_ooo != '[]'::jsonb THEN
            UPDATE "public"."support_services"
            SET is_active = true
            WHERE user_id = NEW.id
            AND id = ANY(
                SELECT (jsonb_array_elements_text(OLD.services_active_before_ooo))::uuid
            );
        END IF;

        -- Clear the stored state directly on NEW (no recursive UPDATE)
        NEW.services_active_before_ooo := '[]'::jsonb;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Re-create the trigger (unchanged from original, but function is now fixed)
DROP TRIGGER IF EXISTS "trigger_out_of_office_change" ON "public"."profiles";
CREATE TRIGGER "trigger_out_of_office_change"
BEFORE UPDATE OF out_of_office ON "public"."profiles"
FOR EACH ROW
EXECUTE FUNCTION "public"."handle_out_of_office_change"();


-- ============================================================================
-- 2. Extend match_status_type ENUM with spec-required statuses
-- ============================================================================

DO $$
BEGIN
    ALTER TYPE "public"."match_status_type" ADD VALUE IF NOT EXISTS 'completion_pending';
    ALTER TYPE "public"."match_status_type" ADD VALUE IF NOT EXISTS 'completed_auto';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- ============================================================================
-- 3. Add matching engine tracking columns to matched_services
-- ============================================================================

-- Flags low-confidence fallback matches for admin visibility
ALTER TABLE "public"."matched_services"
ADD COLUMN IF NOT EXISTS "is_fallback_match" boolean DEFAULT false;

-- Tracks which Temporal Cascade phase this match was created in (0–5)
ALTER TABLE "public"."matched_services"
ADD COLUMN IF NOT EXISTS "cascade_level" smallint DEFAULT 0;

-- When the current cascade phase was entered (for timing calculations)
ALTER TABLE "public"."matched_services"
ADD COLUMN IF NOT EXISTS "cascade_phase_triggered_at" timestamp with time zone;

-- Indexes for cascade-level queries and admin monitoring
CREATE INDEX IF NOT EXISTS "matched_services_cascade_level_idx"
ON "public"."matched_services" ("cascade_level")
WHERE cascade_level > 0;

CREATE INDEX IF NOT EXISTS "matched_services_fallback_idx"
ON "public"."matched_services" ("is_fallback_match")
WHERE is_fallback_match = true;


-- ============================================================================
-- 4. Add administrative matching flag to reports
-- ============================================================================

-- Reports that couldn't be matched even at fallback level
ALTER TABLE "public"."reports"
ADD COLUMN IF NOT EXISTS "requires_manual_review" boolean DEFAULT false;


-- ============================================================================
-- 5. Optimized active case count function for load balancing
--    Replaces the old get_active_case_count with spec-compliant logic:
--    - Excludes declined, completed, cancelled, completed_auto
--    - Excludes cases where professional has marked is_prof_complete
-- ============================================================================

CREATE OR REPLACE FUNCTION "public"."get_active_case_count"(provider_user_id uuid)
RETURNS integer AS $$
DECLARE
    active_count integer;
BEGIN
    SELECT COUNT(*) INTO active_count
    FROM "public"."matched_services" ms
    JOIN "public"."support_services" ss ON ms.service_id = ss.id
    WHERE ss.user_id = provider_user_id
      AND ms.match_status_type NOT IN ('declined', 'completed', 'cancelled', 'completed_auto')
      AND (
          ms.feedback IS NULL
          OR NOT (ms.feedback::jsonb ? 'is_prof_complete' AND (ms.feedback::jsonb ->> 'is_prof_complete')::boolean = true)
      );

    -- Also count HRD direct matches
    SELECT active_count + COUNT(*) INTO active_count
    FROM "public"."matched_services" ms
    WHERE ms.hrd_profile_id = provider_user_id
      AND ms.match_status_type NOT IN ('declined', 'completed', 'cancelled', 'completed_auto')
      AND (
          ms.feedback IS NULL
          OR NOT (ms.feedback::jsonb ? 'is_prof_complete' AND (ms.feedback::jsonb ->> 'is_prof_complete')::boolean = true)
      );

    RETURN active_count;
END;
$$ LANGUAGE plpgsql STABLE;


-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
