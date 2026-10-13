-- 1. Several reminders per item, like Google Calendar. Events keep their offsets (minutes before the start) on the
--    row; to-dos, grants, opportunities, projects and fellowships use one row per reminder.
alter table public.mjengo_events add column if not exists reminders int[] not null default '{}';
alter table public.mjengo_events add column if not exists reminders_sent int[] not null default '{}';

create table if not exists public.mjengo_reminders (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null check (entity_type in ('todo', 'grant', 'opportunity', 'project', 'fellowship', 'assignment')),
  entity_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  offset_minutes int not null check (offset_minutes between 0 and 525600),
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (entity_type, entity_id, user_id, offset_minutes)
);
create index if not exists mjengo_reminders_due_idx on public.mjengo_reminders (sent_at) where sent_at is null;
alter table public.mjengo_reminders enable row level security;

-- 2. Fellowships and their assignments (the things that are due).
create table if not exists public.mjengo_fellowships (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  host text,
  status text not null default 'applying' check (status in ('applying', 'accepted', 'active', 'completed', 'declined', 'withdrawn')),
  stipend numeric,
  currency text not null default 'USD',
  start_date date,
  deadline date,
  owner_id uuid references public.profiles(id) on delete set null,
  link text,
  description text,
  notes text,
  visibility text not null default 'team' check (visibility in ('team', 'restricted')),
  hidden_fields text[] not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.mjengo_fellowships enable row level security;
drop trigger if exists trg_mjengo_fellowships_touch on public.mjengo_fellowships;
create trigger trg_mjengo_fellowships_touch before update on public.mjengo_fellowships for each row execute function public.mjengo_touch();

create table if not exists public.mjengo_fellowship_assignments (
  id uuid primary key default gen_random_uuid(),
  fellowship_id uuid not null references public.mjengo_fellowships(id) on delete cascade,
  title text not null,
  due_date date,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'submitted', 'accepted', 'revise')),
  notes text,
  submitted_at timestamptz,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists mjengo_fellowship_assignments_idx on public.mjengo_fellowship_assignments (fellowship_id, due_date);
alter table public.mjengo_fellowship_assignments enable row level security;

alter table public.mjengo_documents drop constraint if exists mjengo_documents_entity_type_check;
alter table public.mjengo_documents add constraint mjengo_documents_entity_type_check check (entity_type in ('grant', 'opportunity', 'project', 'fellowship'));
alter table public.mjengo_todos drop constraint if exists mjengo_todos_entity_type_check;
alter table public.mjengo_todos add constraint mjengo_todos_entity_type_check check (entity_type in ('grant', 'opportunity', 'project', 'fellowship'));

-- 3. Control by whoever added a grant (or opportunity, project): who can see it, and which details stay hidden.
alter table public.mjengo_grants add column if not exists visibility text not null default 'team' check (visibility in ('team', 'restricted'));
alter table public.mjengo_grants add column if not exists hidden_fields text[] not null default '{}';
alter table public.mjengo_opportunities add column if not exists visibility text not null default 'team' check (visibility in ('team', 'restricted'));
alter table public.mjengo_opportunities add column if not exists hidden_fields text[] not null default '{}';
alter table public.mjengo_projects add column if not exists visibility text not null default 'team' check (visibility in ('team', 'restricted'));
alter table public.mjengo_projects add column if not exists hidden_fields text[] not null default '{}';

create table if not exists public.mjengo_entity_access (
  entity_type text not null check (entity_type in ('grant', 'opportunity', 'project', 'fellowship')),
  entity_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  level text not null default 'view' check (level in ('view', 'edit')),
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (entity_type, entity_id, user_id)
);
create index if not exists mjengo_entity_access_user_idx on public.mjengo_entity_access (user_id);
alter table public.mjengo_entity_access enable row level security;

-- 4. Roles and permissions, assigned by super admins. Administrators with no role keep full access.
create table if not exists public.mjengo_roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  description text,
  permissions text[] not null default '{}',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create table if not exists public.mjengo_role_members (
  role_id uuid not null references public.mjengo_roles(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  assigned_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (role_id, user_id)
);
create index if not exists mjengo_role_members_user_idx on public.mjengo_role_members (user_id);
alter table public.mjengo_roles enable row level security;
alter table public.mjengo_role_members enable row level security;
