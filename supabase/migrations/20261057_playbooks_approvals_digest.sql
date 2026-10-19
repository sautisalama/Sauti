-- 1. Playbooks: when a grant, opportunity, project or fellowship reaches a status, a set of steps is made for it
--    (to-dos with owners and due dates, a folder in the vault). Each playbook runs once per record.
-- 2. Approvals: a file can be sent to named people to approve or ask for changes, with their comments.
-- 3. The catch-up digest: when a person last looked, so "since you were away" has a start.

create table if not exists public.mjengo_playbooks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  entity_type text not null check (entity_type in ('grant', 'opportunity', 'project', 'fellowship')),
  trigger_status text not null,
  -- [{kind:'todo', title, offsetDays, notes?} | {kind:'folder', name?}]
  steps jsonb not null default '[]'::jsonb,
  active boolean not null default true,
  built_in boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists mjengo_playbooks_trigger_idx on public.mjengo_playbooks (entity_type, trigger_status) where active;
alter table public.mjengo_playbooks enable row level security;

create table if not exists public.mjengo_playbook_runs (
  playbook_id uuid not null references public.mjengo_playbooks(id) on delete cascade,
  entity_type text not null,
  entity_id uuid not null,
  made integer not null default 0,
  ran_at timestamptz not null default now(),
  primary key (playbook_id, entity_type, entity_id)
);
alter table public.mjengo_playbook_runs enable row level security;

create table if not exists public.mjengo_approvals (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.vault_files(id) on delete cascade,
  requested_by uuid not null references public.profiles(id) on delete cascade,
  note text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'changes_requested', 'withdrawn')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists mjengo_approvals_file_idx on public.mjengo_approvals (file_id, created_at desc);
alter table public.mjengo_approvals enable row level security;

create table if not exists public.mjengo_approval_reviewers (
  approval_id uuid not null references public.mjengo_approvals(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  decision text not null default 'pending' check (decision in ('pending', 'approved', 'changes_requested')),
  comment text,
  decided_at timestamptz,
  primary key (approval_id, user_id)
);
create index if not exists mjengo_approval_reviewers_user_idx on public.mjengo_approval_reviewers (user_id, decision);
alter table public.mjengo_approval_reviewers enable row level security;

create table if not exists public.mjengo_digest_seen (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  seen_at timestamptz not null default now()
);
alter table public.mjengo_digest_seen enable row level security;
