-- Each person's call background choices and photos, so they follow the account to any device.
create table if not exists public.meet_background_prefs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table public.meet_background_prefs enable row level security;
