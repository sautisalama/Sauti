-- Saved mail views (like Notion Mail's database-style views) and reusable snippets, per admin.
create table if not exists public.mail_views (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  icon text not null default 'inbox',
  config jsonb not null default '{}'::jsonb,
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists mail_views_owner_idx on public.mail_views (owner_id, position);

create table if not exists public.mail_snippets (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  body_html text not null,
  created_at timestamptz not null default now()
);
create index if not exists mail_snippets_owner_idx on public.mail_snippets (owner_id);

alter table public.mail_views enable row level security;
alter table public.mail_snippets enable row level security;
create policy "mail_views_owner" on public.mail_views for all to authenticated
  using (owner_id = (select auth.uid()) and public.is_admin((select auth.uid())))
  with check (owner_id = (select auth.uid()) and public.is_admin((select auth.uid())));
create policy "mail_snippets_owner" on public.mail_snippets for all to authenticated
  using (owner_id = (select auth.uid()) and public.is_admin((select auth.uid())))
  with check (owner_id = (select auth.uid()) and public.is_admin((select auth.uid())));
