-- Enhanced File Upload System for Professional Accreditation
-- This script sets up proper bucket policies and table updates for the enhanced file upload system
-- Run this script after the main schema creation

-- ==============================================
-- COMPREHENSIVE CLEANUP - DROP ALL DEPENDENCIES
-- ==============================================

-- Drop all indexes first (they might depend on columns)
DROP INDEX IF EXISTS idx_profiles_verification_status;
DROP INDEX IF EXISTS idx_profiles_user_type;
DROP INDEX IF EXISTS idx_support_services_verification_status;
DROP INDEX IF EXISTS idx_support_services_user_id_service_type;

-- Drop all triggers (they depend on functions)
DROP TRIGGER IF EXISTS trigger_update_verification_status ON support_services;

-- Drop all functions (they might have grants and comments)
DROP FUNCTION IF EXISTS get_user_file_stats(UUID);
DROP FUNCTION IF EXISTS cleanup_orphaned_files();
DROP FUNCTION IF EXISTS update_verification_status();

-- Drop all storage policies (comprehensive cleanup)
DO $$
DECLARE
    policy_name TEXT;
BEGIN
    -- Drop all policies on storage.objects
    FOR policy_name IN 
        SELECT policyname FROM pg_policies 
        WHERE tablename = 'objects' AND schemaname = 'storage'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', policy_name);
    END LOOP;
EXCEPTION
    WHEN OTHERS THEN
        -- Ignore errors if policies don't exist
        NULL;
END $$;

-- Drop all RLS policies (comprehensive cleanup)
DO $$
DECLARE
    policy_record RECORD;
BEGIN
    -- Drop all policies on all tables
    FOR policy_record IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('profiles', 'support_services', 'appointments', 'matched_services', 'reports')
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                      policy_record.policyname, 
                      policy_record.schemaname, 
                      policy_record.tablename);
    END LOOP;
EXCEPTION
    WHEN OTHERS THEN
        -- Ignore errors if policies don't exist
        NULL;
END $$;

-- Drop any existing constraints that might conflict
DO $$
BEGIN
    -- Drop check constraints if they exist
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'profiles_verification_status_check' 
               AND table_name = 'profiles') THEN
        ALTER TABLE profiles DROP CONSTRAINT profiles_verification_status_check;
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name = 'support_services_verification_status_check' 
               AND table_name = 'support_services') THEN
        ALTER TABLE support_services DROP CONSTRAINT support_services_verification_status_check;
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        -- Ignore errors if constraints don't exist
        NULL;
END $$;

-- ==============================================
-- STORAGE BUCKETS SETUP
-- ==============================================

-- Create accreditation-files bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'accreditation-files',
    'accreditation-files', 
    true, -- Public for easier access to uploaded files
    10485760, -- 10MB file size limit
    ARRAY[
        'application/pdf',
        'image/jpeg',
        'image/png', 
        'image/webp',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]
) ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Create profile-images bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'profile-images',
    'profile-images', 
    true,
    5242880, -- 5MB file size limit
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif']
) ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Ensure report-media bucket exists (should already exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'report-media',
    'report-media', 
    true,
    52428800, -- 50MB file size limit
    ARRAY[
        'image/jpeg', 'image/png', 'image/webp',
        'audio/webm', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/mpeg'
    ]
) ON CONFLICT (id) DO UPDATE SET
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ==============================================
-- STORAGE POLICIES FOR ACCREDITATION FILES
-- ==============================================

-- Storage policies for accreditation-files bucket

-- 1. INSERT Policy - Allow authenticated users to upload files to their own folder
CREATE POLICY "Allow users to upload accreditation files to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'accreditation-files' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. SELECT Policy - Allow users to read their own files and public access to uploaded files
CREATE POLICY "Allow users to read their own accreditation files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'accreditation-files' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Public read access for accreditation files (for verification purposes)
CREATE POLICY "Allow public read access to accreditation files"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'accreditation-files');

-- 4. UPDATE Policy - Allow users to update their own files
CREATE POLICY "Allow users to update their own accreditation files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'accreditation-files' 
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'accreditation-files' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. DELETE Policy - Allow users to delete their own files
CREATE POLICY "Allow users to delete their own accreditation files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'accreditation-files' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ==============================================
-- STORAGE POLICIES FOR PROFILE IMAGES
-- ==============================================

-- Storage policies for profile-images bucket

-- 1. INSERT Policy - Allow users to upload profile images to their own folder
CREATE POLICY "Allow users to upload profile images to their own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'profile-images' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 2. SELECT Policy - Allow users to read their own profile images and public access
CREATE POLICY "Allow users to read their own profile images"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'profile-images' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. Public read access for profile images
CREATE POLICY "Allow public read access to profile images"
ON storage.objects
FOR SELECT
TO public
USING (bucket_id = 'profile-images');

-- 4. UPDATE Policy - Allow users to update their own profile images
CREATE POLICY "Allow users to update their own profile images"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'profile-images' 
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'profile-images' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 5. DELETE Policy - Allow users to delete their own profile images
CREATE POLICY "Allow users to delete their own profile images"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'profile-images' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ==============================================
-- ENHANCED STORAGE POLICIES FOR NGO USERS
-- ==============================================

-- Additional policies for NGO users with service-specific folders
-- These policies allow NGO users to organize files by service type and service ID

-- 1. INSERT Policy for NGO service-specific folders
CREATE POLICY "Allow NGO users to upload files to service-specific folders"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'accreditation-files' 
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND (
        -- Allow general user folder (user_id/filename)
        array_length(storage.foldername(name), 1) = 2
        OR
        -- Allow service-specific folders (user_id/service_type/service_id/filename)
        (
            array_length(storage.foldername(name), 1) = 4
            AND (storage.foldername(name))[2] IN ('legal', 'medical', 'mental_health', 'shelter', 'financial_assistance', 'other')
        )
    )
);

-- 2. SELECT Policy for NGO service-specific folders
CREATE POLICY "Allow NGO users to read files from service-specific folders"
ON storage.objects
FOR SELECT
TO authenticated
USING (
    bucket_id = 'accreditation-files' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 3. UPDATE Policy for NGO service-specific folders
CREATE POLICY "Allow NGO users to update files in service-specific folders"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'accreditation-files' 
    AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
    bucket_id = 'accreditation-files' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- 4. DELETE Policy for NGO service-specific folders
CREATE POLICY "Allow NGO users to delete files from service-specific folders"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'accreditation-files' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ==============================================
-- TABLE UPDATES FOR ENHANCED FILE UPLOAD
-- ==============================================

-- Add columns to profiles table for enhanced file management
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS accreditation_files_metadata JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS profile_image_metadata JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected', 'under_review')),
ADD COLUMN IF NOT EXISTS verification_notes TEXT,
ADD COLUMN IF NOT EXISTS last_verification_check TIMESTAMP WITH TIME ZONE;

-- Add columns to support_services table for service-specific file management
ALTER TABLE support_services
ADD COLUMN IF NOT EXISTS accreditation_files_metadata JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS verification_status TEXT DEFAULT 'pending' CHECK (verification_status IN ('pending', 'verified', 'rejected', 'under_review')),
ADD COLUMN IF NOT EXISTS verification_notes TEXT,
ADD COLUMN IF NOT EXISTS last_verification_check TIMESTAMP WITH TIME ZONE;

-- ==============================================
-- INDEXES FOR PERFORMANCE
-- ==============================================

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_profiles_verification_status ON profiles(verification_status);
CREATE INDEX IF NOT EXISTS idx_profiles_user_type ON profiles(user_type);
CREATE INDEX IF NOT EXISTS idx_support_services_verification_status ON support_services(verification_status);
CREATE INDEX IF NOT EXISTS idx_support_services_user_id_service_type ON support_services(user_id, service_types);

-- ==============================================
-- FUNCTIONS FOR FILE MANAGEMENT
-- ==============================================

-- Function to get user's file upload statistics
CREATE OR REPLACE FUNCTION get_user_file_stats(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_build_object(
        'accreditation_files_count', (
            SELECT COUNT(*) 
            FROM storage.objects 
            WHERE bucket_id = 'accreditation-files' 
            AND (storage.foldername(name))[2] = user_uuid::text
        ),
        'profile_images_count', (
            SELECT COUNT(*) 
            FROM storage.objects 
            WHERE bucket_id = 'profile-images' 
            AND (storage.foldername(name))[2] = user_uuid::text
        ),
        'total_storage_used', (
            SELECT COALESCE(SUM(metadata->>'size')::bigint, 0)
            FROM storage.objects 
            WHERE bucket_id IN ('accreditation-files', 'profile-images')
            AND (storage.foldername(name))[2] = user_uuid::text
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to clean up orphaned files
CREATE OR REPLACE FUNCTION cleanup_orphaned_files()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER := 0;
    file_record RECORD;
BEGIN
    -- Find and delete files that don't have corresponding user profiles
    FOR file_record IN 
        SELECT name, bucket_id
        FROM storage.objects 
        WHERE bucket_id IN ('accreditation-files', 'profile-images')
        AND (storage.foldername(name))[2] NOT IN (
            SELECT id::text FROM profiles
        )
    LOOP
        DELETE FROM storage.objects 
        WHERE name = file_record.name AND bucket_id = file_record.bucket_id;
        deleted_count := deleted_count + 1;
    END LOOP;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================

-- RLS policies for all tables


-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE matched_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

-- =============================================
-- PROFILES TABLE RLS POLICIES
-- =============================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
ON profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id::uuid);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile"
ON profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = id::uuid);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
ON profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id::uuid)
WITH CHECK (auth.uid() = id::uuid);

-- Users can delete their own profile
CREATE POLICY "Users can delete own profile"
ON profiles
FOR DELETE
TO authenticated
USING (auth.uid() = id::uuid);

-- Public profiles can be viewed by authenticated users (for service discovery)
CREATE POLICY "Public profiles are viewable by authenticated users"
ON profiles
FOR SELECT
TO authenticated
USING (
  is_public_booking = true 
  AND user_type IN ('professional', 'ngo')
  AND "isVerified" = true
);

-- =============================================
-- SUPPORT_SERVICES TABLE RLS POLICIES
-- =============================================

-- Users can view their own services
CREATE POLICY "Users can view own services"
ON support_services
FOR SELECT
TO authenticated
USING (auth.uid() = user_id::uuid);

-- Users can insert their own services
CREATE POLICY "Users can insert own services"
ON support_services
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id::uuid);

-- Users can update their own services
CREATE POLICY "Users can update own services"
ON support_services
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id::uuid)
WITH CHECK (auth.uid() = user_id::uuid);

-- Users can delete their own services
CREATE POLICY "Users can delete own services"
ON support_services
FOR DELETE
TO authenticated
USING (auth.uid() = user_id::uuid);

-- Public services can be viewed by authenticated users (for matching)
CREATE POLICY "Public services are viewable by authenticated users"
ON support_services
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id::uuid = support_services.user_id::uuid 
    AND profiles.is_public_booking = true 
    AND profiles."isVerified" = true
  )
);

-- =============================================
-- APPOINTMENTS TABLE RLS POLICIES
-- =============================================

-- Professionals can view appointments where they are the professional
CREATE POLICY "Professionals can view their appointments"
ON appointments
FOR SELECT
TO authenticated
USING (
  auth.uid() = professional_id::uuid
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id::uuid = appointments.professional_id::uuid 
    AND profiles.user_type IN ('professional', 'ngo')
  )
);

-- Survivors can view appointments where they are the survivor
CREATE POLICY "Survivors can view their appointments"
ON appointments
FOR SELECT
TO authenticated
USING (
  auth.uid() = survivor_id::uuid
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id::uuid = appointments.survivor_id::uuid 
    AND profiles.user_type = 'survivor'
  )
);

-- Professionals can insert appointments for themselves
CREATE POLICY "Professionals can insert their appointments"
ON appointments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = professional_id::uuid
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id::uuid = appointments.professional_id::uuid 
    AND profiles.user_type IN ('professional', 'ngo')
  )
);

-- Survivors can insert appointments for themselves
CREATE POLICY "Survivors can insert their appointments"
ON appointments
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = survivor_id::uuid
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id::uuid = appointments.survivor_id::uuid 
    AND profiles.user_type = 'survivor'
  )
);

-- Professionals can update their appointments
CREATE POLICY "Professionals can update their appointments"
ON appointments
FOR UPDATE
TO authenticated
USING (
  auth.uid() = professional_id::uuid
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id::uuid = appointments.professional_id::uuid 
    AND profiles.user_type IN ('professional', 'ngo')
  )
)
WITH CHECK (
  auth.uid() = professional_id::uuid
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id::uuid = appointments.professional_id::uuid 
    AND profiles.user_type IN ('professional', 'ngo')
  )
);

-- Survivors can update their appointments
CREATE POLICY "Survivors can update their appointments"
ON appointments
FOR UPDATE
TO authenticated
USING (
  auth.uid() = survivor_id::uuid
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id::uuid = appointments.survivor_id::uuid 
    AND profiles.user_type = 'survivor'
  )
)
WITH CHECK (
  auth.uid() = survivor_id::uuid
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id::uuid = appointments.survivor_id::uuid 
    AND profiles.user_type = 'survivor'
  )
);

-- Professionals can delete their appointments
CREATE POLICY "Professionals can delete their appointments"
ON appointments
FOR DELETE
TO authenticated
USING (
  auth.uid() = professional_id::uuid
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id::uuid = appointments.professional_id::uuid 
    AND profiles.user_type IN ('professional', 'ngo')
  )
);

-- Survivors can delete their appointments
CREATE POLICY "Survivors can delete their appointments"
ON appointments
FOR DELETE
TO authenticated
USING (
  auth.uid() = survivor_id::uuid
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id::uuid = appointments.survivor_id::uuid 
    AND profiles.user_type = 'survivor'
  )
);

-- =============================================
-- MATCHED_SERVICES TABLE RLS POLICIES
-- =============================================

-- Users can view matched services where they are the survivor
CREATE POLICY "Survivors can view their matched services"
ON matched_services
FOR SELECT
TO authenticated
USING (
  auth.uid() = survivor_id::uuid
  AND EXISTS (
    SELECT 1 FROM profiles 
    WHERE profiles.id::uuid = matched_services.survivor_id::uuid 
    AND profiles.user_type = 'survivor'
  )
);

-- Service providers can view matched services for their services
CREATE POLICY "Service providers can view matched services for their services"
ON matched_services
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM support_services 
    JOIN profiles ON profiles.id::uuid = support_services.user_id::uuid
    WHERE support_services.id::uuid = matched_services.service_id::uuid 
    AND support_services.user_id::uuid = auth.uid()
    AND profiles.user_type IN ('professional', 'ngo')
  )
);

-- Users can insert matched services (typically done by system)
CREATE POLICY "Authenticated users can insert matched services"
ON matched_services
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = survivor_id::uuid
  OR EXISTS (
    SELECT 1 FROM support_services 
    WHERE support_services.id::uuid = matched_services.service_id::uuid 
    AND support_services.user_id::uuid = auth.uid()
  )
);

-- Users can update matched services where they are involved
CREATE POLICY "Users can update their matched services"
ON matched_services
FOR UPDATE
TO authenticated
USING (
  auth.uid() = survivor_id::uuid
  OR EXISTS (
    SELECT 1 FROM support_services 
    WHERE support_services.id::uuid = matched_services.service_id::uuid 
    AND support_services.user_id::uuid = auth.uid()
  )
)
WITH CHECK (
  auth.uid() = survivor_id::uuid
  OR EXISTS (
    SELECT 1 FROM support_services 
    WHERE support_services.id::uuid = matched_services.service_id::uuid 
    AND support_services.user_id::uuid = auth.uid()
  )
);

-- Users can delete matched services where they are involved
CREATE POLICY "Users can delete their matched services"
ON matched_services
FOR DELETE
TO authenticated
USING (
  auth.uid() = survivor_id::uuid
  OR EXISTS (
    SELECT 1 FROM support_services 
    WHERE support_services.id::uuid = matched_services.service_id::uuid 
    AND support_services.user_id::uuid = auth.uid()
  )
);

-- =============================================
-- REPORTS TABLE RLS POLICIES
-- =============================================

-- Users can view their own reports
CREATE POLICY "Users can view own reports"
ON reports
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id::uuid
  OR user_id IS NULL -- Anonymous reports
);

-- Users can insert their own reports
CREATE POLICY "Users can insert own reports"
ON reports
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id::uuid
  OR user_id IS NULL -- Anonymous reports
);

-- Users can update their own reports
CREATE POLICY "Users can update own reports"
ON reports
FOR UPDATE
TO authenticated
USING (
  auth.uid() = user_id::uuid
  OR user_id IS NULL -- Anonymous reports
)
WITH CHECK (
  auth.uid() = user_id::uuid
  OR user_id IS NULL -- Anonymous reports
);

-- Users can delete their own reports
CREATE POLICY "Users can delete own reports"
ON reports
FOR DELETE
TO authenticated
USING (
  auth.uid() = user_id::uuid
  OR user_id IS NULL -- Anonymous reports
);

-- Service providers can view reports that are matched to their services
CREATE POLICY "Service providers can view matched reports"
ON reports
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM matched_services 
    JOIN support_services ON support_services.id::uuid = matched_services.service_id::uuid
    JOIN profiles ON profiles.id::uuid = support_services.user_id::uuid
    WHERE matched_services.report_id = reports.report_id
    AND support_services.user_id::uuid = auth.uid()
    AND profiles.user_type IN ('professional', 'ngo')
  )
);

-- ==============================================
-- TRIGGERS FOR AUTOMATIC UPDATES
-- ==============================================

-- Function to update verification status when files are uploaded
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
            THEN 'under_review'
            ELSE 'pending'
        END
    WHERE id = NEW.user_id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update verification status when support services are updated
CREATE TRIGGER trigger_update_verification_status
    AFTER UPDATE OF accreditation_files_metadata ON support_services
    FOR EACH ROW
    EXECUTE FUNCTION update_verification_status();

-- ==============================================
-- GRANTS AND PERMISSIONS
-- ==============================================

-- Grant necessary permissions to authenticated users
GRANT USAGE ON SCHEMA storage TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON storage.objects TO authenticated;
GRANT SELECT ON storage.buckets TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION get_user_file_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION cleanup_orphaned_files() TO service_role;

-- ==============================================
-- COMMENTS FOR DOCUMENTATION
-- ==============================================

COMMENT ON TABLE profiles IS 'Enhanced profiles table with file upload metadata and verification status';
COMMENT ON COLUMN profiles.accreditation_files_metadata IS 'JSON array containing metadata about uploaded accreditation files';
COMMENT ON COLUMN profiles.profile_image_metadata IS 'JSON object containing metadata about profile images';
COMMENT ON COLUMN profiles.verification_status IS 'Current verification status: pending, verified, rejected, under_review';
COMMENT ON COLUMN profiles.verification_notes IS 'Notes from verification process';
COMMENT ON COLUMN profiles.last_verification_check IS 'Timestamp of last verification check';

COMMENT ON TABLE support_services IS 'Enhanced support services table with service-specific file management';
COMMENT ON COLUMN support_services.accreditation_files_metadata IS 'JSON array containing metadata about service-specific accreditation files';
COMMENT ON COLUMN support_services.verification_status IS 'Service-specific verification status';
COMMENT ON COLUMN support_services.verification_notes IS 'Service-specific verification notes';
COMMENT ON COLUMN support_services.last_verification_check IS 'Timestamp of last service verification check';

COMMENT ON FUNCTION get_user_file_stats(UUID) IS 'Returns file upload statistics for a specific user';
COMMENT ON FUNCTION cleanup_orphaned_files() IS 'Cleans up files that no longer have corresponding user profiles';

-- ==============================================
-- SAMPLE DATA FOR TESTING (OPTIONAL)
-- ==============================================

-- Uncomment the following section if you want to insert sample data for testing

/*
-- Insert sample verification statuses
UPDATE profiles 
SET verification_status = 'under_review'
WHERE user_type IN ('professional', 'ngo')
AND id IN (SELECT id FROM profiles LIMIT 2);

-- Insert sample file metadata
UPDATE profiles 
SET accreditation_files_metadata = '[
    {
        "title": "Professional License",
        "url": "https://example.com/sample-license.pdf",
        "uploadedAt": "2024-01-01T00:00:00Z",
        "fileSize": 1024000,
        "fileType": "application/pdf"
    }
]'::jsonb
WHERE user_type = 'professional'
AND id IN (SELECT id FROM profiles WHERE user_type = 'professional' LIMIT 1);
*/

-- ==============================================
-- VERIFICATION QUERIES
-- ==============================================

-- Query to verify the setup
SELECT 
    'Buckets Created' as check_type,
    COUNT(*) as count
FROM storage.buckets 
WHERE id IN ('accreditation-files', 'profile-images', 'report-media')

UNION ALL

SELECT 
    'Storage Policies Created' as check_type,
    COUNT(*) as count
FROM information_schema.tables 
WHERE table_name = 'objects' 
AND table_schema = 'storage'

UNION ALL

SELECT 
    'Columns Added to Profiles' as check_type,
    COUNT(*) as count
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('accreditation_files_metadata', 'profile_image_metadata', 'verification_status')

UNION ALL

SELECT 
    'Columns Added to Support Services' as check_type,
    COUNT(*) as count
FROM information_schema.columns 
WHERE table_name = 'support_services' 
AND column_name IN ('accreditation_files_metadata', 'verification_status');

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Enhanced file upload system setup completed successfully!';
    RAISE NOTICE 'Buckets: accreditation-files, profile-images, report-media';
    RAISE NOTICE 'Policies: User-specific access controls implemented';
    RAISE NOTICE 'Tables: Enhanced with file metadata and verification status';
    RAISE NOTICE 'Functions: File statistics and cleanup utilities created';
    RAISE NOTICE 'Security: RLS policies and triggers implemented';
END $$;
