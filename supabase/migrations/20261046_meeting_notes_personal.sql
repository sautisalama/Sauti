-- Structured notes for a call (summary, TLDR, decisions, actions with owners) and whether a guest summary was sent.
alter table public.mjengo_meetings add column if not exists notes_json jsonb;
alter table public.mjengo_meetings add column if not exists notes_emailed_at timestamptz;
alter table public.mjengo_meetings add column if not exists notes_emailed_to text[] not null default '{}';
