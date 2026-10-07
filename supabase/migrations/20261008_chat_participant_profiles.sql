-- Chat counterparts showed as "Unknown User": RLS on profiles lets you read only
-- your own row, admins, and verified public-booking professionals, so a survivor
-- chatting with a non-public professional (or the reverse) got nothing back.
--
-- Widening the profiles policy would expose WHOLE rows (profiles also holds
-- calendar OAuth tokens), so instead expose just the display fields, and only for
-- people who share a chat with the caller.
CREATE OR REPLACE FUNCTION public.get_chat_participant_profiles(p_chat_ids uuid[])
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  avatar_url text,
  profile_image_url text,
  user_type public.user_type,
  out_of_office boolean
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT DISTINCT p.id, p.first_name, p.last_name, p.avatar_url, p.profile_image_url, p.user_type, p.out_of_office
  FROM public.chat_participants me
  JOIN public.chat_participants cp ON cp.chat_id = me.chat_id
  JOIN public.profiles p ON p.id = cp.user_id
  WHERE me.user_id = auth.uid()
    AND me.chat_id = ANY (p_chat_ids);
$$;

REVOKE ALL ON FUNCTION public.get_chat_participant_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_chat_participant_profiles(uuid[]) TO authenticated;
