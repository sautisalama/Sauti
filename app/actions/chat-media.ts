'use server';

import { createClient } from '@/utils/supabase/server';
import { loadLinkPreview } from '@/lib/chat/link-preview';

/** Link preview for the composer: signed-in users only. */
export async function fetchLinkMetadata(rawUrl: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  return loadLinkPreview(rawUrl);
}

export async function getChatMedia(chatId: string, type: 'media' | 'docs' | 'links') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  let query = supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false });

  if (type === 'media') {
    query = query.in('type', ['image', 'video']);
  } else if (type === 'docs') {
    query = query.eq('type', 'file');
  } else if (type === 'links') {
    // @> is the "contains" operator for JSONB (GIN-indexed)
    query = query.not('metadata->link_preview', 'is', 'null');
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}
