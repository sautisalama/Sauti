'use server';

import { createClient } from '@/utils/supabase/server';
import { after } from 'next/server';
import { createAdminClient } from '@/utils/supabase/admin-client';
import { firstUrl, loadLinkPreview } from '@/lib/chat/link-preview';
import { notifyChatMessage, clearChatNotifications } from '@/lib/chat/notify';
import { withParticipantProfiles } from '@/utils/chat/participants';
import { Chat, Message, ChatType, MessageType, transformChat, transformMessage, MessageReactions, ChatMetadata } from '@/types/chat';

export async function getChats() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // Get chats where user is participant, ordered by last_message_at
  const { data, error } = await supabase
    .from('chats')
    .select(`
      *,
      participants:chat_participants(
        *,
        user:profiles(*)
      )
    `)
    .order('last_message_at', { ascending: false });

  if (error) throw error;
  
  const chats = (await withParticipantProfiles(supabase, data || [])).map(transformChat);

  // Per-chat unread badges (messages from others since this user last opened the chat).
  const { data: counts } = await supabase.rpc('unread_chat_counts');
  const unread = new Map((counts ?? []).map((c) => [c.chat_id, Number(c.unread)]));
  return chats.map((c) => ({ ...c, unread_count: unread.get(c.id) ?? 0 }));
}

/** Total unread chat messages for the app badges. */
export async function getUnreadChatTotal(): Promise<number> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;
  const { data } = await supabase.rpc('unread_chat_counts');
  return (data ?? []).reduce((n, c) => n + Number(c.unread), 0);
}

export async function getMessages(chatId: string | string[], limit = 50, before?: string) {
  const supabase = await createClient();
  
  let query = supabase
    .from('messages')
    .select(`
      *,
      sender:profiles(id, first_name, last_name, avatar_url)
    `);

  if (Array.isArray(chatId)) {
    query = query.in('chat_id', chatId);
  } else {
    query = query.eq('chat_id', chatId);
  }

  query = query
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map(transformMessage).reverse(); // Return in chronological order for UI
}

export async function addMessageReaction(messageId: string, emoji: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // Any participant may react (messages are otherwise update-able only by their sender), so this goes
  // through a function that checks membership and toggles atomically.
  const { data, error } = await supabase.rpc('toggle_message_reaction', { p_message_id: messageId, p_emoji: emoji });
  if (error) throw error;
  return { success: true, reactions: (data ?? {}) as MessageReactions };
}

export async function markMessagesAsRead(chatId: string) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Unauthorized');

    // Logic: Find all messages in this chat NOT read by me, and append my ID to 'read_by'
    // This is complex in pure SQL Update without stored procedure if 'read_by' is JSONB array.
    // simpler approach: Call a specific RPC or just update the latest ones.
    // For MVP/Speed: We will use a dedicated "last_read" on chat_participants (already exists in previous step markChatAsRead)
    // AND we can try to update 'read_by' for specific messages if we want granular receipts.
    
    // Let's stick to updating chat_participants for "Chat Read" status as it's more efficient than updating 100 messages.
    // However, the requirement asked for "read receipts". 
    // We can implement a "RPC" call later if needed, but for now we'll stick to the existing markChatAsRead
    // which effectively clears the unread count.
    
    return markChatAsRead(chatId);
}

export async function sendMessage(chatId: string, content: string, type: MessageType = 'text', metadata = {}, attachments: any[] = []) {
  // Previews are fetched by the server below; a client-supplied one could show a fake title for a link.
  const { link_preview: _clientPreview, ...cleanMetadata } = (metadata ?? {}) as Record<string, unknown>;
  metadata = cleanMetadata;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('messages')
    .insert({
      chat_id: chatId,
      sender_id: user.id,
      content,
      type,
      metadata: metadata as any,
      attachments: attachments as any
    })
    .select()
    .single();

  if (error) throw error;

  // After the response is sent: notify the others (bell + push) and, for a text with a link, attach
  // its preview. Doing it here means the preview never depends on the sender's browser.
  after(async () => {
    try {
      await notifyChatMessage(chatId, user.id);
      const url = type === 'text' ? firstUrl(content) : null;
      if (url) {
        const preview = await loadLinkPreview(url);
        if (preview) {
          await createAdminClient()
            .from('messages')
            .update({ metadata: { ...(((data.metadata as object | null) ?? {}) as object), link_preview: preview } as any })
            .eq('id', data.id);
        }
      }
    } catch (err) {
      console.error('Post-send work failed:', err);
    }
  });

  return transformMessage(data);
}

export async function createChat(participantIds: string[], type: ChatType = 'dm', initialMessage?: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // Check if DM already exists with this person to avoid duplicates
  if (type === 'dm' && participantIds.length === 1) {
    // Complex query needed to find if chat exists with exactly these participants
    // For now, simpler approach: just create new one or rely on app logic
    // A robust solution would call a Postgres function `get_dm_chat_id(user1, user2)`
  }

  // 1. Create Chat
  const { data: chat, error: chatError } = await supabase
    .from('chats')
    .insert({
      type,
      created_by: user.id,
      metadata: {}
    })
    .select()
    .single();

  if (chatError) throw chatError;

  // 2. Add Participants
  const participants = [user.id, ...participantIds].map(uid => ({
    chat_id: chat.id,
    user_id: uid,
    status: { role: uid === user.id ? 'admin' : 'member' }
  }));

  const { error: partError } = await supabase
    .from('chat_participants')
    .insert(participants);

  if (partError) throw partError; 

  // 3. Send Initial Message if any
  if (initialMessage) {
    await sendMessage(chat.id, initialMessage);
  }

  return chat.id;
}

export async function markChatAsRead(chatId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // `status` also carries the participant's role. Merge into it — replacing it
  // wholesale used to wipe the role the first time a chat was opened.
  const { data: row, error: readError } = await supabase
    .from('chat_participants')
    .select('status')
    .eq('chat_id', chatId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (readError) throw readError;
  if (!row) return;
  clearChatNotifications(chatId, user.id).catch(() => undefined);
  // Receipts: the senders' messages become 'read' (blue ticks).
  await supabase.rpc('mark_messages_read', { p_chat: chatId });

  const { error } = await supabase
    .from('chat_participants')
    .update({ status: { ...asRecord(row.status), last_read_at: new Date().toISOString() } as any })
    .eq('chat_id', chatId)
    .eq('user_id', user.id);

  if (error) throw error;
}

export async function markAllChatsAsRead() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: rows, error: readError } = await supabase
    .from('chat_participants')
    .select('chat_id, status')
    .eq('user_id', user.id);
  if (readError) throw readError;

  const now = new Date().toISOString();
  const results = await Promise.all(
    (rows ?? []).map((r) =>
      supabase
        .from('chat_participants')
        .update({ status: { ...asRecord(r.status), last_read_at: now } as any })
        .eq('chat_id', r.chat_id)
        .eq('user_id', user.id)
    )
  );
  const failed = results.find((r) => r.error);
  if (failed?.error) throw failed.error;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export async function searchUsers(query: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // Escape characters that are meaningful in a PostgREST `or()` filter / LIKE pattern,
  // so user input can never add its own filter clauses.
  const term = query.trim().slice(0, 60).replace(/[%_\\,()*"']/g, ' ').replace(/\s+/g, ' ').trim();
  if (term.length < 2) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, avatar_url, user_type')
    .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`)
    .neq('id', user.id)
    .limit(20);

  if (error) throw error;
  return data;
}

export async function getCaseChat(caseId: string, survivorId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // 1. Resolve true participants from matched_services
  const { data: matchData } = await supabase
    .from('matched_services')
    .select(`
      survivor_id,
      hrd_profile_id,
      report_id,
      chat_id,
      support_services ( user_id )
    `)
    .eq('id', caseId)
    .single();

  // 1.2. If match already has a linked chat, return it immediately
  if (matchData?.chat_id) {
    const { data: linkedChat } = await supabase
      .from('chats')
      .select('*, participants:chat_participants(*, user:profiles(*))')
      .eq('id', matchData.chat_id)
      .single();
    
    if (linkedChat) return transformChat((await withParticipantProfiles(supabase, [linkedChat]))[0]);
  }

  const actualSurvId = matchData?.survivor_id || survivorId;
  
  // The professional is either HRD directly, or the user of the service
  let profId = matchData?.hrd_profile_id;
  if (!profId && matchData?.support_services) {
      // Support services might be returned as an object or a single-item array
      const ss = Array.isArray(matchData.support_services) 
        ? matchData.support_services[0] 
        : matchData.support_services;
      profId = (ss as any)?.user_id;
  }
  
  // Fallback to caller if no professional found (edge case)
  if (!profId) profId = user.id;

  // Only the two parties to a case may open (or create) its chat.
  if (matchData && user.id !== actualSurvId && user.id !== profId) {
    const { data: me } = await supabase.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    if (!me?.is_admin) throw new Error('You are not part of this case.');
  }

  // 1.5. Safety: Don't create DM with self if we can avoid it by resolving correctly
  // If I am the professional, the "other" must be the survivor.
  // If I am the survivor, the "other" must be the professional.
  const targetOtherId = user.id === profId ? actualSurvId : profId;

  // 2. Try to find existing chat between these two people
  const { data: allParticipants } = await supabase
    .from('chat_participants')
    .select('chat_id, user_id')
    .in('user_id', [actualSurvId, profId]);

  if (allParticipants && allParticipants.length > 0) {
    // Robust Share Detection: Find ANY chat ID that contains BOTH users
    const myChatIds = new Set(allParticipants.filter(p => p.user_id === user.id).map(p => p.chat_id));
    const targetChatIds = allParticipants.filter(p => p.user_id === targetOtherId).map(p => p.chat_id);
    
    // Two people can also share a community/group chat; only a direct or
    // support-match chat is a valid "case chat".
    const sharedCandidates = targetChatIds.filter(cid => myChatIds.has(cid));
    let sharedChatId: string | undefined;
    if (sharedCandidates.length) {
      const { data: direct } = await supabase
        .from('chats')
        .select('id')
        .in('id', sharedCandidates)
        .in('type', ['dm', 'support_match'])
        .order('last_message_at', { ascending: false, nullsFirst: false })
        .limit(1);
      sharedChatId = direct?.[0]?.id;
    }

    if (sharedChatId) {
      // If we found a shared chat, link it to the match for future direct access
      if (matchData && !matchData.chat_id) {
          await supabase.from('matched_services').update({ chat_id: sharedChatId }).eq('id', caseId);
      }
      const { data: fullChat } = await supabase
        .from('chats')
        .select(`
          *,
          participants:chat_participants(
            *,
            user:profiles(*)
          )
        `)
        .eq('id', sharedChatId)
        .single();

      if (fullChat) {
        // Update metadata with latest case context
        const meta = (fullChat.metadata || {}) as ChatMetadata;
        await supabase
          .from('chats')
          .update({ 
            metadata: { 
              ...meta, 
              case_id: caseId, 
              report_id: matchData?.report_id 
            } 
          })
          .eq('id', sharedChatId);
          
        return transformChat((await withParticipantProfiles(supabase, [fullChat]))[0]);
      }
    }
  }

  // 3. Create new chat if not found
  const { data: chat, error: createError } = await supabase
    .from('chats')
    .insert({
      type: 'support_match',
      created_by: user.id,
      match_id: caseId,
      metadata: { 
        case_id: caseId,
        report_id: matchData?.report_id
      }
    })
    .select()
    .single();

  if (createError) throw createError;

  const participants = [
    {
      chat_id: chat.id,
      user_id: profId,
      status: { role: 'admin' }
    }
  ];

  if (actualSurvId && actualSurvId !== profId) {
    participants.push({
      chat_id: chat.id,
      user_id: actualSurvId,
      status: { role: 'member' }
    });
  }

  const { error: partError } = await supabase
    .from('chat_participants')
    .insert(participants);

  if (partError) throw partError;

  // 4. Return full chat object
  const { data: fullChat, error: fetchError } = await supabase
    .from('chats')
    .select(`
      *,
      participants:chat_participants(
        *,
        user:profiles(*)
      )
    `)
    .eq('id', chat.id)
    .single();

  if (fetchError) throw fetchError;

  return transformChat((await withParticipantProfiles(supabase, [fullChat]))[0]);
}

/**
 * Open a community's chat, joining the community first when the viewer is allowed to
 * (public communities, or one they were invited to — enforced by row-level security).
 * Membership drives chat participation (see 20261010_community_chats.sql), so after joining
 * the real, UUID-backed chat is readable and messages/realtime work like any other chat.
 */
export async function openCommunityChat(communityId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data: community, error: cErr } = await supabase
    .from('communities')
    .select('id, chat_id')
    .eq('id', communityId)
    .maybeSingle();
  if (cErr) throw cErr;
  if (!community?.chat_id) throw new Error('This community is not available.');

  const { data: membership } = await supabase
    .from('community_members')
    .select('id')
    .eq('community_id', communityId)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!membership) {
    const { error: joinError } = await supabase
      .from('community_members')
      .insert({ community_id: communityId, user_id: user.id, role: 'member' });
    if (joinError) throw new Error('You cannot join this community.');
  }

  const { data: chat, error } = await supabase
    .from('chats')
    .select('*, participants:chat_participants(*, user:profiles(*))')
    .eq('id', community.chat_id)
    .single();
  if (error) throw error;
  const [withProfiles] = await withParticipantProfiles(supabase, [chat]);
  return transformChat(withProfiles);
}
