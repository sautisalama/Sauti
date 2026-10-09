import type { Chat } from '@/types/chat';

const MEDIA_LABEL: Record<string, string> = {
  image: '📷 Photo',
  video: '🎥 Video',
  audio: '🎤 Voice message',
  file: '📄 Document',
  location: '📍 Location',
};

/**
 * The one-line preview for the chat list. Media-only messages say what was sent
 * ("🎥 Video") instead of looking like an empty chat, and group chats show who sent it.
 */
export function chatPreview(chat: Chat, currentUserId?: string): string {
  const last = chat.metadata?.last_message_preview;
  if (!last) return 'No messages yet';

  const body = last.content?.trim() || MEDIA_LABEL[last.type] || 'Message';
  if (last.type === 'system') return body;

  let prefix = '';
  if (currentUserId && last.sender_id === currentUserId) prefix = 'You: ';
  else if (chat.type === 'community' || chat.type === 'group') {
    const sender = chat.participants?.find((p) => p.user_id === last.sender_id)?.user;
    if (sender?.first_name) prefix = `${sender.first_name}: `;
  }
  return prefix + body;
}
