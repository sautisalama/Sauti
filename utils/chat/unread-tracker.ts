"use client";

import { getPreloadedChat, preloadChat } from "./preload";

export interface UnreadMessageData {
	caseId: string;
	unreadCount: number;
}

export async function getUnreadMessagesForCases(
	userId: string,
	username: string,
	caseIds: string[]
): Promise<UnreadMessageData[]> {
	try {
		let pre = getPreloadedChat(userId);
		if (!pre) {
			pre = await preloadChat(userId, username);
		}

		const unreadData: UnreadMessageData[] = [];

		// This is a simplified implementation
		// In a real implementation, you would:
		// 1. Get all DM channels for the user
		// 2. Filter channels that correspond to the case IDs
		// 3. Count unread messages for each channel
		// 4. Map channel IDs to case IDs

		// For now, we'll simulate unread counts
		caseIds.forEach((caseId) => {
			unreadData.push({
				caseId,
				unreadCount: Math.floor(Math.random() * 3), // Simulated unread count
			});
		});

		return unreadData;
	} catch (error) {
		console.error("Error fetching unread messages:", error);
		return caseIds.map((caseId) => ({ caseId, unreadCount: 0 }));
	}
}

export function subscribeToUnreadMessages(
	userId: string,
	username: string,
	onUpdate: (unreadData: UnreadMessageData[]) => void
): () => void {
	let cleanup: (() => void) | undefined;

	const init = async () => {
		try {
			let pre = getPreloadedChat(userId);
			if (!pre) {
				pre = await preloadChat(userId, username);
			}

			const computeUnread = () => {
				try {
					const total = (pre?.dmChannels || []).reduce((sum: number, ch: any) => {
						const n = typeof ch.countUnread === "function" ? ch.countUnread() : 0;
						return sum + (Number.isFinite(n) ? n : 0);
					}, 0);

					// This is a simplified implementation
					// In a real implementation, you would map channels to case IDs
					onUpdate([{ caseId: "default", unreadCount: total }]);
				} catch {
					onUpdate([]);
				}
			};

			computeUnread();
			const client = pre?.client as any;
			if (client && typeof client.on === "function") {
				const handler = () => computeUnread();
				client.on("notification.message_new", handler);
				client.on("message.new", handler);
				client.on("notification.mark_read", handler);
				client.on("notification.channel_marked_read", handler);
				client.on("notification.added_to_channel", handler);

				cleanup = () => {
					try {
						client.off("notification.message_new", handler);
						client.off("message.new", handler);
						client.off("notification.mark_read", handler);
						client.off("notification.channel_marked_read", handler);
						client.off("notification.added_to_channel", handler);
					} catch {
						// Ignore cleanup errors
					}
				};
			}
		} catch {
			onUpdate([]);
		}
	};

	init();
	return () => {
		if (cleanup) cleanup();
	};
}
