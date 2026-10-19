-- An opportunity's link is the organisation's own page, not the post it was shared from. The link as it was shared
-- (an Instagram post, a short link, an aggregator's page) is kept beside it. When an opportunity is won it becomes a
-- grant, project or fellowship; which one and where it went is kept so it is only made once.
alter table public.mjengo_opportunities add column if not exists shared_url text;
alter table public.mjengo_opportunities add column if not exists converted_to_type text check (converted_to_type in ('grant', 'project', 'fellowship'));
alter table public.mjengo_opportunities add column if not exists converted_to_id uuid;
