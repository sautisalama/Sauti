-- Any participant of a chat may react to any message in it. Messages are update-able only by their
-- sender (RLS), so reactions go through this function: it checks membership, then toggles the
-- caller's emoji atomically (row lock) so two people reacting at once don't overwrite each other.
create or replace function public.toggle_message_reaction(p_message_id uuid, p_emoji text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_chat uuid;
  v_reactions jsonb;
begin
  if v_uid is null then raise exception 'Unauthorized'; end if;
  if p_emoji is null or char_length(p_emoji) = 0 or char_length(p_emoji) > 16 then
    raise exception 'Invalid reaction';
  end if;

  select chat_id, coalesce(reactions, '{}'::jsonb) into v_chat, v_reactions
  from public.messages where id = p_message_id for update;
  if v_chat is null then raise exception 'Message not found'; end if;
  if not public.check_user_is_chat_participant(v_chat) then raise exception 'Forbidden'; end if;

  if v_reactions ->> v_uid::text = p_emoji then
    v_reactions := v_reactions - v_uid::text;
  else
    v_reactions := jsonb_set(v_reactions, array[v_uid::text], to_jsonb(p_emoji), true);
  end if;

  update public.messages set reactions = v_reactions where id = p_message_id;
  return v_reactions;
end;
$$;

revoke all on function public.toggle_message_reaction(uuid, text) from public, anon;
grant execute on function public.toggle_message_reaction(uuid, text) to authenticated;
