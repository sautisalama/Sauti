-- Fix report-audio bucket policies for voice recording uploads
-- This script recreates the bucket and policies to allow proper audio file uploads

-- First, drop the existing bucket and all its policies
DELETE FROM storage.buckets WHERE id = 'report-audio';

-- Recreate the bucket as public (for easier access to uploaded files)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'report-audio',
    'report-audio', 
    true, -- Make it public for easier access
    52428800, -- 50MB file size limit
    ARRAY['audio/webm', 'audio/mp4', 'audio/wav', 'audio/ogg', 'audio/mpeg']
);

-- Create policies for the report-audio bucket

-- 1. INSERT Policy - Allow authenticated users to upload audio files to reports folder
CREATE POLICY "Allow authenticated users to upload audio files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'report-audio' 
    AND (storage.foldername(name))[1] = 'reports'
);

-- 2. SELECT Policy - Allow anyone to read audio files from reports folder
CREATE POLICY "Allow public read access to audio files"
ON storage.objects
FOR SELECT
TO public
USING (
    bucket_id = 'report-audio' 
    AND (storage.foldername(name))[1] = 'reports'
);

-- 3. UPDATE Policy - Allow authenticated users to update audio files
CREATE POLICY "Allow authenticated users to update audio files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (
    bucket_id = 'report-audio' 
    AND (storage.foldername(name))[1] = 'reports'
)
WITH CHECK (
    bucket_id = 'report-audio' 
    AND (storage.foldername(name))[1] = 'reports'
);

-- 4. DELETE Policy - Allow authenticated users to delete audio files
CREATE POLICY "Allow authenticated users to delete audio files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
    bucket_id = 'report-audio' 
    AND (storage.foldername(name))[1] = 'reports'
);

-- Alternative: More permissive policies for anonymous users (uncomment if needed)
-- This allows both authenticated and anonymous users to upload audio files

-- Uncomment these if you want to allow anonymous uploads:
/*
-- INSERT Policy for anonymous users
CREATE POLICY "Allow anonymous users to upload audio files"
ON storage.objects
FOR INSERT
TO anon
WITH CHECK (
    bucket_id = 'report-audio' 
    AND (storage.foldername(name))[1] = 'reports'
);

-- UPDATE Policy for anonymous users
CREATE POLICY "Allow anonymous users to update audio files"
ON storage.objects
FOR UPDATE
TO anon
USING (
    bucket_id = 'report-audio' 
    AND (storage.foldername(name))[1] = 'reports'
)
WITH CHECK (
    bucket_id = 'report-audio' 
    AND (storage.foldername(name))[1] = 'reports'
);

-- DELETE Policy for anonymous users
CREATE POLICY "Allow anonymous users to delete audio files"
ON storage.objects
FOR DELETE
TO anon
USING (
    bucket_id = 'report-audio' 
    AND (storage.foldername(name))[1] = 'reports'
);
*/

-- Verify the bucket was created successfully
SELECT 
    id, 
    name, 
    public, 
    file_size_limit, 
    allowed_mime_types,
    created_at
FROM storage.buckets 
WHERE id = 'report-audio';

-- Verify policies were created
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'objects' 
AND policyname LIKE '%audio%'
ORDER BY policyname;
