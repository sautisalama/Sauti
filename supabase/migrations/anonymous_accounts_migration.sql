-- =====================================================
-- Anonymous Accounts Migration (Refactored)
-- =====================================================
-- Run this migration in your Supabase SQL editor

-- 1. Add anonymous columns to profiles table
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS anon_username TEXT;

-- 2. Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_profiles_is_anonymous ON profiles(is_anonymous);
CREATE INDEX IF NOT EXISTS idx_profiles_anon_username ON profiles(anon_username);

-- 3. (Optional) Drop the separate table if you created it previously
DROP TABLE IF EXISTS anonymous_accounts;

-- =====================================================
-- INSTRUCTIONS:
-- 1. Copy/Paste into Supabase SQL Editor
-- 2. Run
-- =====================================================
