-- A document on a grant, opportunity, project or fellowship can also be a form made for it.
-- Removing the document only removes this link; the form and its responses are never touched.
alter table public.mjengo_documents add column if not exists form_id uuid references public.mjengo_forms(id) on delete set null;
create index if not exists mjengo_documents_form_idx on public.mjengo_documents (form_id) where form_id is not null;
