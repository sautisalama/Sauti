-- New-mail alerts: a switch per mailbox, one for all mailboxes, and where the watcher got to.
alter table public.mail_accounts
  add column if not exists notify boolean not null default true,
  add column if not exists notify_uid bigint,
  add column if not exists notify_checked_at timestamptz;
alter table public.mail_preferences
  add column if not exists notify_all boolean not null default true,
  add column if not exists app_seen_at timestamptz;
