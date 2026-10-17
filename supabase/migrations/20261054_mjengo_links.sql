-- The timeline: calls, files and events can be linked to a grant, opportunity, project or fellowship, so one
-- record gathers everything about it. Links are made by hand or found by the system (a call whose notes name the
-- record), and never change the call, file or event themselves.
create table if not exists public.mjengo_links (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('grant', 'opportunity', 'project', 'fellowship')),
  entity_id uuid not null,
  item_type text not null check (item_type in ('meeting', 'file', 'event')),
  item_id text not null,
  auto boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (entity_type, entity_id, item_type, item_id)
);
create index if not exists mjengo_links_entity_idx on public.mjengo_links (entity_type, entity_id);
create index if not exists mjengo_links_item_idx on public.mjengo_links (item_type, item_id);
alter table public.mjengo_links enable row level security;
