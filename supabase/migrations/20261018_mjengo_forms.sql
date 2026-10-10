-- Mjengo forms: a form builder (Google Forms style) with public responses.
-- Both tables are reached only through server code: admins via their session (RLS below),
-- the public via a validated server action that uses the service role. No anonymous table access.
create table if not exists public.mjengo_forms (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null default 'Untitled form',
  description text,
  status text not null default 'draft' check (status in ('draft','open','closed')),
  questions jsonb not null default '[]'::jsonb,
  settings jsonb not null default '{}'::jsonb,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mjengo_form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.mjengo_forms(id) on delete cascade,
  answers jsonb not null default '{}'::jsonb,
  respondent_email text,
  created_at timestamptz not null default now()
);
create index if not exists mjengo_form_responses_form_idx on public.mjengo_form_responses (form_id, created_at desc);

drop trigger if exists trg_mjengo_forms_touch on public.mjengo_forms;
create trigger trg_mjengo_forms_touch before update on public.mjengo_forms for each row execute function public.mjengo_touch();

alter table public.mjengo_forms enable row level security;
alter table public.mjengo_form_responses enable row level security;
create policy "mjengo_forms_admin" on public.mjengo_forms for all to authenticated
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));
create policy "mjengo_form_responses_admin" on public.mjengo_form_responses for all to authenticated
  using (public.is_admin((select auth.uid()))) with check (public.is_admin((select auth.uid())));
