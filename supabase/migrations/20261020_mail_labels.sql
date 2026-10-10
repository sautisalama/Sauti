-- Labels for the Mjengo mail client. They live in our database, not in the mailbox, so they work the
-- same for Gmail, Outlook, IMAP and POP3. A message is identified by its Message-ID header.
create table if not exists public.mail_labels (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  color text not null default 'purple',
  instruction text, -- natural-language rule used by auto-label
  created_at timestamptz not null default now()
);
create index if not exists mail_labels_owner_idx on public.mail_labels (owner_id);

create table if not exists public.mail_message_labels (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  account_id uuid not null references public.mail_accounts(id) on delete cascade,
  message_id text not null,
  label_id uuid not null references public.mail_labels(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (account_id, message_id, label_id)
);
create index if not exists mail_message_labels_label_idx on public.mail_message_labels (label_id);

alter table public.mail_labels enable row level security;
alter table public.mail_message_labels enable row level security;
create policy "mail_labels_owner" on public.mail_labels for all to authenticated
  using (owner_id = (select auth.uid()) and public.is_admin((select auth.uid())))
  with check (owner_id = (select auth.uid()) and public.is_admin((select auth.uid())));
create policy "mail_message_labels_owner" on public.mail_message_labels for all to authenticated
  using (owner_id = (select auth.uid()) and public.is_admin((select auth.uid())))
  with check (owner_id = (select auth.uid()) and public.is_admin((select auth.uid())));
