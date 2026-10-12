-- What a meeting is about, who is invited, and the links and files to have at hand.
alter table public.mjengo_meetings add column if not exists description text;
alter table public.mjengo_meetings add column if not exists invitees text[] not null default '{}';
alter table public.mjengo_meetings add column if not exists resources jsonb not null default '[]'::jsonb;
