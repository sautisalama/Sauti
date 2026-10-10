-- One email signature per administrator, appended to new messages and replies in the Mjengo mail client.
create table if not exists public.mail_signatures (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  html text not null default '',
  prompt_dismissed boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table public.mail_signatures enable row level security;
create policy "mail_signatures_owner" on public.mail_signatures for all to authenticated
  using (owner_id = (select auth.uid()) and public.is_admin((select auth.uid())))
  with check (owner_id = (select auth.uid()) and public.is_admin((select auth.uid())));
