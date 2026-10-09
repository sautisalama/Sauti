-- Chat features: Sauti ID (shareable contact code), message deletion, delivery/read receipts,
-- media-aware previews, and persistent Salama assistant history.

-- ---------------------------------------------------------------------------------------------
-- 1. Sauti ID
-- ---------------------------------------------------------------------------------------------
alter table public.profiles add column if not exists sauti_id text;

create or replace function public.gen_sauti_id() returns text
language plpgsql volatile as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no 0/O/1/I
  code text;
  i int;
begin
  loop
    code := 'SS-';
    for i in 1..8 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
      if i = 4 then code := code || '-'; end if;
    end loop;
    exit when not exists (select 1 from public.profiles where sauti_id = code);
  end loop;
  return code;
end $$;

update public.profiles set sauti_id = public.gen_sauti_id() where sauti_id is null;
create unique index if not exists profiles_sauti_id_key on public.profiles (sauti_id);

create or replace function public.profiles_assign_sauti_id() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.sauti_id is null then new.sauti_id := public.gen_sauti_id(); end if;
  elsif new.sauti_id is distinct from old.sauti_id and coalesce(current_setting('app.sauti_rpc', true), '') <> '1' then
    new.sauti_id := old.sauti_id; -- only regenerate_sauti_id() may change it
  end if;
  return new;
end $$;

drop trigger if exists trg_profiles_sauti_id on public.profiles;
create trigger trg_profiles_sauti_id before insert or update on public.profiles
  for each row execute function public.profiles_assign_sauti_id();

-- Rotate your ID (revokes it for anyone who only had the old one).
create or replace function public.regenerate_sauti_id() returns text
language plpgsql security definer set search_path = public as $$
declare v text;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  perform set_config('app.sauti_rpc', '1', true);
  v := public.gen_sauti_id();
  update public.profiles set sauti_id = v where id = auth.uid();
  return v;
end $$;

-- Look someone up by the ID they shared. Returns only what is needed to start a chat.
create or replace function public.find_user_by_sauti_id(p_code text)
returns table (id uuid, first_name text, last_name text, avatar_url text, user_type text, is_verified boolean)
language plpgsql stable security definer set search_path = public as $$
declare c text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  c := regexp_replace(regexp_replace(c, '^SS-?', ''), '-', '', 'g');
  if c !~ '^[A-Z0-9]{8}$' then return; end if;
  c := 'SS-' || substr(c, 1, 4) || '-' || substr(c, 5, 4);
  return query
    select p.id, p.first_name, p.last_name, p.avatar_url, p.user_type::text, coalesce(p."isVerified", false)
    from public.profiles p
    where p.sauti_id = c
      and p.id <> auth.uid()
      and coalesce(p.is_banned, false) = false
      and coalesce(p.email, '') not like '%@anon.sautisalama.org';
end $$;

revoke all on function public.regenerate_sauti_id() from public, anon;
revoke all on function public.find_user_by_sauti_id(text) from public, anon;
grant execute on function public.regenerate_sauti_id() to authenticated;
grant execute on function public.find_user_by_sauti_id(text) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. Receipts and deletion
-- ---------------------------------------------------------------------------------------------
-- Delivered: the message reached a recipient's device (double grey tick).
create or replace function public.mark_messages_delivered(p_chat uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or not public.check_user_is_chat_participant(p_chat, auth.uid()) then return; end if;
  update public.messages set delivered_at = now()
  where chat_id = p_chat and sender_id is distinct from auth.uid() and delivered_at is null;
end $$;

-- Read: the recipient opened the chat (blue ticks). Idempotent per reader.
create or replace function public.mark_messages_read(p_chat uuid) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null or not public.check_user_is_chat_participant(p_chat, uid) then return; end if;
  update public.messages
  set read_by = coalesce(read_by, '[]'::jsonb) || jsonb_build_array(jsonb_build_object('user_id', uid, 'read_at', now())),
      delivered_at = coalesce(delivered_at, now())
  where chat_id = p_chat
    and sender_id is distinct from uid
    and not coalesce(read_by, '[]'::jsonb) @> jsonb_build_array(jsonb_build_object('user_id', uid));
end $$;

-- Delete for everyone. Senders can delete their own; community admins/moderators can remove others'.
create or replace function public.delete_message(p_message_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m record; allowed boolean := false; cid uuid;
begin
  if auth.uid() is null then raise exception 'Unauthorized'; end if;
  select id, chat_id, sender_id, created_at into m from public.messages where id = p_message_id;
  if m.id is null then raise exception 'Message not found'; end if;
  if not public.check_user_is_chat_participant(m.chat_id, auth.uid()) then raise exception 'Forbidden'; end if;

  if m.sender_id = auth.uid() then
    allowed := true;
  else
    select id into cid from public.communities where chat_id = m.chat_id;
    if cid is not null and public.is_community_manager(cid, auth.uid()) then allowed := true; end if;
  end if;
  if not allowed then raise exception 'Forbidden'; end if;

  update public.messages
  set is_deleted = true, deleted_at = now(), content = '', attachments = null, reactions = '{}'::jsonb,
      metadata = jsonb_build_object('deleted_by', auth.uid())
  where id = p_message_id;

  update public.chats
  set metadata = jsonb_set(coalesce(metadata, '{}'::jsonb), '{last_message_preview}',
        coalesce(metadata -> 'last_message_preview', '{}'::jsonb) || jsonb_build_object('content', 'This message was deleted', 'type', 'text'))
  where id = m.chat_id
    and (metadata -> 'last_message_preview' ->> 'created_at')::timestamptz = m.created_at;
end $$;

revoke all on function public.mark_messages_delivered(uuid) from public, anon;
revoke all on function public.mark_messages_read(uuid) from public, anon;
revoke all on function public.delete_message(uuid) from public, anon;
grant execute on function public.mark_messages_delivered(uuid) to authenticated;
grant execute on function public.mark_messages_read(uuid) to authenticated;
grant execute on function public.delete_message(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Chat-list previews that describe media instead of showing nothing
-- ---------------------------------------------------------------------------------------------
create or replace function public.handle_new_message() returns trigger
language plpgsql security definer set search_path = public as $$
declare label text;
begin
  label := case NEW.type::text
    when 'image' then '📷 Photo'
    when 'video' then '🎥 Video'
    when 'audio' then '🎤 Voice message'
    when 'location' then '📍 Location'
    when 'file' then '📄 ' || coalesce(NEW.attachments[1] ->> 'name', 'Document')
    else null end;

  update public.chats
  set last_message_at = NEW.created_at,
      metadata = jsonb_set(
        coalesce(metadata, '{}'::jsonb),
        '{last_message_preview}',
        jsonb_build_object(
          'content', left(case when label is null then NEW.content
                               when coalesce(NEW.content, '') = '' then label
                               else label || ' ' || NEW.content end, 60),
          'sender_id', NEW.sender_id,
          'type', NEW.type,
          'created_at', NEW.created_at
        )
      )
  where id = NEW.chat_id;
  return NEW;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 4. Salama assistant history (private to each user)
-- ---------------------------------------------------------------------------------------------
create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists assistant_messages_user_idx on public.assistant_messages (user_id, created_at);
alter table public.assistant_messages enable row level security;
create policy "assistant_messages_select_own" on public.assistant_messages for select to authenticated using (user_id = (select auth.uid()));
create policy "assistant_messages_insert_own" on public.assistant_messages for insert to authenticated with check (user_id = (select auth.uid()));
create policy "assistant_messages_delete_own" on public.assistant_messages for delete to authenticated using (user_id = (select auth.uid()));
