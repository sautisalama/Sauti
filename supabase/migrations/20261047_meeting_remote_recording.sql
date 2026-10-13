-- Recordings kept on the organisation's own storage host (cPanel). The meeting keeps the file name there.
alter table public.mjengo_meetings
  add column if not exists remote_recording text,
  add column if not exists remote_recording_size bigint;
