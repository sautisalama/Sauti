-- Instagram posts looked up for link previews, kept briefly so the same link is never paid for twice. Only what a
-- preview needs is stored (caption, author's handle, a picture address, the time and kind of post): no comments, no
-- profiles, no counts. Rows older than 30 days are ignored and may be deleted.
create table if not exists public.mjengo_social_cache (
  url_hash text primary key,
  url text not null,
  provider text not null,
  data jsonb not null,
  fetched_at timestamptz not null default now()
);
create index if not exists mjengo_social_cache_fetched_idx on public.mjengo_social_cache (fetched_at desc);
alter table public.mjengo_social_cache enable row level security;
