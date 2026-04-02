-- Migration: Change additional_info from TEXT to JSONB
-- Date: 2026-04-02

ALTER TABLE reports 
ALTER COLUMN additional_info TYPE JSONB 
USING additional_info::jsonb;

-- Update existing NULL values if needed (already handled by the type change, but for clarity)
COMMENT ON COLUMN reports.additional_info IS 'Stores metadata like incident types, special needs, and child report status.';
