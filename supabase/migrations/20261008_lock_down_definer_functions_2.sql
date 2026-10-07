-- Follow-up to 20261008_lock_down_definer_functions.sql (applied to dev and production).
-- Trigger-only function: not callable over /rest/v1/rpc, and triggers don't need EXECUTE.
REVOKE ALL ON FUNCTION public.update_community_member_count() FROM PUBLIC, anon, authenticated;

-- Pin search_path on the last functions the advisor flagged.
ALTER FUNCTION public.get_coverage_map_data() SET search_path = public;
ALTER FUNCTION public.is_time_slot_available(uuid, timestamp with time zone, timestamp with time zone) SET search_path = public;
ALTER FUNCTION public.get_available_slots(uuid, date, integer) SET search_path = public;
ALTER FUNCTION public.get_active_case_count(uuid) SET search_path = public;
