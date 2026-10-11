-- To-dos in the style of Microsoft To Do: important flag, reminder date, steps, and a note of when we last reminded.
alter table public.mjengo_todos add column if not exists important boolean not null default false;
alter table public.mjengo_todos add column if not exists remind_on date;
alter table public.mjengo_todos add column if not exists steps jsonb not null default '[]'::jsonb;
alter table public.mjengo_todos add column if not exists last_notified_on date;
