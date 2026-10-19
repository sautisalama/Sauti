-- Pending items (a payment waiting, in the mail) the person has dismissed, so they do not come back.
create table if not exists public.mail_dismissed (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  item_key text not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, item_key)
);
alter table public.mail_dismissed enable row level security;
