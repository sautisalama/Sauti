"use client";

import { useEffect, useState } from "react";
import {
	Chat as StreamChat,
	Channel,
	ChannelHeader,
	MessageInput,
	MessageList,
	Thread,
	Window,
} from "stream-chat-react";
import { StreamChat as StreamChatClient } from "stream-chat";
import { UserList } from "./UserList";
import "stream-chat-react/dist/css/v2/index.css";

interface User {
	id: string;
	username: string;
}

export function ChatComponent({
	userId,
	username,
}: {
	userId: string;
	username: string;
}) {
	const [client, setClient] = useState<StreamChatClient | null>(null);
	const [channel, setChannel] = useState<any>(null);
	const [users, setUsers] = useState<User[]>([]);
	const [connectionError, setConnectionError] = useState<string | null>(null);

	useEffect(() => {
		const initChat = async () => {
			try {
				// Check if we already have a client instance
				if (client) return;

				const response = await fetch("/api/stream/token");
				const { token } = await response.json();

				const streamClient = new StreamChatClient(
					process.env.NEXT_PUBLIC_STREAM_KEY!,
					{
						timeout: 6000,
					}
				);

				await streamClient.connectUser(
					{
						id: userId,
						name: username,
					},
					token
				);

				// Reset error state on successful connection
				setConnectionError(null);
				setClient(streamClient);

				// Fetch users after successful connection
				const { users: streamUsers } = await streamClient.queryUsers(
					{ id: { $ne: userId } },
					{ last_active: -1 }
				);
				setUsers(
					streamUsers.map((user) => ({
						id: user.id,
						username: user.name || user.id,
					}))
				);
			} catch (error) {
				console.error("Error connecting to Stream:", error);
				setConnectionError("Unable to connect to chat. Please try again later.");
			}
		};

		initChat();

		// Cleanup function
		return () => {
			const cleanup = async () => {
				if (client) {
					await client.disconnectUser();
					setClient(null);
					setChannel(null);
				}
			};
			cleanup();
		};
	}, [userId, username, client]);

	const startDirectMessage = async (otherUserId: string) => {
		if (!client) return;

		// Create a shorter unique channel ID by taking parts of the UUIDs
		const channelId = [userId.slice(0, 12), otherUserId.slice(0, 12)]
			.sort()
			.join("-");

		const newChannel = client.channel("messaging", channelId, {
			members: [userId, otherUserId],
		});

		await newChannel.create();
		setChannel(newChannel);
	};

	if (!client) {
		return <div>Loading...</div>;
	}

	return (
		<div className="flex h-full">
			{connectionError ? (
				<div className="w-full flex items-center justify-center">
					<div className="text-center">
						<p className="text-red-500 mb-4">{connectionError}</p>
						<button
							onClick={() => {
								setConnectionError(null);
								setClient(null); // Reset client to trigger reconnection
							}}
							className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700"
						>
							Retry Connection
						</button>
					</div>
				</div>
			) : (
				<StreamChat client={client}>
					<div className="flex h-full w-full">
						<div className="w-80 border-r border-gray-200">
							<UserList users={users} onUserSelect={startDirectMessage} />
						</div>
						{channel ? (
							<div className="flex-1">
								<Channel channel={channel}>
									<Window>
										<ChannelHeader />
										<MessageList />
										<MessageInput />
									</Window>
									<Thread />
								</Channel>
							</div>
						) : (
							<div className="flex-1 flex items-center justify-center">
								<p className="text-gray-500">Select a user to start chatting</p>
							</div>
						)}
					</div>
				</StreamChat>
			)}
		</div>
	);
}
