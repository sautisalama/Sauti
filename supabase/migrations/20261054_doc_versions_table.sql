-- The version list of a document, one row per version, so two people saving at the same moment cannot drop each
-- other's entry (the list used to be one JSON file). The bytes stay in the mjengo-docs bucket.
create table if not exists public.mjengo_doc_versions (
  file_id uuid not null,
  id text not null,
  created_at timestamptz not null default now(),
  reason text not null default 'autosave',
  name text,
  title text,
  words integer,
  size bigint not null default 0,
  author jsonb,
  primary key (file_id, id)
);
create index if not exists mjengo_doc_versions_file_idx on public.mjengo_doc_versions (file_id, created_at desc);
alter table public.mjengo_doc_versions enable row level security;
