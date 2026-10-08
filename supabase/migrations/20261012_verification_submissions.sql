-- Every time a provider (profile) or a service gets verification documents, record it so the team can
-- be told. Documents are saved from several screens (and from the API), so this is done in the database
-- rather than in each screen: it cannot be missed. The app flushes the ledger by email right away, and
-- the hourly monitor flushes anything that was missed.

CREATE TABLE IF NOT EXISTS public.verification_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('profile', 'service')),
  subject_id uuid NOT NULL,
  owner_id uuid,
  document_count integer NOT NULL DEFAULT 0,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  notified_at timestamptz
);
CREATE INDEX IF NOT EXISTS verification_submissions_pending_idx ON public.verification_submissions (submitted_at) WHERE notified_at IS NULL;
-- Server only: no policies, so only the service role can read or write.
ALTER TABLE public.verification_submissions ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.track_verification_submission()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  new_n integer := 0;
  old_n integer := 0;
  k text := CASE TG_TABLE_NAME WHEN 'profiles' THEN 'profile' ELSE 'service' END;
  owner uuid;
BEGIN
  -- to_jsonb avoids naming a column the other table does not have (plpgsql checks field names when it plans)
  owner := CASE TG_TABLE_NAME WHEN 'profiles' THEN NEW.id ELSE (to_jsonb(NEW) ->> 'user_id')::uuid END;
  IF NEW.accreditation_files_metadata IS NOT NULL AND jsonb_typeof(NEW.accreditation_files_metadata) = 'array' THEN
    new_n := jsonb_array_length(NEW.accreditation_files_metadata);
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.accreditation_files_metadata IS NOT NULL AND jsonb_typeof(OLD.accreditation_files_metadata) = 'array' THEN
    old_n := jsonb_array_length(OLD.accreditation_files_metadata);
  END IF;
  -- only when documents were ADDED (removing one is not a submission)
  IF new_n > old_n THEN
    UPDATE public.verification_submissions
       SET document_count = new_n, submitted_at = now()
     WHERE subject_id = NEW.id AND kind = k AND notified_at IS NULL;
    IF NOT FOUND THEN
      INSERT INTO public.verification_submissions (kind, subject_id, owner_id, document_count)
      VALUES (k, NEW.id, owner, new_n);
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.track_verification_submission() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_profiles_verification_submission ON public.profiles;
CREATE TRIGGER trg_profiles_verification_submission AFTER INSERT OR UPDATE OF accreditation_files_metadata ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.track_verification_submission();
DROP TRIGGER IF EXISTS trg_services_verification_submission ON public.support_services;
CREATE TRIGGER trg_services_verification_submission AFTER INSERT OR UPDATE OF accreditation_files_metadata ON public.support_services
  FOR EACH ROW EXECUTE FUNCTION public.track_verification_submission();
