-- An AI chat can belong to an opportunity or grant, and can be linked into its application context.
alter table public.mjengo_ai_threads add column if not exists entity_type text;
alter table public.mjengo_ai_threads add column if not exists entity_id uuid;
create index if not exists mjengo_ai_threads_entity_idx on public.mjengo_ai_threads (entity_type, entity_id);

alter table public.mjengo_context_items add column if not exists thread_id uuid references public.mjengo_ai_threads(id) on delete cascade;
alter table public.mjengo_context_items drop constraint if exists mjengo_context_items_kind_check;
alter table public.mjengo_context_items add constraint mjengo_context_items_kind_check check (kind in ('instruction','link','skill','note','file','drive','chat'));
