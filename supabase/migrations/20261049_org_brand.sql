-- One organisation-wide brand profile: colours, fonts, logo, letterhead and the rules read from the guidelines document.
create table if not exists public.mjengo_brand (
  id text primary key default 'org',
  data jsonb not null default '{}'::jsonb,
  guidelines_file_id uuid references public.vault_files(id) on delete set null,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.mjengo_brand enable row level security;
