-- Documents: labels, the meeting a document belongs to, and "anyone with the link" access (for people who
-- are not administrators).
alter table public.vault_files add column if not exists tags text[] not null default '{}';
alter table public.vault_files add column if not exists meeting_code text;
alter table public.vault_files add column if not exists link_access text not null default 'off' check (link_access in ('off', 'view', 'edit'));
create index if not exists vault_files_meeting_idx on public.vault_files (meeting_code) where meeting_code is not null;
create index if not exists vault_files_tags_idx on public.vault_files using gin (tags);
