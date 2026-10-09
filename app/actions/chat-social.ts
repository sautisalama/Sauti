'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin-client';

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  return { supabase, user };
}

/* ------------------------------------------------------------------ Sauti ID */

export async function getMySautiId(): Promise<string | null> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase.from('profiles').select('sauti_id, email').eq('id', user.id).maybeSingle();
  // Anonymous survivor accounts have no shareable identity.
  if (data?.email?.endsWith('@anon.sautisalama.org')) return null;
  return data?.sauti_id ?? null;
}

export async function regenerateMySautiId(): Promise<string> {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc('regenerate_sauti_id');
  if (error || !data) throw new Error('Could not create a new ID.');
  return data;
}

export async function findUserBySautiId(code: string) {
  const { supabase } = await requireUser();
  const { data, error } = await supabase.rpc('find_user_by_sauti_id', { p_code: code });
  if (error) throw new Error('Could not look that ID up.');
  return data?.[0] ?? null;
}

/** Open the existing direct chat with someone, or start one. Returns the chat id. */
export async function startDirectChat(otherUserId: string): Promise<string> {
  const { supabase, user } = await requireUser();
  if (otherUserId === user.id) throw new Error('You cannot message yourself.');

  const db = createAdminClient();
  const { data: rows } = await db.from('chat_participants').select('chat_id, user_id').in('user_id', [user.id, otherUserId]);
  const mine = new Set((rows ?? []).filter((r) => r.user_id === user.id).map((r) => r.chat_id));
  const shared = (rows ?? []).filter((r) => r.user_id === otherUserId && mine.has(r.chat_id)).map((r) => r.chat_id);
  if (shared.length) {
    const { data: dm } = await db
      .from('chats')
      .select('id, metadata')
      .in('id', shared)
      .eq('type', 'dm')
      .order('last_message_at', { ascending: false, nullsFirst: false });
    const plain = dm?.find((c) => !(c.metadata as { admin_review?: boolean } | null)?.admin_review);
    if (plain) return plain.id;
  }

  const { data: chat, error } = await supabase.from('chats').insert({ type: 'dm', created_by: user.id, metadata: {} }).select('id').single();
  if (error || !chat) throw new Error('Could not start the chat.');
  const { error: pErr } = await supabase.from('chat_participants').insert([
    { chat_id: chat.id, user_id: user.id, status: { role: 'admin' } },
    { chat_id: chat.id, user_id: otherUserId, status: { role: 'member' } },
  ]);
  if (pErr) {
    await db.from('chats').delete().eq('id', chat.id);
    throw new Error('Could not start the chat.');
  }
  return chat.id;
}

/* ------------------------------------------------------------ Message actions */

export async function deleteMessage(messageId: string) {
  const { supabase } = await requireUser();
  const { error } = await supabase.rpc('delete_message', { p_message_id: messageId });
  if (error) throw new Error(error.message.includes('Forbidden') ? 'You cannot delete this message.' : 'Could not delete the message.');
  return { success: true };
}

export async function markChatDelivered(chatId: string) {
  const { supabase } = await requireUser();
  await supabase.rpc('mark_messages_delivered', { p_chat: chatId });
}

/* -------------------------------------------------------- Member profile card */

export interface MemberProfileCard {
  id: string;
  name: string;
  avatarUrl: string | null;
  userType: string | null;
  isVerified: boolean;
  title: string | null;
  bio: string | null;
  memberSince: string | null;
  outOfOffice: boolean;
  services: { name: string; types: string }[];
  groupRole: 'admin' | 'moderator' | 'member' | null;
}

/**
 * Details about a person you share a chat with. Contact details (email, phone) are never returned;
 * to talk to them, message them. Refused unless the caller shares a chat with them.
 */
export async function getMemberProfile(userId: string, chatId?: string): Promise<MemberProfileCard | null> {
  const { user } = await requireUser();
  const db = createAdminClient();

  if (userId !== user.id) {
    const { data: rows } = await db.from('chat_participants').select('chat_id, user_id').in('user_id', [user.id, userId]);
    const mine = new Set((rows ?? []).filter((r) => r.user_id === user.id).map((r) => r.chat_id));
    if (!(rows ?? []).some((r) => r.user_id === userId && mine.has(r.chat_id))) return null;
  }

  const { data: p } = await db
    .from('profiles')
    .select('id, first_name, last_name, avatar_url, profile_image_url, user_type, isVerified, professional_title, bio, created_at, out_of_office, is_anonymous, anon_username')
    .eq('id', userId)
    .maybeSingle();
  if (!p) return null;

  const isAnon = !!p.is_anonymous;
  let services: MemberProfileCard['services'] = [];
  if (!isAnon && (p.user_type === 'professional' || p.user_type === 'ngo')) {
    const { data } = await db
      .from('support_services')
      .select('name, service_types')
      .eq('user_id', userId)
      .eq('verification_status', 'verified')
      .limit(6);
    services = (data ?? []).map((s) => ({ name: s.name ?? 'Service', types: String(s.service_types ?? '').replace(/_/g, ' ') }));
  }

  let groupRole: MemberProfileCard['groupRole'] = null;
  if (chatId) {
    const { data: comm } = await db.from('communities').select('id, creator_id').eq('chat_id', chatId).maybeSingle();
    if (comm) {
      if (comm.creator_id === userId) groupRole = 'admin';
      else {
        const { data: m } = await db.from('community_members').select('role').eq('community_id', comm.id).eq('user_id', userId).maybeSingle();
        groupRole = (m?.role as MemberProfileCard['groupRole']) ?? null;
      }
    }
  }

  return {
    id: p.id,
    name: isAnon ? p.anon_username || 'Anonymous survivor' : `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || 'Sauti Salama member',
    avatarUrl: isAnon ? null : p.avatar_url || p.profile_image_url || null,
    userType: p.user_type ?? null,
    isVerified: !!p.isVerified,
    title: isAnon ? null : p.professional_title ?? null,
    bio: isAnon ? null : p.bio ?? null,
    memberSince: p.created_at ?? null,
    outOfOffice: !!p.out_of_office,
    services,
    groupRole,
  };
}

/* -------------------------------------------------------------- Salama history */

export async function getAssistantHistory(limit = 100) {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from('assistant_messages')
    .select('id, role, content, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(limit);
  return (data ?? []).reverse();
}

export async function clearAssistantHistory() {
  const { supabase, user } = await requireUser();
  const { error } = await supabase.from('assistant_messages').delete().eq('user_id', user.id);
  if (error) throw new Error('Could not clear the history.');
  return { success: true };
}
