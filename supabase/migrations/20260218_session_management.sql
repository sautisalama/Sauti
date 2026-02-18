-- Migration to move device session management to a dedicated column
-- Created: 2026-02-18

-- 1. Add the new dedicated columns and set default for settings
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS devices JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS policies JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.profiles ALTER COLUMN settings SET DEFAULT '{"device_tracking_enabled": true}'::jsonb;

-- 2. Data Migration: Move devices and policies from settings JSONB to their own columns
DO $$ 
BEGIN
    -- Move devices
    UPDATE public.profiles
    SET devices = COALESCE(settings->'devices', '[]'::jsonb),
        settings = settings - 'devices'
    WHERE settings ? 'devices' AND (devices IS NULL OR devices = '[]'::jsonb);

    -- Move policies
    UPDATE public.profiles
    SET policies = jsonb_build_object(
            'accepted_policies', COALESCE(settings->'accepted_policies', '[]'::jsonb),
            'all_policies_accepted', COALESCE(settings->'all_policies_accepted', 'false'::jsonb),
            'policies_accepted_at', COALESCE(settings->'policies_accepted_at', 'null'::jsonb)
        ),
        settings = settings - 'accepted_policies' - 'all_policies_accepted' - 'policies_accepted_at'
    WHERE (settings ? 'accepted_policies' OR settings ? 'all_policies_accepted') 
      AND (policies IS NULL OR policies = '{}'::jsonb);

    -- Ensure device_tracking_enabled is true for everyone who hasn't explicitly disabled it
    UPDATE public.profiles
    SET settings = COALESCE(settings, '{}'::jsonb) || '{"device_tracking_enabled": true}'::jsonb
    WHERE settings IS NULL OR NOT (settings ? 'device_tracking_enabled');
END $$;

-- 3. Function to check if a specific device session is valid
CREATE OR REPLACE FUNCTION public.is_device_session_valid(p_user_id UUID, p_device_id TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    v_devices JSONB;
    v_settings JSONB;
    v_tracking_enabled BOOLEAN;
    v_device_exists BOOLEAN;
BEGIN
    -- Get user devices and settings
    SELECT devices, settings INTO v_devices, v_settings FROM public.profiles WHERE id = p_user_id;

    -- Check if tracking is enabled in settings (default to TRUE if not specified)
    v_tracking_enabled := COALESCE((v_settings->>'device_tracking_enabled')::BOOLEAN, TRUE);

    -- If tracking is disabled, we don't enforce device-specific sessions
    IF NOT v_tracking_enabled THEN
        RETURN TRUE;
    END IF;

    -- Check if the device ID exists in the new devices column
    SELECT EXISTS (
        SELECT 1 
        FROM jsonb_array_elements(COALESCE(v_devices, '[]'::jsonb)) AS d 
        WHERE d->>'id' = p_device_id
    ) INTO v_device_exists;

    RETURN v_device_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Function to revoke a specific device from the dedicated devices column
CREATE OR REPLACE FUNCTION public.revoke_device_session(p_user_id UUID, p_device_id TEXT)
RETURNS VOID AS $$
BEGIN
    UPDATE public.profiles
    SET devices = COALESCE(
        (
            SELECT jsonb_agg(d)
            FROM jsonb_array_elements(devices) AS d
            WHERE d->>'id' != p_device_id
        ),
        '[]'::jsonb
    )
    WHERE id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
