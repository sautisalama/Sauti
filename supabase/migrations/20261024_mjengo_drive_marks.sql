-- Remember which files were copied to Google Drive, so cards can show it.
alter table public.vault_files add column if not exists drive_file_id text;
alter table public.vault_files add column if not exists drive_link text;
alter table public.vault_files add column if not exists drive_saved_at timestamptz;
alter table public.mjengo_documents add column if not exists drive_file_id text;
alter table public.mjengo_documents add column if not exists drive_link text;
alter table public.mjengo_documents add column if not exists drive_saved_at timestamptz;
