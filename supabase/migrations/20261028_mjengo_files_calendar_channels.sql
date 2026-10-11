-- Files (vault + Drive), calendar events, assistant status and documents, channel connections for the content scheduler.

-- A person's lasting link to their Google Drive (refresh token, encrypted by the app).
create table if not exists public.mjengo_drive_connections (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  google_email text,
  refresh_token_enc text not null,
  connected_at timestamptz not null default now()
);
alter table public.mjengo_drive_connections enable row level security;

alter table public.vault_files add column if not exists last_opened_at timestamptz;
alter table public.vault_files add column if not exists drive_synced_at timestamptz;
alter table public.vault_folders add column if not exists drive_folder_id text;
alter table public.vault_folders add column if not exists drive_link text;

-- Documents that steer a design system (PDFs and others kept in the vault).
create table if not exists public.mjengo_design_system_files (
  design_system_id uuid not null references public.mjengo_design_systems(id) on delete cascade,
  file_id uuid not null references public.vault_files(id) on delete cascade,
  excerpt text,
  added_by uuid references public.profiles(id) on delete set null,
  added_at timestamptz not null default now(),
  primary key (design_system_id, file_id)
);
alter table public.mjengo_design_system_files enable row level security;

-- Assistant chats: still running, or failed (kept in the list either way).
alter table public.mjengo_ai_threads add column if not exists status text not null default 'idle' check (status in ('idle', 'running', 'failed'));
alter table public.mjengo_ai_threads add column if not exists error text;
alter table public.mjengo_ai_messages add column if not exists file_ids uuid[] not null default '{}';

-- Calendar events created in the suite (also pushed to Google Calendar when it is connected).
create table if not exists public.mjengo_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  location text,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  all_day boolean not null default false,
  kind text not null default 'event' check (kind in ('event', 'meeting')),
  meeting_code text,
  attendees text[] not null default '{}',
  google_event_id text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists mjengo_events_start_idx on public.mjengo_events (starts_at);
alter table public.mjengo_events enable row level security;

-- Connected social accounts for publishing.
create table if not exists public.mjengo_channel_connections (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('linkedin', 'x', 'facebook', 'instagram')),
  account_id text,
  account_name text,
  access_token_enc text not null,
  refresh_token_enc text,
  expires_at timestamptz,
  meta jsonb not null default '{}'::jsonb,
  connected_by uuid references public.profiles(id) on delete set null,
  connected_at timestamptz not null default now(),
  unique (channel, account_id)
);
alter table public.mjengo_channel_connections enable row level security;

-- Posts: wording per channel, and what happened when each was published.
alter table public.mjengo_posts add column if not exists variants jsonb not null default '{}'::jsonb;
alter table public.mjengo_posts add column if not exists results jsonb not null default '{}'::jsonb;
alter table public.mjengo_posts add column if not exists link_url text;
