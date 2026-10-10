-- Mjengo document vault: folders and files with Drive-style sharing.
-- Access is resolved on the server (owner, explicit grant, inherited from a parent folder, general
-- access). The tables have RLS on and no client policies, so only the service role can touch them.
create table if not exists public.vault_folders (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.vault_folders(id) on delete cascade,
  name text not null,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  general_access text not null default 'restricted' check (general_access in ('restricted', 'admins_view', 'admins_share')),
  created_at timestamptz not null default now()
);
create index if not exists vault_folders_parent_idx on public.vault_folders (parent_id);
create index if not exists vault_folders_owner_idx on public.vault_folders (owner_id);

create table if not exists public.vault_files (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid references public.vault_folders(id) on delete cascade,
  name text not null,
  storage_path text not null unique,
  mime text,
  size bigint not null default 0,
  owner_id uuid not null references public.profiles(id) on delete cascade,
  general_access text not null default 'restricted' check (general_access in ('restricted', 'admins_view', 'admins_share')),
  created_at timestamptz not null default now()
);
create index if not exists vault_files_folder_idx on public.vault_files (folder_id);
create index if not exists vault_files_owner_idx on public.vault_files (owner_id);

create table if not exists public.vault_permissions (
  id uuid primary key default gen_random_uuid(),
  resource_type text not null check (resource_type in ('folder', 'file')),
  resource_id uuid not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  level text not null check (level in ('view', 'share', 'edit')),
  granted_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (resource_type, resource_id, user_id)
);
create index if not exists vault_permissions_user_idx on public.vault_permissions (user_id);

alter table public.vault_folders enable row level security;
alter table public.vault_files enable row level security;
alter table public.vault_permissions enable row level security;

-- The admin storage policies covered every path in mjengo-docs. Vault files are only reachable
-- through server-signed URLs, so keep the vault/ prefix out of those direct-access policies.
drop policy if exists "mjengo docs admin select" on storage.objects;
drop policy if exists "mjengo docs admin insert" on storage.objects;
drop policy if exists "mjengo docs admin update" on storage.objects;
drop policy if exists "mjengo docs admin delete" on storage.objects;
create policy "mjengo docs admin select" on storage.objects for select to authenticated
  using (bucket_id = 'mjengo-docs' and name not like 'vault/%' and public.is_admin((select auth.uid())));
create policy "mjengo docs admin insert" on storage.objects for insert to authenticated
  with check (bucket_id = 'mjengo-docs' and name not like 'vault/%' and public.is_admin((select auth.uid())));
create policy "mjengo docs admin update" on storage.objects for update to authenticated
  using (bucket_id = 'mjengo-docs' and name not like 'vault/%' and public.is_admin((select auth.uid())));
create policy "mjengo docs admin delete" on storage.objects for delete to authenticated
  using (bucket_id = 'mjengo-docs' and name not like 'vault/%' and public.is_admin((select auth.uid())));
