-- Conferencing, the AI assistant, design systems, and the content scheduler for the Mjengo suite.
-- Every table has RLS on and no client policies: all access goes through server actions.

create table if not exists public.mjengo_meetings (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  title text,
  mode text not null default 'video' check (mode in ('video', 'voice')),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  ended_at timestamptz,
  transcript jsonb not null default '[]'::jsonb
);
alter table public.mjengo_meetings enable row level security;

create table if not exists public.mjengo_design_systems (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  colors jsonb not null default '[]'::jsonb,
  fonts text,
  voice text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.mjengo_design_systems enable row level security;

create table if not exists public.mjengo_ai_threads (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  title text not null default 'New chat',
  design_system_id uuid references public.mjengo_design_systems(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mjengo_ai_threads_owner_idx on public.mjengo_ai_threads (owner_id, updated_at desc);
alter table public.mjengo_ai_threads enable row level security;

create table if not exists public.mjengo_ai_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references public.mjengo_ai_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  asset_id uuid,
  tokens int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists mjengo_ai_messages_thread_idx on public.mjengo_ai_messages (thread_id, created_at);
alter table public.mjengo_ai_messages enable row level security;

-- One row per person: their own provider key (encrypted) and how much of the shared allowance they used.
create table if not exists public.mjengo_ai_settings (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  provider text check (provider in ('openrouter', 'openai')),
  api_key_enc text,
  model text,
  free_tokens_used int not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.mjengo_ai_settings enable row level security;

create table if not exists public.mjengo_assets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  path text not null,
  mime text,
  kind text not null default 'image',
  prompt text,
  design_system_id uuid references public.mjengo_design_systems(id) on delete set null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.mjengo_assets enable row level security;

create table if not exists public.mjengo_posts (
  id uuid primary key default gen_random_uuid(),
  title text,
  body text not null default '',
  channels text[] not null default '{}',
  media uuid[] not null default '{}',
  scheduled_for timestamptz,
  status text not null default 'draft' check (status in ('draft', 'scheduled', 'posted', 'cancelled')),
  posted_at timestamptz,
  notified_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mjengo_posts_schedule_idx on public.mjengo_posts (scheduled_for) where status = 'scheduled';
alter table public.mjengo_posts enable row level security;
