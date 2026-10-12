-- Waiting room for calls: anyone who is not invited knocks and is admitted (or declined) by a participant.
create table if not exists public.mjengo_meeting_knocks (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  guest_key text not null,
  name text not null,
  user_id uuid references public.profiles(id) on delete set null,
  status text not null default 'pending' check (status in ('pending', 'admitted', 'denied')),
  created_at timestamptz not null default now(),
  decided_by uuid references public.profiles(id) on delete set null,
  decided_at timestamptz,
  unique (code, guest_key)
);
create index if not exists mjengo_meeting_knocks_code_idx on public.mjengo_meeting_knocks (code, status);
-- Only the server (service role) reads and writes these rows.
alter table public.mjengo_meeting_knocks enable row level security;

-- Messages written in the call are kept with the meeting.
alter table public.mjengo_meetings add column if not exists chat jsonb not null default '[]'::jsonb;
-- Host choices such as locking the call.
alter table public.mjengo_meetings add column if not exists settings jsonb not null default '{}'::jsonb;
