-- Unread messages per chat for the signed-in user: messages from other people newer than the
-- participant's last_read_at (or all of them if the chat was never opened). SECURITY INVOKER, so
-- RLS limits it to chats the caller belongs to.
create or replace function public.unread_chat_counts()
returns table (chat_id uuid, unread bigint)
language sql
stable
security invoker
set search_path = public
as $$
  select cp.chat_id, count(m.id) as unread
  from public.chat_participants cp
  join public.messages m
    on m.chat_id = cp.chat_id
   and m.sender_id is distinct from cp.user_id
   and m.type <> 'system'
   and (cp.status ->> 'last_read_at' is null or m.created_at > (cp.status ->> 'last_read_at')::timestamptz)
  where cp.user_id = (select auth.uid())
  group by cp.chat_id
$$;

revoke all on function public.unread_chat_counts() from public, anon;
grant execute on function public.unread_chat_counts() to authenticated;
