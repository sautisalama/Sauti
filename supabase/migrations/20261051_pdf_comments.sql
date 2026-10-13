-- Threaded comments on PDFs: pinned to a spot on a page, with replies and a resolved flag.
create table if not exists public.mjengo_pdf_comments (
  id uuid primary key default gen_random_uuid(),
  file_id uuid not null references public.vault_files(id) on delete cascade,
  page integer not null default 0,
  x real not null default 0,
  y real not null default 0,
  body text not null,
  parent_id uuid references public.mjengo_pdf_comments(id) on delete cascade,
  author_id uuid references public.profiles(id) on delete set null,
  resolved boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists mjengo_pdf_comments_file_idx on public.mjengo_pdf_comments (file_id, created_at);
-- Read and written only on the server, after the file's own access check.
alter table public.mjengo_pdf_comments enable row level security;
