-- What a fund covers (sectors, themes, SDGs, who can apply, where), read from its link; and consultancies as an
-- opportunity type.
alter table public.mjengo_grants add column if not exists sectors text[] not null default '{}';
alter table public.mjengo_grants add column if not exists themes text[] not null default '{}';
alter table public.mjengo_grants add column if not exists sdgs integer[] not null default '{}';
alter table public.mjengo_grants add column if not exists regions text[] not null default '{}';
alter table public.mjengo_grants add column if not exists eligibility text;
alter table public.mjengo_opportunities add column if not exists sectors text[] not null default '{}';
alter table public.mjengo_opportunities add column if not exists themes text[] not null default '{}';
alter table public.mjengo_opportunities add column if not exists sdgs integer[] not null default '{}';
alter table public.mjengo_opportunities add column if not exists regions text[] not null default '{}';
alter table public.mjengo_opportunities add column if not exists eligibility text;
alter table public.mjengo_fellowships add column if not exists sectors text[] not null default '{}';
alter table public.mjengo_fellowships add column if not exists themes text[] not null default '{}';
alter table public.mjengo_fellowships add column if not exists sdgs integer[] not null default '{}';
alter table public.mjengo_fellowships add column if not exists regions text[] not null default '{}';
alter table public.mjengo_fellowships add column if not exists eligibility text;
alter table public.mjengo_opportunities drop constraint if exists mjengo_opportunities_kind_check;
alter table public.mjengo_opportunities add constraint mjengo_opportunities_kind_check check (kind in ('grant','partnership','tender','fellowship','consultancy','event','other'));
