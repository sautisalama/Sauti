'use server';

import { createClient } from '@/utils/supabase/server';
import { createAdminClient } from '@/utils/supabase/admin-client';
import { insertNotificationsWithPush } from '@/lib/notifications/push';
import { looseAdmin } from '@/lib/loose-db';

type Role = 'admin' | 'moderator' | 'member';

async function requireUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  return user;
}

/** The caller's standing in a community: 'admin' includes the creator. */
async function standing(communityId: string, userId: string) {
  const db = createAdminClient();
  const { data: community } = await db
    .from('communities')
    .select('id, name, creator_id, chat_id')
    .eq('id', communityId)
    .maybeSingle();
  if (!community) throw new Error('Community not found.');
  let role: Role | null = null;
  if (community.creator_id === userId) role = 'admin';
  else {
    const { data: m } = await db.from('community_members').select('role').eq('community_id', communityId).eq('user_id', userId).maybeSingle();
    role = (m?.role as Role | undefined) ?? null;
  }
  return { db, community, role };
}

async function requireRole(communityId: string, userId: string, allowed: Role[]) {
  const s = await standing(communityId, userId);
  if (!s.role || !allowed.includes(s.role)) throw new Error('Only group admins can do that.');
  return s;
}

/** A line in the conversation ("Amina is now an admin"), like WhatsApp's group notices. */
async function postNotice(chatId: string | null, actorId: string, text: string) {
  if (!chatId) return;
  await createAdminClient().from('messages').insert({ chat_id: chatId, sender_id: actorId, content: text, type: 'system' });
}

export interface CommunityMember {
  userId: string;
  name: string;
  avatarUrl: string | null;
  role: Role;
  isCreator: boolean;
  isVerified: boolean;
  userType: string | null;
}

export interface CommunityDetails {
  communityId: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  isPublic: boolean;
  createdAt: string | null;
  /** Shareable group ID (SG-XXXX-XXXX); the invite link is /join/<this>. */
  inviteCode: string | null;
  myRole: Role;
  members: CommunityMember[];
}

/** Everything the group-info screen needs. Only members of the group may ask. */
export async function getCommunityDetails(chatId: string): Promise<CommunityDetails | null> {
  const user = await requireUser();
  const db = createAdminClient();
  const { data: c } = await db
    .from('communities')
    .select('id, name, description, avatar_url, is_public, creator_id, created_at')
    .eq('chat_id', chatId)
    .maybeSingle();
  if (!c) return null;

  const { role: myRole } = await standing(c.id, user.id);
  if (!myRole) return null;
  const { data: inv } = await looseAdmin().from('communities').select('invite_code').eq('id', c.id).maybeSingle();

  const { data: members } = await db.from('community_members').select('user_id, role, joined_at').eq('community_id', c.id);
  const ids = Array.from(new Set([...(members ?? []).map((m) => m.user_id), c.creator_id].filter(Boolean))) as string[];
  const { data: profiles } = await db
    .from('profiles')
    .select('id, first_name, last_name, avatar_url, user_type, isVerified, is_anonymous, anon_username')
    .in('id', ids);
  const byId = new Map((profiles ?? []).map((p) => [p.id, p]));

  const rank = (m: CommunityMember) => (m.isCreator ? 0 : m.role === 'admin' ? 1 : m.role === 'moderator' ? 2 : 3);
  const list: CommunityMember[] = ids
    .map((id) => {
      const p = byId.get(id);
      const row = (members ?? []).find((m) => m.user_id === id);
      const isCreator = id === c.creator_id;
      const anon = !!p?.is_anonymous;
      return {
        userId: id,
        name: anon ? p?.anon_username || 'Anonymous member' : `${p?.first_name ?? ''} ${p?.last_name ?? ''}`.trim() || 'Member',
        avatarUrl: anon ? null : p?.avatar_url ?? null,
        role: (isCreator ? 'admin' : (row?.role as Role)) ?? 'member',
        isCreator,
        isVerified: !!p?.isVerified,
        userType: p?.user_type ?? null,
      };
    })
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));

  return {
    communityId: c.id,
    name: c.name,
    description: c.description,
    avatarUrl: c.avatar_url,
    isPublic: !!c.is_public,
    createdAt: c.created_at,
    inviteCode: inv?.invite_code ?? null,
    myRole,
    members: list,
  };
}

export async function updateCommunity(communityId: string, patch: { name?: string; description?: string; avatarUrl?: string }) {
  const user = await requireUser();
  const { db, community } = await requireRole(communityId, user.id, ['admin', 'moderator']);

  const update: { name?: string; description?: string; avatar_url?: string } = {};
  if (patch.name !== undefined) {
    const name = patch.name.trim().slice(0, 80);
    if (name.length < 2) throw new Error('Give the group a name.');
    update.name = name;
  }
  if (patch.description !== undefined) update.description = patch.description.trim().slice(0, 500);
  if (patch.avatarUrl !== undefined) {
    if (!/^https:\/\//.test(patch.avatarUrl)) throw new Error('Invalid image.');
    update.avatar_url = patch.avatarUrl;
  }
  if (!Object.keys(update).length) return { success: true };

  const { error } = await db.from('communities').update(update).eq('id', communityId);
  if (error) throw new Error('Could not save the changes.');

  // The chat carries a copy of the name/photo for the chat list.
  if (community.chat_id) {
    const { data: chat } = await db.from('chats').select('metadata').eq('id', community.chat_id).maybeSingle();
    const meta = { ...((chat?.metadata as Record<string, unknown>) ?? {}) };
    if (update.name) meta.name = update.name;
    if (update.avatar_url) meta.image_url = update.avatar_url;
    if (update.description !== undefined) meta.description = update.description;
    await db.from('chats').update({ metadata: meta as never }).eq('id', community.chat_id);
  }
  if (update.avatar_url) await postNotice(community.chat_id, user.id, 'The group photo was changed');
  if (update.name) await postNotice(community.chat_id, user.id, `The group was renamed to "${update.name}"`);
  return { success: true };
}

export async function setMemberRole(communityId: string, targetUserId: string, role: Role) {
  const user = await requireUser();
  const { db, community } = await requireRole(communityId, user.id, ['admin']);
  if (targetUserId === community.creator_id) throw new Error("The group's creator is always an admin.");

  const { error } = await db.from('community_members').update({ role }).eq('community_id', communityId).eq('user_id', targetUserId);
  if (error) throw new Error('Could not change the role.');

  const { data: p } = await db.from('profiles').select('first_name').eq('id', targetUserId).maybeSingle();
  const who = p?.first_name || 'A member';
  await postNotice(community.chat_id, user.id, role === 'member' ? `${who} is no longer an admin` : `${who} is now ${role === 'admin' ? 'an admin' : 'a moderator'}`);
  return { success: true };
}

export async function removeMember(communityId: string, targetUserId: string) {
  const user = await requireUser();
  const { db, community } = await requireRole(communityId, user.id, ['admin']);
  if (targetUserId === community.creator_id) throw new Error("The group's creator cannot be removed.");
  if (targetUserId === user.id) throw new Error('Use "Leave group" to leave.');

  const { data: p } = await db.from('profiles').select('first_name').eq('id', targetUserId).maybeSingle();
  const { error } = await db.from('community_members').delete().eq('community_id', communityId).eq('user_id', targetUserId);
  if (error) throw new Error('Could not remove that member.');
  await postNotice(community.chat_id, user.id, `${p?.first_name || 'A member'} was removed`);
  return { success: true };
}

export async function addMembers(communityId: string, userIds: string[]) {
  const user = await requireUser();
  const { db, community } = await requireRole(communityId, user.id, ['admin', 'moderator']);
  const ids = Array.from(new Set(userIds)).filter((id) => id && id !== user.id).slice(0, 50);
  if (!ids.length) return { added: 0 };

  const { data: existing } = await db.from('community_members').select('user_id').eq('community_id', communityId).in('user_id', ids);
  const have = new Set((existing ?? []).map((e) => e.user_id));
  const fresh = ids.filter((id) => !have.has(id));
  if (!fresh.length) return { added: 0 };

  // Only real, active accounts.
  const { data: valid } = await db.from('profiles').select('id, first_name').in('id', fresh).eq('is_banned', false);
  const rows = (valid ?? []).map((v) => ({ community_id: communityId, user_id: v.id, role: 'member' as const }));
  if (!rows.length) return { added: 0 };

  const { error } = await db.from('community_members').insert(rows);
  if (error) throw new Error('Could not add them.');

  const { data: actor } = await db.from('profiles').select('first_name').eq('id', user.id).maybeSingle();
  await postNotice(community.chat_id, user.id, `${actor?.first_name || 'An admin'} added ${rows.length === 1 ? (valid![0].first_name || 'a member') : `${rows.length} people`}`);
  await insertNotificationsWithPush(
    rows.map((r) => ({
      user_id: r.user_id,
      type: 'system_alert',
      title: 'Added to a group',
      message: `You were added to "${community.name}".`,
      link: community.chat_id ? `/dashboard/chat?id=${community.chat_id}` : '/dashboard/chat',
      read: false,
    }))
  );
  return { added: rows.length };
}

export async function leaveCommunity(communityId: string) {
  const user = await requireUser();
  const { db, community } = await standing(communityId, user.id);
  if (community.creator_id === user.id) throw new Error('You created this group, so you cannot leave it. Make someone else an admin and ask them to manage it, or delete the group.');
  const { data: p } = await db.from('profiles').select('first_name').eq('id', user.id).maybeSingle();
  const { error } = await db.from('community_members').delete().eq('community_id', communityId).eq('user_id', user.id);
  if (error) throw new Error('Could not leave the group.');
  await postNotice(community.chat_id, user.id, `${p?.first_name || 'A member'} left`);
  return { success: true };
}
