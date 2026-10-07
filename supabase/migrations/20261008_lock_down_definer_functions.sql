-- Supabase security advisor: SECURITY DEFINER functions callable by anon/authenticated
-- over /rest/v1/rpc, mutable search_path, and a SECURITY DEFINER view.
-- `is_admin` and `check_user_is_chat_participant` stay executable by signed-in
-- users (RLS policies call them); `is_admin` also by anon because public
-- read policies (publications, blogs, courses) evaluate it.

-- Maintenance / device-session helpers and trigger functions: not meant to be
-- called by clients at all (the service role can still call them).
REVOKE ALL ON FUNCTION public.cleanup_orphaned_files() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_user_file_stats(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.revoke_device_session(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_device_session_valid(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_message() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.sync_report_match_status() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.check_user_is_chat_participant(uuid, uuid) FROM PUBLIC, anon;

-- A user may only look up their own role context (admins may look up anyone).
CREATE OR REPLACE FUNCTION public.get_user_role_context(target_user_id uuid DEFAULT auth.uid())
RETURNS TABLE(user_id uuid, primary_role user_type, is_admin boolean, can_switch_to_admin boolean)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN QUERY
  SELECT p.id, p.user_type, p.is_admin, p.is_admin
  FROM public.profiles p
  WHERE p.id = target_user_id
    AND (p.id = auth.uid() OR public.is_admin(auth.uid()));
END;
$$;
REVOKE ALL ON FUNCTION public.get_user_role_context(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_role_context(uuid) TO authenticated;

-- Pin search_path on the remaining functions the advisor flagged.
ALTER FUNCTION public.update_availability_blocks_updated_at() SET search_path = public;
ALTER FUNCTION public.validate_event_details() SET search_path = public;
ALTER FUNCTION public.cleanup_expired_calendar_tokens() SET search_path = public;
ALTER FUNCTION public.generate_blog_slug() SET search_path = public;
ALTER FUNCTION public.update_verification_status() SET search_path = public;
ALTER FUNCTION public.update_verification_timestamp() SET search_path = public;
ALTER FUNCTION public.handle_out_of_office_change() SET search_path = public;
ALTER FUNCTION public.handle_new_message() SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;
ALTER FUNCTION public.sync_report_match_status() SET search_path = public;
ALTER FUNCTION public.cleanup_orphaned_files() SET search_path = public;
ALTER FUNCTION public.get_user_file_stats(uuid) SET search_path = public;
ALTER FUNCTION public.revoke_device_session(uuid, text) SET search_path = public;
ALTER FUNCTION public.is_device_session_valid(uuid, text) SET search_path = public;

-- The admin stats view ran with its owner's rights, exposing counts to anyone
-- who could query it. Evaluate it as the caller instead.
ALTER VIEW public.admin_dashboard_stats SET (security_invoker = on);
