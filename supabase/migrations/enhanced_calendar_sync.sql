-- Enhanced Calendar Sync Migration
-- Add additional fields for better calendar integration

-- Add token expiry tracking
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS google_calendar_token_expiry BIGINT;

-- Add calendar sync status
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS calendar_sync_enabled BOOLEAN DEFAULT FALSE;

-- Add calendar sync preferences
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS calendar_sync_settings JSONB DEFAULT '{
  "auto_sync": true,
  "sync_reminders": true,
  "default_duration": 60,
  "timezone": "Africa/Nairobi"
}'::jsonb;

-- Add calendar event tracking to appointments
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS google_calendar_event_id TEXT;

-- Add calendar sync metadata
ALTER TABLE appointments 
ADD COLUMN IF NOT EXISTS calendar_sync_status TEXT DEFAULT 'not_synced';

-- Create index for calendar sync queries
CREATE INDEX IF NOT EXISTS idx_appointments_calendar_sync 
ON appointments(google_calendar_event_id, calendar_sync_status);

-- Create index for calendar token expiry
CREATE INDEX IF NOT EXISTS idx_profiles_calendar_tokens 
ON profiles(google_calendar_token_expiry, calendar_sync_enabled);

-- Add RLS policies for calendar sync
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Policy for calendar sync access
CREATE POLICY "Users can sync their own appointments" ON appointments
FOR ALL USING (
  professional_id = auth.uid() OR 
  survivor_id = auth.uid()
);

-- Add function to clean up expired tokens
CREATE OR REPLACE FUNCTION cleanup_expired_calendar_tokens()
RETURNS void AS $$
BEGIN
  UPDATE profiles 
  SET 
    google_calendar_token = NULL,
    google_calendar_refresh_token = NULL,
    google_calendar_token_expiry = NULL,
    calendar_sync_enabled = FALSE
  WHERE 
    google_calendar_token_expiry IS NOT NULL 
    AND google_calendar_token_expiry < EXTRACT(EPOCH FROM NOW()) * 1000;
END;
$$ LANGUAGE plpgsql;

-- Create a scheduled job to clean up expired tokens (requires pg_cron extension)
-- SELECT cron.schedule('cleanup-expired-tokens', '0 2 * * *', 'SELECT cleanup_expired_calendar_tokens();');
