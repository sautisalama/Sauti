-- Google Calendar OAuth tokens lived on `profiles`, whose row-level policy lets every
-- signed-in user read the WHOLE row of any verified public-booking professional.
-- Tokens move to a server-only table (no client policies; encrypted by the app).
-- Phase 1 of 2 — applied to dev and production. Phase 2 drops the old columns:
-- see 20261009_drop_profile_calendar_token_columns.sql (apply AFTER deploying the app).

CREATE TABLE IF NOT EXISTS public.profile_calendar_tokens (
  user_id       uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  access_token  text,
  refresh_token text,
  expiry_date   bigint,
  updated_at    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profile_calendar_tokens ENABLE ROW LEVEL SECURITY;

-- No client policies on purpose: only server code (service role) reads or writes tokens.
-- Browsers learn "connected or not" through the RPCs below.
DROP POLICY IF EXISTS calendar_tokens_owner ON public.profile_calendar_tokens;

DROP TRIGGER IF EXISTS trg_profile_calendar_tokens_touch ON public.profile_calendar_tokens;
CREATE TRIGGER trg_profile_calendar_tokens_touch BEFORE UPDATE ON public.profile_calendar_tokens
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Copy what exists (idempotent). Legacy values are plaintext; the app encrypts on next write.
INSERT INTO public.profile_calendar_tokens (user_id, access_token, refresh_token, expiry_date)
SELECT id, google_calendar_token, google_calendar_refresh_token, google_calendar_token_expiry
FROM public.profiles
WHERE google_calendar_token IS NOT NULL OR google_calendar_refresh_token IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.get_calendar_connection()
RETURNS TABLE (connected boolean, expiry_date bigint)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT (t.access_token IS NOT NULL), t.expiry_date FROM public.profile_calendar_tokens t WHERE t.user_id = auth.uid()
  UNION ALL SELECT false, NULL::bigint WHERE NOT EXISTS (SELECT 1 FROM public.profile_calendar_tokens t WHERE t.user_id = auth.uid())
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.disconnect_calendar()
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM public.profile_calendar_tokens WHERE user_id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_calendar_connection(), public.disconnect_calendar() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_calendar_connection(), public.disconnect_calendar() TO authenticated;
