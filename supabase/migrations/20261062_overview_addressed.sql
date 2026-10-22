-- Items on the Overview's "Coming up" card the person has marked as addressed, so they leave the card without the record itself changing.
create table if not exists public.mjengo_addressed (
  user_id uuid not null references public.profiles(id) on delete cascade,
  item_key text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item_key)
);
alter table public.mjengo_addressed enable row level security;
