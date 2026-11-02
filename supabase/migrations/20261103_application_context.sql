-- What the application agent knows about one opportunity beyond the record itself: the instructions the team gave it,
-- and context items they added (links, skills, notes, files from Files, files from Google Drive).
-- A file item only points at the file; removing the item never touches the file.
create table if not exists public.mjengo_context_items (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  entity_id uuid not null,
  kind text not null check (kind in ('instruction','link','skill','note','file','drive')),
  title text not null default '',
  body text not null default '',
  url text,
  vault_file_id uuid references public.vault_files(id) on delete cascade,
  drive_file_id text,
  include boolean not null default true,
  created_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mjengo_context_entity_idx on public.mjengo_context_items (entity_type, entity_id, created_at);
create unique index if not exists mjengo_context_one_instruction on public.mjengo_context_items (entity_type, entity_id) where kind = 'instruction';
alter table public.mjengo_context_items enable row level security;
