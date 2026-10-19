-- Tags on every module, and the search index behind the Overview search and "similar to this".
--
-- 1. Tags (text[]) on grants, opportunities, projects, fellowships, to-dos, calls and events, like files and
--    contacts already have. The autotagger fills them in; people change them.
-- 2. A search index of what the team has written: documents, calls, to-dos, events, grants, opportunities,
--    projects and fellowships, cut into passages. Each passage has a meaning vector (so a question finds what it
--    is about) and trigram matching on its text (so any fragment of a sentence finds the passage that holds it).

alter table public.mjengo_grants add column if not exists tags text[] not null default '{}';
alter table public.mjengo_opportunities add column if not exists tags text[] not null default '{}';
alter table public.mjengo_projects add column if not exists tags text[] not null default '{}';
alter table public.mjengo_fellowships add column if not exists tags text[] not null default '{}';
alter table public.mjengo_todos add column if not exists tags text[] not null default '{}';
alter table public.mjengo_meetings add column if not exists tags text[] not null default '{}';
alter table public.mjengo_events add column if not exists tags text[] not null default '{}';
create index if not exists mjengo_grants_tags_idx on public.mjengo_grants using gin (tags);
create index if not exists mjengo_opportunities_tags_idx on public.mjengo_opportunities using gin (tags);
create index if not exists mjengo_projects_tags_idx on public.mjengo_projects using gin (tags);
create index if not exists mjengo_fellowships_tags_idx on public.mjengo_fellowships using gin (tags);
create index if not exists mjengo_todos_tags_idx on public.mjengo_todos using gin (tags);
create index if not exists mjengo_meetings_tags_idx on public.mjengo_meetings using gin (tags);
create index if not exists mjengo_events_tags_idx on public.mjengo_events using gin (tags);

create extension if not exists vector with schema extensions;
create extension if not exists pg_trgm with schema extensions;

-- What has been indexed and when, so only what changed is read again.
create table if not exists public.mjengo_search_sources (
  source_type text not null check (source_type in ('file', 'meeting', 'todo', 'event', 'grant', 'opportunity', 'project', 'fellowship')),
  source_id text not null,
  title text not null,
  hash text not null,
  indexed_at timestamptz not null default now(),
  primary key (source_type, source_id)
);

create table if not exists public.mjengo_search_chunks (
  id uuid primary key default gen_random_uuid(),
  source_type text not null,
  source_id text not null,
  chunk_index int not null,
  title text not null,
  content text not null,
  link text,
  embedding extensions.vector(1024),
  unique (source_type, source_id, chunk_index)
);
create index if not exists mjengo_search_chunks_source_idx on public.mjengo_search_chunks (source_type, source_id);
create index if not exists mjengo_search_chunks_vec_idx on public.mjengo_search_chunks using hnsw (embedding extensions.vector_cosine_ops);
create index if not exists mjengo_search_chunks_trgm_idx on public.mjengo_search_chunks using gin (content extensions.gin_trgm_ops);
alter table public.mjengo_search_sources enable row level security;
alter table public.mjengo_search_chunks enable row level security;

-- Passages near a question (by meaning) and passages that contain a fragment (by text). Only the server calls this.
create or replace function public.mjengo_search(q extensions.vector(1024), frag text, n int default 60)
returns table (id uuid, source_type text, source_id text, chunk_index int, title text, content text, link text, sim double precision, lex boolean)
language sql stable set search_path = public, extensions as $$
  (select c.id, c.source_type, c.source_id, c.chunk_index, c.title, c.content, c.link, 1 - (c.embedding <=> q) as sim, false as lex
     from public.mjengo_search_chunks c where q is not null and c.embedding is not null order by c.embedding <=> q limit n)
  union all
  (select c.id, c.source_type, c.source_id, c.chunk_index, c.title, c.content, c.link, 0::double precision as sim, true as lex
     from public.mjengo_search_chunks c
     where length(coalesce(frag, '')) >= 3 and c.content ilike '%' || replace(replace(replace(frag, '\', '\\'), '%', '\%'), '_', '\_') || '%' limit n)
$$;

-- Passages of other things that read like this one (the average of its passages is the point looked around).
create or replace function public.mjengo_similar(st text, sid text, n int default 60)
returns table (source_type text, source_id text, title text, link text, content text, sim double precision)
language sql stable set search_path = public, extensions as $$
  with centre as (select avg(embedding) as v from public.mjengo_search_chunks where source_type = st and source_id = sid and embedding is not null)
  select c.source_type, c.source_id, c.title, c.link, c.content, 1 - (c.embedding <=> (select v from centre)) as sim
    from public.mjengo_search_chunks c
    where (select v from centre) is not null and c.embedding is not null and not (c.source_type = st and c.source_id = sid)
    order by c.embedding <=> (select v from centre) limit n
$$;

revoke all on function public.mjengo_search(extensions.vector, text, int) from public, anon, authenticated;
revoke all on function public.mjengo_similar(text, text, int) from public, anon, authenticated;
grant execute on function public.mjengo_search(extensions.vector, text, int) to service_role;
grant execute on function public.mjengo_similar(text, text, int) to service_role;
