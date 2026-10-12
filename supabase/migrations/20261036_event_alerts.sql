-- How many alerts an event sends, and how far apart (minutes). The last alert lands one step before the start.
alter table public.mjengo_events add column if not exists alerts int not null default 1 check (alerts between 0 and 10);
alter table public.mjengo_events add column if not exists alert_every_min int not null default 15 check (alert_every_min between 1 and 1440);
alter table public.mjengo_events add column if not exists alerts_sent int not null default 0;
