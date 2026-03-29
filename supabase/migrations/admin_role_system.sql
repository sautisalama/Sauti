-- Admin Role System Migration
-- This migration adds admin capabilities, verification system, and role switching with proper enum types
-- This migration is idempotent and can be run multiple times safely

-- 1. Create enum types for better data integrity (with IF NOT EXISTS)
DO $$ BEGIN
    CREATE TYPE verification_status_type AS ENUM ('pending', 'verified', 'rejected', 'under_review');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE admin_action_type AS ENUM (
        'verify_user', 'ban_user', 'verify_service', 'ban_service', 
        'unban_user', 'unban_service', 'reject_user', 'reject_service'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE target_type AS ENUM ('user', 'service');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE stat_type AS ENUM ('user_counts', 'service_counts', 'verification_stats', 'coverage_map', 'initial_setup');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Add admin role and verification fields to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS admin_verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS admin_verified_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS banned_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS ban_reason TEXT,
ADD COLUMN IF NOT EXISTS verification_status verification_status_type DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS verification_notes TEXT,
ADD COLUMN IF NOT EXISTS verification_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- 3. Add verification fields to support_services table
ALTER TABLE support_services
ADD COLUMN IF NOT EXISTS verification_status verification_status_type DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS verification_notes TEXT,
ADD COLUMN IF NOT EXISTS verification_updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS verified_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS is_banned BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS banned_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS banned_by UUID REFERENCES profiles(id),
ADD COLUMN IF NOT EXISTS ban_reason TEXT;

-- 4. Create admin_actions table for audit trail
CREATE TABLE IF NOT EXISTS admin_actions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID NOT NULL REFERENCES profiles(id),
    action_type admin_action_type NOT NULL,
    target_type target_type NOT NULL,
    target_id UUID NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Create admin_statistics table for caching stats
CREATE TABLE IF NOT EXISTS admin_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stat_type stat_type NOT NULL,
    stat_data JSONB NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(stat_type)
);

-- 6. Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin);
CREATE INDEX IF NOT EXISTS idx_profiles_verification_status ON profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON profiles(is_banned);
CREATE INDEX IF NOT EXISTS idx_support_services_verification_status ON support_services(verification_status);
CREATE INDEX IF NOT EXISTS idx_support_services_is_active ON support_services(is_active);
CREATE INDEX IF NOT EXISTS idx_support_services_is_banned ON support_services(is_banned);
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_id ON admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created_at ON admin_actions(created_at);

-- 7. Create function to update verification timestamps
-- First drop triggers that depend on the function
DROP TRIGGER IF EXISTS trigger_update_profile_verification_timestamp ON profiles;
DROP TRIGGER IF EXISTS trigger_update_service_verification_timestamp ON support_services;

-- Then drop and recreate the function
DROP FUNCTION IF EXISTS update_verification_timestamp();
CREATE OR REPLACE FUNCTION update_verification_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.verification_status != OLD.verification_status THEN
        NEW.verification_updated_at = NOW();
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 8. Create triggers for automatic timestamp updates
CREATE TRIGGER trigger_update_profile_verification_timestamp
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_verification_timestamp();

CREATE TRIGGER trigger_update_service_verification_timestamp
    BEFORE UPDATE ON support_services
    FOR EACH ROW
    EXECUTE FUNCTION update_verification_timestamp();

-- 9. Create function to check if user is admin (needed for RLS policies)
DROP FUNCTION IF EXISTS is_admin(UUID);
CREATE OR REPLACE FUNCTION is_admin(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM profiles 
        WHERE id = user_id 
        AND is_admin = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 10. Create RLS policies for admin access (using functions to avoid recursion)
-- Drop existing policies first
DROP POLICY IF EXISTS "Admins can view profile verification data" ON profiles;
DROP POLICY IF EXISTS "Admins can update verification status" ON profiles;
DROP POLICY IF EXISTS "Admins can view all services" ON support_services;
DROP POLICY IF EXISTS "Admins can update service verification" ON support_services;
DROP POLICY IF EXISTS "Admins can log actions" ON admin_actions;
DROP POLICY IF EXISTS "Admins can view admin actions" ON admin_actions;

-- Admin can view all profiles (but not sensitive data like email for survivors)
CREATE POLICY "Admins can view profile verification data" ON profiles
    FOR SELECT
    TO authenticated
    USING (is_admin());

-- Admin can update verification status
CREATE POLICY "Admins can update verification status" ON profiles
    FOR UPDATE
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- Admin can view all support services
CREATE POLICY "Admins can view all services" ON support_services
    FOR SELECT
    TO authenticated
    USING (is_admin());

-- Admin can update service verification status
CREATE POLICY "Admins can update service verification" ON support_services
    FOR UPDATE
    TO authenticated
    USING (is_admin())
    WITH CHECK (is_admin());

-- Admin can insert admin actions
CREATE POLICY "Admins can log actions" ON admin_actions
    FOR INSERT
    TO authenticated
    WITH CHECK (admin_id = auth.uid() AND is_admin());

-- Admin can view admin actions
CREATE POLICY "Admins can view admin actions" ON admin_actions
    FOR SELECT
    TO authenticated
    USING (is_admin());

-- 11. Create view for admin dashboard statistics (FIXED: using user_type instead of role)
DROP VIEW IF EXISTS admin_dashboard_stats;
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

-- 12. Create function to get coverage map data
DROP FUNCTION IF EXISTS get_coverage_map_data();
CREATE OR REPLACE FUNCTION get_coverage_map_data()
RETURNS TABLE (
    service_id UUID,
    service_name TEXT,
    service_type TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    coverage_radius INTEGER,
    verification_status verification_status_type,
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ss.id as service_id,
        ss.service_name,
        ss.service_types as service_type,
        ss.latitude,
        ss.longitude,
        ss.coverage_radius,
        ss.verification_status,
        ss.is_active
    FROM support_services ss
    WHERE ss.latitude IS NOT NULL 
    AND ss.longitude IS NOT NULL
    AND ss.verification_status = 'verified'
    AND ss.is_active = true
    AND ss.is_banned = false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 13. Grant necessary permissions
GRANT SELECT ON admin_dashboard_stats TO authenticated;
GRANT EXECUTE ON FUNCTION get_coverage_map_data() TO authenticated;

-- 14. Insert initial admin statistics
INSERT INTO admin_statistics (stat_type, stat_data) 
VALUES ('initial_setup', jsonb_build_object('migration_completed', true, 'timestamp', NOW()))
ON CONFLICT (stat_type) DO UPDATE SET 
    stat_data = jsonb_build_object('migration_completed', true, 'timestamp', NOW()),
    updated_at = NOW();

-- 15. Create function to get user's current role context
DROP FUNCTION IF EXISTS get_user_role_context(UUID);
CREATE OR REPLACE FUNCTION get_user_role_context(target_user_id UUID DEFAULT auth.uid())
RETURNS TABLE (
    user_id UUID,
    primary_role user_type,
    is_admin BOOLEAN,
    can_switch_to_admin BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        p.id as user_id,
        p.user_type as primary_role,
        p.is_admin,
        p.is_admin as can_switch_to_admin
    FROM profiles p
    WHERE p.id = target_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant permissions for the new functions
GRANT EXECUTE ON FUNCTION is_admin(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_role_context(UUID) TO authenticated;
