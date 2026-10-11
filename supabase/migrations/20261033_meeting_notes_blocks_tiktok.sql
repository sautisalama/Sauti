-- TikTok as a channel, blocked time on the calendar, reminders, and shared notes after calls.
alter table public.mjengo_channel_connections drop constraint if exists mjengo_channel_connections_channel_check;
alter table public.mjengo_channel_connections add constraint mjengo_channel_connections_channel_check check (channel in ('linkedin', 'x', 'facebook', 'instagram', 'tiktok'));

alter table public.mjengo_events drop constraint if exists mjengo_events_kind_check;
alter table public.mjengo_events add constraint mjengo_events_kind_check check (kind in ('event', 'meeting', 'block'));
alter table public.mjengo_events add column if not exists reminded_at timestamptz;

alter table public.mjengo_meetings add column if not exists notes text;
alter table public.mjengo_meetings add column if not exists participants uuid[] not null default '{}';
alter table public.mjengo_meetings add column if not exists notes_shared_at timestamptz;
