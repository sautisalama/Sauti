-- Signatures people have added for signing PDFs: private to the owner.
create table if not exists public.mjengo_signatures (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null default 'Signature',
  data_url text not null,
  created_at timestamptz not null default now()
);
create index if not exists mjengo_signatures_owner_idx on public.mjengo_signatures (owner_id, created_at desc);
alter table public.mjengo_signatures enable row level security;
