'use server';

import { createClient } from '@/utils/supabase/server';
import { Chat, Message, ChatType, MessageType } from '@/types/chat';

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
  
  // Filter client-side if needed or rely on RLS (RLS is safer)
  return data as Chat[];
}

export async function getMessages(chatId: string, limit = 50, before?: string) {
  const supabase = await createClient();
  
  let query = supabase
    .from('messages')
    .select(`
      *,
      sender:profiles(id, first_name, last_name, avatar_url)
    `)
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;
  if (error) throw error;

  return (data as Message[]).reverse(); // Return in chronological order for UI
}

export async function sendMessage(chatId: string, content: string, type: MessageType = 'text', metadata = {}) {
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
      metadata
    })
    .select()
    .single();

  if (error) throw error;
  return data as Message;
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

  const { error } = await supabase
    .from('chat_participants')
    .update({ 
      status: {
        last_read_at: new Date().toISOString()
      } as any 
    })
    .eq('chat_id', chatId)
    .eq('user_id', user.id);

  if (error) throw error;
}

export async function searchUsers(query: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  const { data, error } = await supabase
    .from('profiles')
    .select('id, first_name, last_name, avatar_url, user_type')
    .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,email.ilike.%${query}%`)
    .neq('id', user.id)
    .limit(20);

  if (error) throw error;
  return data;
}

export async function getCaseChat(caseId: string, survivorId: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // 1. Try to find existing chat for this case
  const { data: existingChats, error: searchError } = await supabase
    .from('chats')
    .select(`
      *,
      participants:chat_participants(
        *,
        user:profiles(*)
      )
    `)
    // We use granular metadata query if possible, or filter in code if contains is tricky with partial JSON
    // .contains('metadata', { case_id: caseId }) // This works if metadata is JSONB and indexed
    .textSearch('metadata', `${caseId}`) // Alternative or just fetch and filter
    .limit(5); // Fetch a few and filter in JS to be safe

  if (searchError) throw searchError;

  // Filter precisely for case_id in metadata
  const foundChat = existingChats?.find((c: any) => c.metadata?.case_id === caseId);

  if (foundChat) {
    return foundChat as Chat;
  }

  // 2. Create new chat if not found
  const { data: chat, error: createError } = await supabase
    .from('chats')
    .insert({
      type: 'support_match',
      created_by: user.id,
      metadata: { case_id: caseId }
    })
    .select()
    .single();

  if (createError) throw createError;

  // 3. Add Participants (Professional and Survivor)
  const participants = [
    {
      chat_id: chat.id,
      user_id: user.id,
      status: { role: 'admin' }
    },
    {
      chat_id: chat.id,
      user_id: survivorId,
      status: { role: 'member' }
    }
  ];

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

  return fullChat as Chat;
}
