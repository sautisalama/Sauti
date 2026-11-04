-- Files: a deleted file or folder goes to the trash first and is removed for good after 21 days.
-- Additive only: code that does not know about these columns keeps working.
alter table public.vault_files   add column if not exists deleted_at timestamptz;
alter table public.vault_files   add column if not exists deleted_by uuid;
alter table public.vault_files   add column if not exists deleted_root boolean not null default false;
alter table public.vault_folders add column if not exists deleted_at timestamptz;
alter table public.vault_folders add column if not exists deleted_by uuid;
alter table public.vault_folders add column if not exists deleted_root boolean not null default false;

create index if not exists vault_files_deleted_idx   on public.vault_files (deleted_at)   where deleted_at is not null;
create index if not exists vault_folders_deleted_idx on public.vault_folders (deleted_at) where deleted_at is not null;
