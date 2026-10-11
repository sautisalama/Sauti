-- When someone last looked at a form's responses, so the navigation can count the new ones.
alter table public.mjengo_forms add column if not exists responses_seen_at timestamptz not null default now();
