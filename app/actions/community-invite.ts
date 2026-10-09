'use server';

import { createClient } from '@/utils/supabase/server';
import { looseAdmin } from '@/lib/loose-db';

const CODE = /^SG-[A-Z0-9]{4}-[A-Z0-9]{4}$/;

function normalise(code: string): string | null {
  const c = (code ?? '').toUpperCase().replace(/\s/g, '');
  return CODE.test(c) ? c : null;
}

export interface InvitePreview {
  code: string;
  name: string;
  description: string | null;
  avatarUrl: string | null;
  memberCount: number;
}

/** What a person sees on the invite page before signing in. Name, photo and size only. */
export async function getInvitePreview(rawCode: string): Promise<InvitePreview | null> {
  const code = normalise(rawCode);
  if (!code) return null;
  const { data } = await looseAdmin()
    .from('communities')
    .select('name, description, avatar_url, member_count')
    .eq('invite_code', code)
    .maybeSingle();
  if (!data) return null;
  return { code, name: data.name, description: data.description, avatarUrl: data.avatar_url, memberCount: data.member_count ?? 0 };
}

/** The invite page's "Join group" button. Returns the chat to open. */
export async function joinByInviteCode(rawCode: string): Promise<{ chatId: string }> {
  const code = normalise(rawCode);
  if (!code) throw new Error('This invite link is not valid.');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in to join.');

  const db = looseAdmin();
  const { data: banned } = await db.from('profiles').select('is_banned').eq('id', user.id).maybeSingle();
  if (banned?.is_banned) throw new Error('Your account cannot join groups.');

  const { data: community } = await db.from('communities').select('id, chat_id').eq('invite_code', code).maybeSingle();
  if (!community?.chat_id) throw new Error('This invite link is no longer valid.');

  const { data: existing } = await db.from('community_members').select('id').eq('community_id', community.id).eq('user_id', user.id).maybeSingle();
  if (!existing) {
    const { error } = await db.from('community_members').insert({ community_id: community.id, user_id: user.id, role: 'member' });
    if (error) throw new Error('Could not join the group.');
    const { data: me } = await db.from('profiles').select('first_name').eq('id', user.id).maybeSingle();
    await db.from('messages').insert({ chat_id: community.chat_id, sender_id: user.id, content: `${me?.first_name || 'Someone'} joined using the group link`, type: 'system' });
  }
  return { chatId: community.chat_id };
}

/** Admins: invalidate the old link and make a new one. */
export async function resetInviteCode(communityId: string): Promise<string> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  const db = looseAdmin();

  const { data: c } = await db.from('communities').select('id, creator_id').eq('id', communityId).maybeSingle();
  if (!c) throw new Error('Group not found.');
  let allowed = c.creator_id === user.id;
  if (!allowed) {
    const { data: m } = await db.from('community_members').select('role').eq('community_id', communityId).eq('user_id', user.id).maybeSingle();
    allowed = m?.role === 'admin';
  }
  if (!allowed) throw new Error('Only group admins can reset the link.');

  const { data: fresh } = await db.rpc('gen_invite_code');
  if (!fresh) throw new Error('Could not make a new link.');
  const { error } = await db.from('communities').update({ invite_code: fresh }).eq('id', communityId);
  if (error) throw new Error('Could not make a new link.');
  return fresh as string;
}
