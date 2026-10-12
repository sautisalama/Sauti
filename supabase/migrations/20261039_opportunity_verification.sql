-- What the verification of an opportunity found: who it is really from, their website, the checks and the trust level.
alter table public.mjengo_opportunities add column if not exists verification jsonb;
alter table public.mjengo_opportunities add column if not exists verified_at timestamptz;
