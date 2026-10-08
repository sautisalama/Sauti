-- Editing a service's documents used to reset the OWNER's profile to 'under_review' (or 'pending'),
-- even when the profile was already verified and even when nothing changed. Now:
--   * it only acts when the documents actually changed and at least one is attached;
--   * it only moves 'pending' / 'rejected' profiles to 'under_review' (a submission to review);
--   * verified / suspended / already-under-review profiles are never touched.
CREATE OR REPLACE FUNCTION public.update_verification_status()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.accreditation_files_metadata IS DISTINCT FROM OLD.accreditation_files_metadata
     AND NEW.accreditation_files_metadata IS NOT NULL
     AND jsonb_typeof(NEW.accreditation_files_metadata) = 'array'
     AND jsonb_array_length(NEW.accreditation_files_metadata) > 0 THEN
    UPDATE public.profiles
    SET last_verification_check = NOW(),
        verification_status = 'under_review'::verification_status_type
    WHERE id = NEW.user_id
      AND verification_status IN ('pending', 'rejected');
  END IF;
  RETURN NEW;
END;
$$;
