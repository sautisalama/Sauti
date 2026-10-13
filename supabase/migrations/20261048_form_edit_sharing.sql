-- Forms can be shared for editing (separate from sharing the form for filling): an edit link, and a record of who was added.
alter table public.mjengo_forms add column if not exists edit_token text;

create table if not exists public.mjengo_form_editors (
  form_id uuid not null references public.mjengo_forms(id) on delete cascade,
  email text not null,
  added_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (form_id, email)
);
alter table public.mjengo_form_editors enable row level security;
-- All access goes through the server (service role); no policies means no direct client access.
