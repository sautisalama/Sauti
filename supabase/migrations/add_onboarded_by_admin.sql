-- Migration: Add onboarded_by_admin column to profiles table
-- Purpose: Track professionals/NGOs that were invited by an admin.
-- This flag enables the onboarding flow to start from step 0 with pre-filled
-- data so the user verifies correctness before accepting T&C and completing setup.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarded_by_admin BOOLEAN DEFAULT FALSE;

-- Optional: comment for documentation
COMMENT ON COLUMN public.profiles.onboarded_by_admin IS
  'True when this professional/NGO account was created via the admin invite flow. '
  'The onboarding flow will start from the beginning with pre-filled data, '
  'and the flag is cleared once the user completes onboarding.';
