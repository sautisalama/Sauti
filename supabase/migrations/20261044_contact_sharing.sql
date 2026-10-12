-- Contacts can be private to the people involved and shared like files. People the team has emailed on the
-- organisation's own domain are added automatically, visible to those on the message.
alter table public.mjengo_contacts add column if not exists visibility text not null default 'team' check (visibility in ('team', 'private'));

create table if not exists public.mjengo_contact_access (
  contact_id uuid not null references public.mjengo_contacts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  level text not null default 'view' check (level in ('view', 'edit')),
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (contact_id, user_id)
);
create index if not exists mjengo_contact_access_user_idx on public.mjengo_contact_access (user_id);
alter table public.mjengo_contact_access enable row level security;
