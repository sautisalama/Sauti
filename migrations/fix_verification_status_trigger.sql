-- Fix: update_verification_status() trigger function
-- 
-- Trigger name: trigger_update_verification_status
-- Function name: update_verification_status
-- Security: Invoker
--
-- The original function used bare text literals ('pending', 'under_review')
-- to set profiles.verification_status. After the column was migrated from
-- TEXT to verification_status_type enum, these fail because PostgreSQL
-- cannot implicitly cast text → verification_status_type inside a trigger.
--
-- This fix adds explicit ::verification_status_type casts.
-- No schema changes — just fixing the function logic.
--
-- Run this in the Supabase SQL Editor.

CREATE OR REPLACE FUNCTION update_verification_status()
RETURNS TRIGGER AS $$
BEGIN
    -- Update profiles table verification status
    UPDATE profiles 
    SET 
        last_verification_check = NOW(),
        verification_status = CASE 
            WHEN accreditation_files_metadata IS NOT NULL 
            AND jsonb_array_length(accreditation_files_metadata) > 0 
            THEN 'under_review'::verification_status_type
            ELSE 'pending'::verification_status_type
        END
    WHERE id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
