-- Permissions given to one person on top of their roles (clicked on in People & access). Roles stay the shared
-- starting point; this holds only what a role does not already cover. Written by super admins only.
create table if not exists public.mjengo_user_permissions (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  permissions text[] not null default '{}',
  updated_by uuid references public.profiles(id) on delete set null,
  updated_at timestamptz not null default now()
);
alter table public.mjengo_user_permissions enable row level security;
