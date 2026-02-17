
import { createClient } from '@/utils/supabase/server';
import { SupabaseClient } from '@supabase/supabase-js';

export async function sendInAppNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  link?: string,
  metadata?: Record<string, any>,
  client?: SupabaseClient
) {
  const supabase = client ?? await createClient();

  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    message,
    link,
    metadata,
    read: false,
  });

  if (error) {
    console.error('Failed to send in-app notification:', error);
    return { success: false, error };
  }

  return { success: true };
}
