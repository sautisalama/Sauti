-- Migration: Update Services and Chat
-- Description: Updates support services with suspension and sharing, adds notifications, and enables chat attachments.

-- 1. Create verification_status_type Enum
-- Check if type exists first to avoid errors on re-run
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'verification_status_type') THEN
        CREATE TYPE verification_status_type AS ENUM ('pending', 'verified', 'rejected', 'under_review', 'suspended');
    ELSE
        -- If it exists, we might need to add 'suspended' if it's missing (updates)
        ALTER TYPE verification_status_type ADD VALUE IF NOT EXISTS 'suspended';
    END IF;
END $$;

-- 2. Migrate existing verification_status columns in profiles and support_services
-- Note: You might need to handle existing data if values don't match the enum.
-- Assuming current values are compatible or null.

-- Profiles table
DROP VIEW IF EXISTS admin_dashboard_stats;

ALTER TABLE profiles 
ALTER COLUMN verification_status DROP DEFAULT;

ALTER TABLE profiles 
ALTER COLUMN verification_status TYPE verification_status_type 
USING verification_status::text::verification_status_type;

ALTER TABLE profiles 
ALTER COLUMN verification_status SET DEFAULT 'pending'::verification_status_type;

-- Support Services table
ALTER TABLE support_services 
ALTER COLUMN verification_status DROP DEFAULT;

ALTER TABLE support_services 
ALTER COLUMN verification_status TYPE verification_status_type 
USING verification_status::text::verification_status_type;

ALTER TABLE support_services 
ALTER COLUMN verification_status SET DEFAULT 'pending'::verification_status_type;

-- Recreate view for admin dashboard statistics
CREATE OR REPLACE VIEW admin_dashboard_stats AS
SELECT 
    -- User counts by user_type
    (SELECT COUNT(*) FROM profiles WHERE user_type = 'survivor' AND is_banned = false) as total_survivors,
    (SELECT COUNT(*) FROM profiles WHERE user_type = 'professional' AND is_banned = false) as total_professionals,
    (SELECT COUNT(*) FROM profiles WHERE user_type = 'ngo' AND is_banned = false) as total_ngos,
    (SELECT COUNT(*) FROM profiles WHERE is_admin = true) as total_admins,
    
    -- Verification stats
    (SELECT COUNT(*) FROM profiles WHERE verification_status = 'pending' AND user_type IN ('professional', 'ngo')) as pending_verifications,
    (SELECT COUNT(*) FROM profiles WHERE verification_status = 'verified' AND user_type IN ('professional', 'ngo')) as verified_users,
    (SELECT COUNT(*) FROM profiles WHERE verification_status = 'rejected' AND user_type IN ('professional', 'ngo')) as rejected_users,
    
    -- Service stats
    (SELECT COUNT(*) FROM support_services WHERE verification_status = 'pending') as pending_service_verifications,
    (SELECT COUNT(*) FROM support_services WHERE verification_status = 'verified' AND is_active = true) as active_services,
    (SELECT COUNT(*) FROM support_services WHERE verification_status = 'rejected') as rejected_services,
    
    -- Banned counts
    (SELECT COUNT(*) FROM profiles WHERE is_banned = true) as banned_users,
    (SELECT COUNT(*) FROM support_services WHERE is_banned = true) as banned_services;

GRANT SELECT ON admin_dashboard_stats TO authenticated;

-- 3. Add columns for Service Suspension
ALTER TABLE support_services
ADD COLUMN IF NOT EXISTS suspension_reason text,
ADD COLUMN IF NOT EXISTS suspension_end_date timestamptz,
ADD COLUMN IF NOT EXISTS is_permanently_suspended boolean DEFAULT false;

-- 4. Create Service Shares table
CREATE TABLE IF NOT EXISTS service_shares (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    service_id uuid REFERENCES support_services(id) ON DELETE CASCADE,
    from_user_id uuid REFERENCES profiles(id),
    to_user_id uuid REFERENCES profiles(id),
    status text CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- 5. Create Notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid REFERENCES profiles(id) ON DELETE CASCADE,
    type text NOT NULL, -- e.g., 'service_share', 'system_alert'
    title text NOT NULL,
    message text,
    link text, -- Action link
    metadata jsonb DEFAULT '{}', -- Extra data like service_id, sender_id
    read boolean DEFAULT false,
    created_at timestamptz DEFAULT now()
);

-- 6. Update Messages table for Attachments
ALTER TABLE messages
ADD COLUMN IF NOT EXISTS attachments jsonb[] DEFAULT '{}';

-- 7. RLS Policies (Basic examples, refine as needed)

-- Service Shares
ALTER TABLE service_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view shares they are involved in" ON service_shares
    FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Users can create shares for their own services" ON service_shares
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM support_services 
            WHERE id = service_id AND user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update shares sent to them" ON service_shares
    FOR UPDATE USING (auth.uid() = to_user_id);

-- Notifications
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "System/Functions can insert notifications" ON notifications
    FOR INSERT WITH CHECK (true); -- Usually restricted to service role or specific triggers

CREATE POLICY "Users can update their own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- Storage Bucket (Executed via API/Dashboard usually, but here for reference)
-- insert into storage.buckets (id, name) values ('chat-attachments', 'chat-attachments');
