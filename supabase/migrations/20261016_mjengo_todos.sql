-- Shared to-do tracks for the Mjengo suite. Any admin can start a track; every admin can see all
-- tracks; tasks can be assigned to several people so responsibilities are shared.
create table if not exists public.mjengo_todo_tracks (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  color text not null default 'purple',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.mjengo_todos (
  id uuid primary key default gen_random_uuid(),
  track_id uuid not null references public.mjengo_todo_tracks(id) on delete cascade,
  title text not null,
  notes text,
  status text not null default 'todo' check (status in ('todo','doing','done')),
  due_date date,
  assignee_ids uuid[] not null default '{}',
  entity_type text check (entity_type in ('grant','opportunity','project')),
  entity_id uuid,
  created_by uuid references public.profiles(id) on delete set null,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists mjengo_todos_track_idx on public.mjengo_todos (track_id);
create index if not exists mjengo_todos_entity_idx on public.mjengo_todos (entity_type, entity_id);

drop trigger if exists trg_mjengo_todos_touch on public.mjengo_todos;
create trigger trg_mjengo_todos_touch before update on public.mjengo_todos for each row execute function public.mjengo_touch();

alter table public.mjengo_todo_tracks enable row level security;
alter table public.mjengo_todos enable row level security;
create policy "mjengo_todo_tracks_admin" on public.mjengo_todo_tracks for all to authenticated
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));
create policy "mjengo_todos_admin" on public.mjengo_todos for all to authenticated
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));
