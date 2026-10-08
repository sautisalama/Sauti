-- The policy "Public profiles are viewable by authenticated users" let EVERY signed-in user read the whole
-- profile row (email, phone, accreditation files, devices, verification notes ...) of any verified
-- public-booking professional/NGO, and hid providers a survivor was actually matched with whenever
-- public booking was off. Visibility is now relationship-based:
--   * verified professionals/NGOs can see other verified professionals/NGOs (forwarding, directory);
--   * anyone else sees only providers they have a match, an appointment, or a private chat with.
-- The anonymous public booking page is unaffected (it reads through the server with a safe column list).

CREATE OR REPLACE FUNCTION public.can_view_provider_profile(target uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    EXISTS (SELECT 1 FROM public.profiles me WHERE me.id = auth.uid() AND me."isVerified" = true AND me.user_type IN ('professional', 'ngo'))
    OR EXISTS (
      SELECT 1 FROM public.matched_services m
      WHERE m.survivor_id = auth.uid()
        AND (m.hrd_profile_id = target OR EXISTS (SELECT 1 FROM public.support_services s WHERE s.id = m.service_id AND s.user_id = target))
    )
    OR EXISTS (SELECT 1 FROM public.appointments a WHERE a.survivor_id = auth.uid() AND a.professional_id = target)
    OR EXISTS (
      SELECT 1 FROM public.chat_participants mine
      JOIN public.chat_participants theirs ON theirs.chat_id = mine.chat_id
      JOIN public.chats c ON c.id = mine.chat_id
      WHERE mine.user_id = auth.uid() AND theirs.user_id = target AND c.type::text <> 'community'
    )
  );
$$;
REVOKE ALL ON FUNCTION public.can_view_provider_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_view_provider_profile(uuid) TO authenticated;

DROP POLICY IF EXISTS "Public profiles are viewable by authenticated users" ON public.profiles;
CREATE POLICY "Providers are visible to related users" ON public.profiles FOR SELECT TO authenticated
  USING ("isVerified" = true AND user_type IN ('professional', 'ngo') AND public.can_view_provider_profile(id));
