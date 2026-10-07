-- PHASE 2 of the calendar-token move. DO NOT APPLY until the app version that reads
-- tokens from `profile_calendar_tokens` (lib/calendar/tokens.ts) is deployed:
-- older code still selects these columns and would error once they are gone.
--
-- Before dropping, make sure DATA_ENCRYPTION_KEY is set in the deployed environment, then
-- have each connected user reconnect (or run a one-off re-encrypt) so no legacy plaintext
-- tokens remain in profile_calendar_tokens. Dropping the columns removes the plaintext
-- copies that every signed-in user could previously read for public professionals.

ALTER TABLE public.profiles DROP COLUMN IF EXISTS google_calendar_token;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS google_calendar_refresh_token;
ALTER TABLE public.profiles DROP COLUMN IF EXISTS google_calendar_token_expiry;
