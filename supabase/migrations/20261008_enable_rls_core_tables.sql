-- Enable row level security on tables that were fully exposed to the anon key
-- (admin_actions, admin_statistics, blogs, communities, community_members,
-- community_invitations, case_recommendations, case_shares) with policies that
-- match how the app uses each table. Idempotent.
--
-- Helper functions are SECURITY DEFINER with a pinned search_path so policies
-- never recurse into the tables they protect.

-- ── helpers ────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_community_member(p_community uuid, p_user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.community_members WHERE community_id = p_community AND user_id = p_user);
$$;

CREATE OR REPLACE FUNCTION public.can_view_community(p_community uuid, p_user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.communities c
    WHERE c.id = p_community
      AND (c.is_public = true OR c.creator_id = p_user
           OR EXISTS (SELECT 1 FROM public.community_members m WHERE m.community_id = c.id AND m.user_id = p_user)
           OR EXISTS (SELECT 1 FROM public.community_invitations i WHERE i.community_id = c.id AND i.invitee_id = p_user AND i.status IN ('pending', 'accepted')))
  );
$$;

CREATE OR REPLACE FUNCTION public.is_community_manager(p_community uuid, p_user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.communities WHERE id = p_community AND creator_id = p_user)
      OR EXISTS (SELECT 1 FROM public.community_members WHERE community_id = p_community AND user_id = p_user AND role IN ('admin', 'moderator'));
$$;

-- Is the user a party to this match (the survivor or the professional/service owner)?
CREATE OR REPLACE FUNCTION public.is_match_party(p_match uuid, p_user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.matched_services m
    LEFT JOIN public.support_services s ON s.id = m.service_id
    WHERE m.id = p_match AND (m.survivor_id = p_user OR m.hrd_profile_id = p_user OR s.user_id = p_user)
  );
$$;

REVOKE ALL ON FUNCTION public.is_community_member(uuid, uuid), public.can_view_community(uuid, uuid),
  public.is_community_manager(uuid, uuid), public.is_match_party(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_community_member(uuid, uuid), public.can_view_community(uuid, uuid),
  public.is_community_manager(uuid, uuid), public.is_match_party(uuid, uuid) TO authenticated;

-- The member-count trigger updates communities rows the joining user does not own.
CREATE OR REPLACE FUNCTION public.update_community_member_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.communities SET member_count = member_count + 1 WHERE id = NEW.community_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.communities SET member_count = GREATEST(member_count - 1, 0) WHERE id = OLD.community_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Anonymous visitors can't bump view counts through the table any more; use this.
CREATE OR REPLACE FUNCTION public.increment_blog_views(p_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.blogs SET view_count = COALESCE(view_count, 0) + 1 WHERE id = p_id AND status = 'published';
$$;
GRANT EXECUTE ON FUNCTION public.increment_blog_views(uuid) TO anon, authenticated;

-- ── admin_actions (policies already exist; they were never enforced) ────────
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

-- ── admin_statistics ───────────────────────────────────────────────────────
ALTER TABLE public.admin_statistics ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_statistics_admin ON public.admin_statistics;
CREATE POLICY admin_statistics_admin ON public.admin_statistics FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

-- ── blogs ──────────────────────────────────────────────────────────────────
ALTER TABLE public.blogs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS blogs_read ON public.blogs;
CREATE POLICY blogs_read ON public.blogs FOR SELECT
  USING (status = 'published' OR author_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS blogs_admin_all ON public.blogs;
CREATE POLICY blogs_admin_all ON public.blogs FOR ALL TO authenticated
  USING (public.is_admin(auth.uid())) WITH CHECK (public.is_admin(auth.uid()));

DROP POLICY IF EXISTS blogs_author_insert ON public.blogs;
CREATE POLICY blogs_author_insert ON public.blogs FOR INSERT TO authenticated
  WITH CHECK (author_id = auth.uid() AND status IN ('draft', 'pending_review'));

DROP POLICY IF EXISTS blogs_author_update ON public.blogs;
CREATE POLICY blogs_author_update ON public.blogs FOR UPDATE TO authenticated
  USING (author_id = auth.uid() AND status IN ('draft', 'pending_review', 'rejected'))
  WITH CHECK (author_id = auth.uid() AND status IN ('draft', 'pending_review'));

DROP POLICY IF EXISTS blogs_author_delete ON public.blogs;
CREATE POLICY blogs_author_delete ON public.blogs FOR DELETE TO authenticated
  USING (author_id = auth.uid() AND status IN ('draft', 'rejected'));

-- ── communities ────────────────────────────────────────────────────────────
ALTER TABLE public.communities ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS communities_read ON public.communities;
CREATE POLICY communities_read ON public.communities FOR SELECT
  USING (is_public = true
         OR (auth.uid() IS NOT NULL AND (creator_id = auth.uid() OR public.is_community_member(id) OR public.can_view_community(id)))
         OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS communities_insert ON public.communities;
CREATE POLICY communities_insert ON public.communities FOR INSERT TO authenticated
  WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS communities_update ON public.communities;
CREATE POLICY communities_update ON public.communities FOR UPDATE TO authenticated
  USING (creator_id = auth.uid() OR public.is_admin(auth.uid()))
  WITH CHECK (creator_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS communities_delete ON public.communities;
CREATE POLICY communities_delete ON public.communities FOR DELETE TO authenticated
  USING (creator_id = auth.uid() OR public.is_admin(auth.uid()));

-- ── community_members ──────────────────────────────────────────────────────
ALTER TABLE public.community_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_members_read ON public.community_members;
CREATE POLICY community_members_read ON public.community_members FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.can_view_community(community_id) OR public.is_admin(auth.uid()));

-- Join yourself (public, or invited), or let a manager add people.
DROP POLICY IF EXISTS community_members_insert ON public.community_members;
CREATE POLICY community_members_insert ON public.community_members FOR INSERT TO authenticated
  WITH CHECK (
    (user_id = auth.uid() AND role = 'member' AND public.can_view_community(community_id))
    OR (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.communities c WHERE c.id = community_id AND c.creator_id = auth.uid()))
    OR public.is_community_manager(community_id)
  );

DROP POLICY IF EXISTS community_members_update ON public.community_members;
CREATE POLICY community_members_update ON public.community_members FOR UPDATE TO authenticated
  USING (public.is_community_manager(community_id) OR public.is_admin(auth.uid()))
  WITH CHECK (public.is_community_manager(community_id) OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS community_members_delete ON public.community_members;
CREATE POLICY community_members_delete ON public.community_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR public.is_community_manager(community_id) OR public.is_admin(auth.uid()));

-- ── community_invitations ──────────────────────────────────────────────────
ALTER TABLE public.community_invitations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS community_invitations_read ON public.community_invitations;
CREATE POLICY community_invitations_read ON public.community_invitations FOR SELECT TO authenticated
  USING (inviter_id = auth.uid() OR invitee_id = auth.uid() OR public.is_admin(auth.uid()));

DROP POLICY IF EXISTS community_invitations_insert ON public.community_invitations;
CREATE POLICY community_invitations_insert ON public.community_invitations FOR INSERT TO authenticated
  WITH CHECK (inviter_id = auth.uid() AND public.is_community_manager(community_id));

DROP POLICY IF EXISTS community_invitations_update ON public.community_invitations;
CREATE POLICY community_invitations_update ON public.community_invitations FOR UPDATE TO authenticated
  USING (invitee_id = auth.uid() OR inviter_id = auth.uid())
  WITH CHECK (invitee_id = auth.uid() OR inviter_id = auth.uid());

DROP POLICY IF EXISTS community_invitations_delete ON public.community_invitations;
CREATE POLICY community_invitations_delete ON public.community_invitations FOR DELETE TO authenticated
  USING (inviter_id = auth.uid() OR public.is_admin(auth.uid()));

-- ── case_shares ────────────────────────────────────────────────────────────
ALTER TABLE public.case_shares ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS case_shares_read ON public.case_shares;
CREATE POLICY case_shares_read ON public.case_shares FOR SELECT TO authenticated
  USING (
    from_professional_id = auth.uid()
    OR to_professional_id = auth.uid()
    OR public.is_admin(auth.uid())
    OR (to_service_pool = true AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.user_type IN ('professional', 'ngo')))
  );

DROP POLICY IF EXISTS case_shares_insert ON public.case_shares;
CREATE POLICY case_shares_insert ON public.case_shares FOR INSERT TO authenticated
  WITH CHECK (from_professional_id = auth.uid() AND public.is_match_party(match_id));

DROP POLICY IF EXISTS case_shares_update ON public.case_shares;
CREATE POLICY case_shares_update ON public.case_shares FOR UPDATE TO authenticated
  USING (
    from_professional_id = auth.uid() OR to_professional_id = auth.uid() OR public.is_admin(auth.uid())
    OR (to_service_pool = true AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.user_type IN ('professional', 'ngo')))
  )
  WITH CHECK (from_professional_id = auth.uid() OR to_professional_id = auth.uid() OR public.is_admin(auth.uid()));

-- ── case_recommendations ───────────────────────────────────────────────────
ALTER TABLE public.case_recommendations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS case_recommendations_owner ON public.case_recommendations;
CREATE POLICY case_recommendations_owner ON public.case_recommendations FOR ALL TO authenticated
  USING (professional_id = auth.uid())
  WITH CHECK (professional_id = auth.uid() AND public.is_match_party(match_id));

-- The survivor sees only what the professional chose to share.
DROP POLICY IF EXISTS case_recommendations_survivor_read ON public.case_recommendations;
CREATE POLICY case_recommendations_survivor_read ON public.case_recommendations FOR SELECT TO authenticated
  USING (is_shared_with_survivor = true AND EXISTS (SELECT 1 FROM public.matched_services m WHERE m.id = match_id AND m.survivor_id = auth.uid()));

-- A professional a case was forwarded to may read recommendations the sender included.
DROP POLICY IF EXISTS case_recommendations_forwarded_read ON public.case_recommendations;
CREATE POLICY case_recommendations_forwarded_read ON public.case_recommendations FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.case_shares s WHERE s.match_id = case_recommendations.match_id AND s.to_professional_id = auth.uid() AND s.include_recommendations = true));

DROP POLICY IF EXISTS case_recommendations_admin_read ON public.case_recommendations;
CREATE POLICY case_recommendations_admin_read ON public.case_recommendations FOR SELECT TO authenticated
  USING (public.is_admin(auth.uid()));
