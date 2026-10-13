-- Forms get the same kind of access control as files: a form can be limited to the people added to it, and each
-- person is either an editor or can only view the form and its responses.
alter table public.mjengo_forms add column if not exists restricted boolean not null default false;
alter table public.mjengo_form_editors add column if not exists level text not null default 'edit' check (level in ('edit', 'view'));
