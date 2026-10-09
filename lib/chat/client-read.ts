import { markMessagesAsRead as markRead } from '@/app/actions/chat';

export const CHATS_CHANGED_EVENT = 'ss:chats-changed';

/** Mark a chat read, then tell the nav badges / app-icon counter to recount. */
export async function markMessagesAsRead(chatId: string) {
  const result = await markRead(chatId);
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(CHATS_CHANGED_EVENT));
  return result;
}
