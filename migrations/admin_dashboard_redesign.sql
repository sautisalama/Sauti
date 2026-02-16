-- Admin Dashboard Redesign Migration

-- 1. Add 'reviewed_by' column to support_services
ALTER TABLE support_services 
ADD COLUMN IF NOT EXISTS reviewed_by JSONB DEFAULT NULL;

COMMENT ON COLUMN support_services.reviewed_by IS 'JSONB object containing reviewer_id, date, action, and notes';

-- 2. Add 'reviewed_by' column to profiles
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS reviewed_by JSONB DEFAULT NULL;

COMMENT ON COLUMN profiles.reviewed_by IS 'JSONB object containing reviewer_id, date, action, and notes for profile verification';



-- 4. Update blogs table for Events
ALTER TABLE blogs 
ADD COLUMN IF NOT EXISTS is_event BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS event_details JSONB DEFAULT NULL;

COMMENT ON COLUMN blogs.is_event IS 'Flag to identify if this blog post is an event';
COMMENT ON COLUMN blogs.event_details IS 'JSONB object containing event specific data: event_date, location, is_virtual, meeting_link, cta_text, cta_link';

-- 5. Create index for faster filtering of events
CREATE INDEX IF NOT EXISTS idx_blogs_is_event ON blogs(is_event);
CREATE INDEX IF NOT EXISTS idx_blogs_status ON blogs(status);

-- 6. Grant necessary permissions (if needed, usually handled by RLS)
-- Ensure authenticated users can read published events
CREATE POLICY "Public can view published events" 
ON blogs FOR SELECT 
USING (status = 'published' AND is_event = true);

-- 7. Notification and Event helper functions (Optional, but good for data integrity)

-- Function to validate event details if is_event is true
CREATE OR REPLACE FUNCTION validate_event_details()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_event = TRUE THEN
    IF NEW.event_details IS NULL THEN
      RAISE EXCEPTION 'Event details cannot be null for an event';
    END IF;
    -- Add more specific validation logic here if needed (e.g., check for mandatory fields in JSONB)
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_event_details
BEFORE INSERT OR UPDATE ON blogs
FOR EACH ROW
EXECUTE FUNCTION validate_event_details();
