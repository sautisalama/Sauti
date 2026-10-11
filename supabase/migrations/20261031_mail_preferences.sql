-- Per-person mail settings, in the spirit of Gmail's General settings.
create table if not exists public.mail_preferences (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  undo_seconds int not null default 5 check (undo_seconds in (0, 5, 10, 20, 30)),
  reply_default text not null default 'reply' check (reply_default in ('reply', 'reply_all')),
  conversation_view boolean not null default true,
  density text not null default 'comfortable' check (density in ('comfortable', 'compact')),
  blocked text[] not null default '{}',
  updated_at timestamptz not null default now()
);
alter table public.mail_preferences enable row level security;
