import type { Chat } from "@/types/chat";

/** The AI assistant is a synthetic chat: it has no row in `chats`, so it is never in the loaded chat list. */
export const SALAMA_BOT_ID = "salama-ai-bot";

export function salamaBotChat(): Chat {
	const now = new Date().toISOString();
	return {
		id: SALAMA_BOT_ID,
		type: "dm",
		last_message_at: now,
		created_by: "system",
		created_at: now,
		metadata: {
			name: "Salama AI",
			is_official: true,
			last_message_preview: {
				content: "Ask about your options, rights and safety.",
				sender_id: "system",
				type: "text",
				created_at: now,
			},
		},
		participants: [],
		unread_count: 0,
	} as Chat;
}
