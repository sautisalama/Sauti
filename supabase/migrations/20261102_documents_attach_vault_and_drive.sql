-- A document on a grant, opportunity, project or fellowship can now point at a file in the Files vault
-- (or at a Google Drive file, using drive_file_id and drive_link, which already exist) instead of holding its own upload.
-- Removing the document only removes this link; the vault file is never touched.
alter table public.mjengo_documents add column if not exists vault_file_id uuid references public.vault_files(id) on delete set null;
create index if not exists mjengo_documents_vault_file_idx on public.mjengo_documents (vault_file_id) where vault_file_id is not null;
