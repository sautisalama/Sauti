-- Team contact book (a light CRM) for the Mjengo suite. Shared by administrators; accessed only through
-- server actions (service role), so RLS is on with no client policies.
create table if not exists public.mjengo_contacts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text,
  phone text,
  organisation text,
  title text,
  tags text[] not null default '{}',
  notes text,
  source text not null default 'manual' check (source in ('manual', 'google', 'csv', 'mail')),
  created_by uuid references public.profiles(id) on delete set null,
  last_contacted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists mjengo_contacts_email_uq on public.mjengo_contacts (lower(email)) where email is not null;
create index if not exists mjengo_contacts_name_idx on public.mjengo_contacts (lower(name));
alter table public.mjengo_contacts enable row level security;
