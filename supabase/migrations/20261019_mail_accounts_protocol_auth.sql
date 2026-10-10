-- Mailboxes can be read over IMAP or POP3, and signed in with a password or with Google / Microsoft OAuth
-- (for OAuth accounts password_enc holds the encrypted refresh token).
alter table public.mail_accounts
  add column if not exists protocol text not null default 'imap' check (protocol in ('imap','pop3')),
  add column if not exists auth_type text not null default 'password' check (auth_type in ('password','google','microsoft'));
