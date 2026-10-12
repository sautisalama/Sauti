-- Emails can be tagged with a project: a project is a label that is linked to the project, so it filters like one.
alter table public.mail_labels add column if not exists project_id uuid references public.mjengo_projects(id) on delete cascade;
create unique index if not exists mail_labels_owner_project_idx on public.mail_labels (owner_id, project_id) where project_id is not null;
