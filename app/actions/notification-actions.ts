'use server';

import { createClient } from "@/utils/supabase/server";
import { revalidatePath } from "next/cache";

export async function markNotificationAsRead(notificationId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('id', notificationId);

  if (error) {
    console.error('Error marking notification as read:', error);
    throw new Error('Failed to mark notification as read');
  }

  revalidatePath('/', 'layout'); 
  return { success: true };
}

export async function markAllNotificationsAsRead() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false, error: 'User not found' };

  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', user.id)
    .eq('read', false);

  if (error) {
    console.error('Error marking all notifications as read:', error);
    throw new Error('Failed to mark all as read');
  }

  revalidatePath('/', 'layout');
  return { success: true };
}
