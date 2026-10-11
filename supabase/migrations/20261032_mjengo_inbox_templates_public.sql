-- Things that arrive from a phone are flagged until someone looks; templates; a public bucket for form images.
alter table public.mjengo_opportunities add column if not exists inbox boolean not null default false;
alter table public.vault_files add column if not exists inbox boolean not null default false;

create table if not exists public.mjengo_templates (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('document', 'post', 'design')),
  name text not null,
  description text,
  body text,
  data jsonb not null default '{}'::jsonb,
  builtin boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.mjengo_templates enable row level security;

-- Images that appear on public forms must be readable without signing in.
insert into storage.buckets (id, name, public)
values ('mjengo-public', 'mjengo-public', true)
on conflict (id) do nothing;
