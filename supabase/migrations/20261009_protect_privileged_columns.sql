-- SECURITY: a signed-in user could PATCH their own `profiles` row (RLS only checks
-- id = auth.uid(), not WHICH columns) and so make themselves admin, mark themselves
-- verified, clear their own ban, or verify their own support service.
-- Column-level rules live in triggers, because RLS cannot restrict columns.
--
-- Who is exempt: trusted callers with no end-user identity (service role, migrations:
-- auth.uid() IS NULL) and admins (the admin dashboard acts as the admin user).

CREATE OR REPLACE FUNCTION public.protect_profile_privileged_columns()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- A user may create only their own, unprivileged, unverified profile.
    NEW.is_admin := false;
    NEW.is_banned := false;
    NEW.banned_at := NULL;
    NEW.banned_by := NULL;
    NEW.ban_reason := NULL;
    NEW."isVerified" := false;
    NEW.admin_verified_at := NULL;
    NEW.admin_verified_by := NULL;
    NEW.reviewed_by := NULL;
    NEW.verification_notes := NULL;
    IF NEW.verification_status::text NOT IN ('pending', 'under_review') THEN
      NEW.verification_status := 'pending';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin
     OR NEW.is_banned IS DISTINCT FROM OLD.is_banned
     OR NEW.banned_at IS DISTINCT FROM OLD.banned_at
     OR NEW.banned_by IS DISTINCT FROM OLD.banned_by
     OR NEW.ban_reason IS DISTINCT FROM OLD.ban_reason
     OR NEW.admin_verified_at IS DISTINCT FROM OLD.admin_verified_at
     OR NEW.admin_verified_by IS DISTINCT FROM OLD.admin_verified_by
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     OR NEW.verification_notes IS DISTINCT FROM OLD.verification_notes
     OR NEW.onboarded_by_admin IS DISTINCT FROM OLD.onboarded_by_admin THEN
    RAISE EXCEPTION 'Only an administrator can change this field' USING ERRCODE = '42501';
  END IF;

  -- Submitting documents may move a profile to pending / under review; only an admin can verify or reject.
  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     AND NEW.verification_status::text NOT IN ('pending', 'under_review') THEN
    RAISE EXCEPTION 'Only an administrator can verify or reject a profile' USING ERRCODE = '42501';
  END IF;
  IF NEW."isVerified" IS DISTINCT FROM OLD."isVerified" AND NEW."isVerified" = true THEN
    RAISE EXCEPTION 'Only an administrator can verify a profile' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_profile_privileged_columns ON public.profiles;
CREATE TRIGGER trg_protect_profile_privileged_columns
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_privileged_columns();

CREATE OR REPLACE FUNCTION public.protect_service_privileged_columns()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.is_banned := false;
    NEW.banned_at := NULL;
    NEW.banned_by := NULL;
    NEW.ban_reason := NULL;
    NEW.is_permanently_suspended := false;
    NEW.suspension_end_date := NULL;
    NEW.suspension_reason := NULL;
    NEW.verified_by := NULL;
    NEW.verified_at := NULL;
    NEW.reviewed_by := NULL;
    NEW.verification_notes := NULL;
    IF NEW.verification_status::text NOT IN ('pending', 'under_review') THEN
      NEW.verification_status := 'pending';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.is_banned IS DISTINCT FROM OLD.is_banned
     OR NEW.banned_at IS DISTINCT FROM OLD.banned_at
     OR NEW.banned_by IS DISTINCT FROM OLD.banned_by
     OR NEW.ban_reason IS DISTINCT FROM OLD.ban_reason
     OR NEW.is_permanently_suspended IS DISTINCT FROM OLD.is_permanently_suspended
     OR NEW.suspension_end_date IS DISTINCT FROM OLD.suspension_end_date
     OR NEW.suspension_reason IS DISTINCT FROM OLD.suspension_reason
     OR NEW.verified_by IS DISTINCT FROM OLD.verified_by
     OR NEW.verified_at IS DISTINCT FROM OLD.verified_at
     OR NEW.reviewed_by IS DISTINCT FROM OLD.reviewed_by
     OR NEW.verification_notes IS DISTINCT FROM OLD.verification_notes THEN
    RAISE EXCEPTION 'Only an administrator can change this field' USING ERRCODE = '42501';
  END IF;

  IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
     AND NEW.verification_status::text NOT IN ('pending', 'under_review') THEN
    RAISE EXCEPTION 'Only an administrator can verify or reject a service' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_service_privileged_columns ON public.support_services;
CREATE TRIGGER trg_protect_service_privileged_columns
  BEFORE INSERT OR UPDATE ON public.support_services
  FOR EACH ROW EXECUTE FUNCTION public.protect_service_privileged_columns();

-- The profiles INSERT policy had no WITH CHECK, so a user could create rows for any id.
DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

-- ── matched_services ──
-- Matches are created by the matching engine (service role). The old INSERT policy let a
-- survivor create a match row against ANY provider's service, in any status.
DROP POLICY IF EXISTS "Authenticated users can insert matched services" ON public.matched_services;

-- Standalone professionals (matched via hrd_profile_id, no service) could not update their own matches.
DROP POLICY IF EXISTS "Users can update their matched services" ON public.matched_services;
CREATE POLICY "Users can update their matched services" ON public.matched_services FOR UPDATE TO authenticated
  USING (auth.uid() = survivor_id OR auth.uid() = hrd_profile_id
         OR EXISTS (SELECT 1 FROM public.support_services s WHERE s.id = matched_services.service_id AND s.user_id = auth.uid()))
  WITH CHECK (auth.uid() = survivor_id OR auth.uid() = hrd_profile_id
         OR EXISTS (SELECT 1 FROM public.support_services s WHERE s.id = matched_services.service_id AND s.user_id = auth.uid()));

-- Parties may progress a match, but not re-point it at another report/service/person or edit its score.
CREATE OR REPLACE FUNCTION public.protect_match_identity_columns()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NULL OR public.is_admin(auth.uid()) THEN
    RETURN NEW;
  END IF;
  IF NEW.report_id IS DISTINCT FROM OLD.report_id
     OR NEW.service_id IS DISTINCT FROM OLD.service_id
     OR NEW.hrd_profile_id IS DISTINCT FROM OLD.hrd_profile_id
     OR NEW.survivor_id IS DISTINCT FROM OLD.survivor_id
     OR NEW.match_score IS DISTINCT FROM OLD.match_score
     OR NEW.cascade_level IS DISTINCT FROM OLD.cascade_level THEN
    RAISE EXCEPTION 'This match field cannot be changed' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_protect_match_identity_columns ON public.matched_services;
CREATE TRIGGER trg_protect_match_identity_columns
  BEFORE UPDATE ON public.matched_services
  FOR EACH ROW EXECUTE FUNCTION public.protect_match_identity_columns();
