-- Group invite codes, super admins + audit log, platform email log, connected mailboxes and the Mjengo suite.

-- ---------------------------------------------------------------------------------------------
-- 1. Group invite codes (shareable link / QR for a community)
-- ---------------------------------------------------------------------------------------------
alter table public.communities add column if not exists invite_code text;

create or replace function public.gen_invite_code() returns text
language plpgsql volatile as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code text;
  i int;
begin
  loop
    code := 'SG-';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      if i = 4 then code := code || '-'; end if;
    end loop;
    exit when not exists (select 1 from public.communities where invite_code = code);
  end loop;
  return code;
end $$;

update public.communities set invite_code = public.gen_invite_code() where invite_code is null;
create unique index if not exists communities_invite_code_key on public.communities (invite_code);

create or replace function public.communities_assign_invite_code() returns trigger
language plpgsql as $$
begin
  if new.invite_code is null then new.invite_code := public.gen_invite_code(); end if;
  return new;
end $$;
drop trigger if exists trg_communities_invite_code on public.communities;
create trigger trg_communities_invite_code before insert on public.communities
  for each row execute function public.communities_assign_invite_code();

-- ---------------------------------------------------------------------------------------------
-- 2. Super admins and the audit log (server-side only: RLS on, no client policies)
-- ---------------------------------------------------------------------------------------------
create table if not exists public.super_admins (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  user_id uuid references public.profiles(id) on delete set null,
  is_protected boolean not null default false,
  added_by text,
  created_at timestamptz not null default now()
);
create unique index if not exists super_admins_email_key on public.super_admins (lower(email));
alter table public.super_admins enable row level security;

insert into public.super_admins (email, is_protected) values
  ('oliverwai9na@gmail.com', true),
  ('oliver@sautisalama.org', true),
  ('malkia@sautisalama.org', false)
on conflict do nothing;

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  actor_email text,
  action text not null,
  target_type text,
  target_id text,
  target_label text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_logs_created_idx on public.audit_logs (created_at desc);
create index if not exists audit_logs_action_idx on public.audit_logs (action);
alter table public.audit_logs enable row level security;

-- ---------------------------------------------------------------------------------------------
-- 3. Every email the platform sends, and connected mailboxes
-- ---------------------------------------------------------------------------------------------
create table if not exists public.email_log (
  id uuid primary key default gen_random_uuid(),
  to_addresses text[] not null,
  subject text not null,
  category text,
  status text not null default 'sent',
  error text,
  html text,
  created_at timestamptz not null default now()
);
create index if not exists email_log_created_idx on public.email_log (created_at desc);
alter table public.email_log enable row level security;

create table if not exists public.mail_accounts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  label text not null,
  email text not null,
  imap_host text not null,
  imap_port int not null default 993,
  imap_secure boolean not null default true,
  smtp_host text not null,
  smtp_port int not null default 465,
  smtp_secure boolean not null default true,
  username text not null,
  password_enc text not null,
  created_at timestamptz not null default now(),
  unique (owner_id, email)
);
alter table public.mail_accounts enable row level security;

-- ---------------------------------------------------------------------------------------------
-- 4. Mjengo suite: grants, opportunities, projects and their documents (admins only)
-- ---------------------------------------------------------------------------------------------
create or replace function public.mjengo_touch() returns trigger
language plpgsql as $$ begin new.updated_at := now(); return new; end $$;

create table if not exists public.mjengo_grants (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  funder text,
  status text not null default 'idea' check (status in ('idea','researching','drafting','submitted','under_review','awarded','declined','reporting','closed')),
  amount numeric,
  currency text not null default 'USD',
  deadline date,
  decision_date date,
  owner_id uuid references public.profiles(id) on delete set null,
  link text,
  description text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mjengo_opportunities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  organisation text,
  kind text not null default 'grant' check (kind in ('grant','partnership','tender','fellowship','event','other')),
  status text not null default 'new' check (status in ('new','evaluating','pursuing','applied','won','lost','passed')),
  value numeric,
  currency text not null default 'USD',
  deadline date,
  owner_id uuid references public.profiles(id) on delete set null,
  source_url text,
  description text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mjengo_projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  status text not null default 'planning' check (status in ('planning','active','on_hold','completed','cancelled')),
  start_date date,
  end_date date,
  budget numeric,
  spent numeric,
  currency text not null default 'USD',
  progress int not null default 0 check (progress between 0 and 100),
  lead_id uuid references public.profiles(id) on delete set null,
  grant_id uuid references public.mjengo_grants(id) on delete set null,
  description text,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- A row is a document requirement; it is "outstanding" until a file is attached.
create table if not exists public.mjengo_documents (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('grant','opportunity','project')),
  entity_id uuid not null,
  name text not null,
  required boolean not null default true,
  due_date date,
  file_path text,
  file_name text,
  file_size bigint,
  mime_type text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  uploaded_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists mjengo_documents_entity_idx on public.mjengo_documents (entity_type, entity_id);

drop trigger if exists trg_mjengo_grants_touch on public.mjengo_grants;
create trigger trg_mjengo_grants_touch before update on public.mjengo_grants for each row execute function public.mjengo_touch();
drop trigger if exists trg_mjengo_opps_touch on public.mjengo_opportunities;
create trigger trg_mjengo_opps_touch before update on public.mjengo_opportunities for each row execute function public.mjengo_touch();
drop trigger if exists trg_mjengo_projects_touch on public.mjengo_projects;
create trigger trg_mjengo_projects_touch before update on public.mjengo_projects for each row execute function public.mjengo_touch();

alter table public.mjengo_grants enable row level security;
alter table public.mjengo_opportunities enable row level security;
alter table public.mjengo_projects enable row level security;
alter table public.mjengo_documents enable row level security;

create policy "mjengo_grants_admin" on public.mjengo_grants for all to authenticated
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));
create policy "mjengo_opportunities_admin" on public.mjengo_opportunities for all to authenticated
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));
create policy "mjengo_projects_admin" on public.mjengo_projects for all to authenticated
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));
create policy "mjengo_documents_admin" on public.mjengo_documents for all to authenticated
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));

-- Private bucket for the documents themselves.
insert into storage.buckets (id, name, public) values ('mjengo-docs', 'mjengo-docs', false) on conflict (id) do nothing;
create policy "mjengo docs admin select" on storage.objects for select to authenticated
  using (bucket_id = 'mjengo-docs' and public.is_admin((select auth.uid())));
create policy "mjengo docs admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'mjengo-docs' and public.is_admin((select auth.uid())));
create policy "mjengo docs admin update" on storage.objects for update to authenticated
  using (bucket_id = 'mjengo-docs' and public.is_admin((select auth.uid())));
create policy "mjengo docs admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'mjengo-docs' and public.is_admin((select auth.uid())));
