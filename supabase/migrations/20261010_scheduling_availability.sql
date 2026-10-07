-- Scheduling fixes found by UAT suite 05:
--  * 'requested' (public booking awaiting confirmation) did not hold the slot, so it could be double-booked.
--  * the slot functions are SECURITY DEFINER so they keep working once availability_blocks is private
--    (see 20261010_availability_blocks_private.sql, which is deploy-gated).

CREATE OR REPLACE FUNCTION public.is_time_slot_available(p_user_id uuid, p_start_time timestamp with time zone, p_end_time timestamp with time zone)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
    has_conflict boolean;
BEGIN
    SELECT EXISTS (
        SELECT 1 FROM public.availability_blocks
        WHERE user_id = p_user_id AND start_time < p_end_time AND end_time > p_start_time
    ) INTO has_conflict;
    IF has_conflict THEN
        RETURN false;
    END IF;

    SELECT EXISTS (
        SELECT 1 FROM public.appointments
        WHERE (professional_id = p_user_id OR survivor_id = p_user_id)
        AND status::text IN ('pending', 'requested', 'confirmed')
        AND appointment_date < p_end_time
        AND (appointment_date + (duration_minutes || ' minutes')::interval) > p_start_time
    ) INTO has_conflict;

    RETURN NOT has_conflict;
END;
$$;

ALTER FUNCTION public.get_available_slots(uuid, date, integer) SECURITY DEFINER;
REVOKE ALL ON FUNCTION public.is_time_slot_available(uuid, timestamp with time zone, timestamp with time zone) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_available_slots(uuid, date, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_time_slot_available(uuid, timestamp with time zone, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_slots(uuid, date, integer) TO authenticated;
