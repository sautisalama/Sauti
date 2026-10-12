-- A recorded call: the file in Files, when it was recorded and by whom.
alter table public.mjengo_meetings add column if not exists recording_file_id uuid references public.vault_files(id) on delete set null;
alter table public.mjengo_meetings add column if not exists recorded_at timestamptz;
alter table public.mjengo_meetings add column if not exists recorded_by uuid references public.profiles(id) on delete set null;
