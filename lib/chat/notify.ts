import { createAdminClient } from '@/utils/supabase/admin-client';
import { sendPushToUser } from '@/lib/notifications/push';

/**
 * Tell the other people in a chat that a message arrived: one unread in-app notification per chat
 * (so the bell and the app-icon badge count conversations, WhatsApp-style, not every line) plus a
 * push to their devices. The message text is deliberately NOT included: lock screens are visible
 * to anyone nearby and these chats can involve survivors.
 */
export async function notifyChatMessage(chatId: string, senderId: string): Promise<void> {
  const db = createAdminClient();

  const [{ data: members }, { data: sender }] = await Promise.all([
    db.from('chat_participants').select('user_id').eq('chat_id', chatId).neq('user_id', senderId),
    db.from('profiles').select('first_name, email').eq('id', senderId).maybeSingle(),
  ]);
  if (!members?.length) return;

  const senderName = sender?.email?.endsWith('@anon.sautisalama.org')
    ? 'An anonymous survivor'
    : sender?.first_name?.trim() || 'Someone';
  const link = `/dashboard/chat?id=${chatId}`;

  await Promise.all(
    members.map(async ({ user_id }) => {
      try {
        const { data: existing } = await db
          .from('notifications')
          .select('id, metadata')
          .eq('user_id', user_id)
          .eq('type', 'new_message')
          .eq('read', false)
          .eq('metadata->>chat_id', chatId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        const count = ((existing?.metadata as { count?: number } | null)?.count ?? 0) + 1;
        const message = count > 1 ? `${count} new messages from ${senderName}` : `${senderName} sent you a message`;

        if (existing) {
          await db
            .from('notifications')
            .update({ message, created_at: new Date().toISOString(), metadata: { chat_id: chatId, count } })
            .eq('id', existing.id);
        } else {
          await db.from('notifications').insert({
            user_id,
            type: 'new_message',
            title: 'New message',
            message,
            link,
            metadata: { chat_id: chatId, count },
            read: false,
          });
        }
        await sendPushToUser(user_id, { title: 'New message', body: message, url: link, tag: `chat-${chatId}`, chatId, category: 'messages' });
      } catch (err) {
        console.error('Chat notification failed:', err);
      }
    })
  );
}

/** Opening a chat clears its unread notification (and so the badge). */
export async function clearChatNotifications(chatId: string, userId: string): Promise<void> {
  await createAdminClient()
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('type', 'new_message')
    .eq('read', false)
    .eq('metadata->>chat_id', chatId);
}
