-- ============================================================================
-- Sauti Salama: RLS Fixes & Status Synchronization
-- Goal: Ensure professionals can see matches/appointments for their personal reports, 
--       and keep reports.match_status in sync with matched_services.
-- ============================================================================

-- 1. DROP RESTRICTIVE POLICIES
-- These policies were checking profiles.user_type, which blocked "Dual Role" users.
DROP POLICY IF EXISTS "Survivors can view their matched services" ON matched_services;
DROP POLICY IF EXISTS "Service providers can view matched services for their services" ON matched_services;
DROP POLICY IF EXISTS "Survivors can view their appointments" ON appointments;
DROP POLICY IF EXISTS "Professionals can view their appointments" ON appointments;

-- 2. CREATE UNIFIED POLICIES (Based on participation, not global user_type)

-- Matched Services
CREATE POLICY "Survivors can view their matched services"
ON matched_services FOR SELECT TO authenticated
USING (auth.uid() = survivor_id::uuid);

CREATE POLICY "Service providers can view matched services for their services"
ON matched_services FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM support_services 
    WHERE id = matched_services.service_id AND user_id = auth.uid()
  ) OR (auth.uid() = hrd_profile_id::uuid)
);

-- Appointments
CREATE POLICY "Survivors can view their appointments"
ON appointments FOR SELECT TO authenticated
USING (auth.uid() = survivor_id::uuid);

CREATE POLICY "Professionals can view their appointments"
ON appointments FOR SELECT TO authenticated
USING (auth.uid() = professional_id::uuid);


-- 3. STATUS SYNCHRONIZATION TRIGGER

-- Create/Replace Trigger Function
CREATE OR REPLACE FUNCTION sync_report_match_status()
RETURNS TRIGGER AS $$
DECLARE
    target_report_id UUID;
    final_status TEXT;
BEGIN
    -- Determine which report we are syncing
    IF (TG_OP = 'DELETE') THEN
        target_report_id := OLD.report_id;
    ELSE
        target_report_id := NEW.report_id;
    END IF;

    IF target_report_id IS NULL THEN
        RETURN NULL;
    END IF;

    -- Derive status based on hierarchy
    SELECT 
        CASE 
            WHEN EXISTS (SELECT 1 FROM matched_services WHERE report_id = target_report_id AND match_status_type = 'completed') THEN 'completed'
            WHEN EXISTS (SELECT 1 FROM matched_services WHERE report_id = target_report_id AND match_status_type = 'accepted') THEN 'accepted'
            WHEN EXISTS (SELECT 1 FROM matched_services WHERE report_id = target_report_id AND match_status_type = 'reschedule_requested') THEN 'reschedule_requested'
            WHEN EXISTS (SELECT 1 FROM matched_services WHERE report_id = target_report_id AND match_status_type = 'pending_survivor') THEN 'pending_survivor'
            WHEN EXISTS (SELECT 1 FROM matched_services WHERE report_id = target_report_id AND match_status_type = 'proposed') THEN 'proposed'
            ELSE 'pending'
        END INTO final_status;


    -- Update the reports table
    UPDATE reports 
    SET 
        match_status = final_status::match_status_type,
        ismatched = (final_status != 'pending')
    WHERE report_id = target_report_id;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create Trigger
DROP TRIGGER IF EXISTS trigger_sync_report_status ON matched_services;
CREATE TRIGGER trigger_sync_report_status
AFTER INSERT OR UPDATE OR DELETE ON matched_services
FOR EACH ROW
EXECUTE FUNCTION sync_report_match_status();


-- 4. BACKFILL EXISTING REPORTS
-- Run the sync for all reports that have matches
UPDATE reports r
SET 
    match_status = (
        SELECT 
            CASE 
                WHEN EXISTS (SELECT 1 FROM matched_services WHERE report_id = r.report_id AND match_status_type = 'completed') THEN 'completed'
                WHEN EXISTS (SELECT 1 FROM matched_services WHERE report_id = r.report_id AND match_status_type = 'accepted') THEN 'accepted'
                WHEN EXISTS (SELECT 1 FROM matched_services WHERE report_id = r.report_id AND match_status_type = 'reschedule_requested') THEN 'reschedule_requested'
                WHEN EXISTS (SELECT 1 FROM matched_services WHERE report_id = r.report_id AND match_status_type = 'pending_survivor') THEN 'pending_survivor'
                WHEN EXISTS (SELECT 1 FROM matched_services WHERE report_id = r.report_id AND match_status_type = 'proposed') THEN 'proposed'
                ELSE 'pending'
            END
    )::match_status_type,
    ismatched = EXISTS (SELECT 1 FROM matched_services WHERE report_id = r.report_id AND match_status_type NOT IN ('declined', 'cancelled'))

WHERE EXISTS (SELECT 1 FROM matched_services WHERE report_id = r.report_id);

-- Explicitly handle reports with NO matches or all declined matches
UPDATE reports r
SET 
    match_status = 'pending'::match_status_type,
    ismatched = false
WHERE NOT EXISTS (SELECT 1 FROM matched_services WHERE report_id = r.report_id AND match_status_type != 'declined');

-- Note: Adjust match_status_type casting if the table uses a different enum or text.
-- In our schema, it's match_status_type.
