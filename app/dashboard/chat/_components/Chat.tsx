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

	useEffect(() => {
		const initChat = async () => {
			const response = await fetch("/api/stream/token");
			const { token } = await response.json();

			const streamClient = new StreamChatClient(
				process.env.NEXT_PUBLIC_STREAM_KEY!,
				{ timeout: 6000 }
			);

			await streamClient.connectUser(
				{
					id: userId,
					name: username,
				},
				token
			);

			// Fetch all users
			const { users: userList } = await streamClient.queryUsers(
				{ id: { $ne: userId } }, // Exclude current user
				{ id: 1 }
			);

			setUsers(
				userList.map((user) => ({
					id: user.id,
					username: user.name || user.id,
				}))
			);

			setClient(streamClient);
		};

		initChat();

		return () => {
			if (client) {
				client.disconnectUser();
			}
		};
	}, [userId, username, client]);

	const startDirectMessage = async (otherUserId: string) => {
		if (!client) return;

		// Create a unique channel ID for the 1-on-1 chat
		const channelId = [userId, otherUserId].sort().join("-");

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
			<StreamChat client={client} theme="messaging light">
				<div className="w-80 border-r border-gray-200">
					<UserList users={users} onUserSelect={startDirectMessage} />
				</div>
				{channel ? (
					<Channel channel={channel}>
						<Window>
							<ChannelHeader />
							<MessageList />
							<MessageInput />
						</Window>
						<Thread />
					</Channel>
				) : (
					<div className="flex-1 flex items-center justify-center">
						<p className="text-gray-500">Select a user to start chatting</p>
					</div>
				)}
			</StreamChat>
		</div>
	);
}
