-- 20260402_fix_audio_rls_final.sql
-- Fix report-audio bucket policies for both authenticated and anonymous voice report uploads

-- 1. Ensure the bucket exists and is public
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'report-audio',
    'report-audio', 
    true, 
    52428800, -- 50MB
    ARRAY['audio/webm', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/mpeg']
)
ON CONFLICT (id) DO UPDATE SET 
    public = true,
    file_size_limit = 52428800,
    allowed_mime_types = ARRAY['audio/webm', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/mpeg'];

-- 2. Drop existing restrictive policies if they exist (to avoid duplicates/conflicts)
DROP POLICY IF EXISTS "Allow authenticated users to upload audio files" ON storage.objects;
DROP POLICY IF EXISTS "Allow anonymous users to upload audio files" ON storage.objects;
DROP POLICY IF EXISTS "Allow public read access to audio files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to update audio files" ON storage.objects;
DROP POLICY IF EXISTS "Allow anonymous users to update audio files" ON storage.objects;
DROP POLICY IF EXISTS "Allow authenticated users to delete audio files" ON storage.objects;
DROP POLICY IF EXISTS "Allow anonymous users to delete audio files" ON storage.objects;

-- 3. Create NEW unified policies for reports folder

-- INSERT Policy: Allow both roles to upload to 'reports/'
CREATE POLICY "Allow reports upload for all"
ON storage.objects
FOR INSERT
TO public -- This covers both anon and authenticated
WITH CHECK (
    bucket_id = 'report-audio' 
    AND (storage.foldername(name))[1] = 'reports'
);

-- SELECT Policy: Allow everyone to read from 'reports/'
CREATE POLICY "Allow public read for reports"
ON storage.objects
FOR SELECT
TO public
USING (
    bucket_id = 'report-audio' 
    AND (storage.foldername(name))[1] = 'reports'
);

-- UPDATE/DELETE: Allow specifically authenticated OR anon (for temporary management if needed, usually just insert/select for reports)
CREATE POLICY "Allow management for all"
ON storage.objects
FOR ALL -- Covers UPDATE and DELETE
TO public
USING (
    bucket_id = 'report-audio' 
    AND (storage.foldername(name))[1] = 'reports'
)
WITH CHECK (
    bucket_id = 'report-audio' 
    AND (storage.foldername(name))[1] = 'reports'
);
