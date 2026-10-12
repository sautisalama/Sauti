-- Who and what to tag on each network: handles to mention and hashtags, with a switch for "always add".
create table if not exists public.mjengo_social_tags (
  id uuid primary key default gen_random_uuid(),
  channel text not null check (channel in ('linkedin', 'x', 'facebook', 'instagram', 'tiktok', 'website')),
  kind text not null check (kind in ('mention', 'hashtag')),
  value text not null,
  label text,
  auto boolean not null default false,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  unique (channel, kind, value)
);
alter table public.mjengo_social_tags enable row level security;
