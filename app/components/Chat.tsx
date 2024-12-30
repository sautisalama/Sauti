"use client";

import { useEffect, useState } from "react";
import {
	Chat,
	Channel,
	ChannelHeader,
	MessageInput,
	MessageList,
	Thread,
	Window,
} from "stream-chat-react";
import { StreamChat } from "stream-chat";
import "stream-chat-react/dist/css/v2/index.css";

interface ChatComponentProps {
	userId: string;
	username: string;
}

export function ChatComponent({ userId, username }: ChatComponentProps) {
	const [client, setClient] = useState<StreamChat | null>(null);
	const [channel, setChannel] = useState<any>(null);

	useEffect(() => {
		const initChat = async () => {
			const streamClient = StreamChat.getInstance(
				process.env.NEXT_PUBLIC_STREAM_KEY!
			);

			// Get token from our API endpoint
			const response = await fetch("/api/stream/token");
			const { token } = await response.json();

			await streamClient.connectUser(
				{
					id: userId,
					name: username,
				},
				token // Use the token from our API instead of devToken
			);

			// Initialize or join the general channel
			const channel = streamClient.channel("messaging", "general", {
				name: "General",
				members: [userId],
			});

			await channel.watch();
			setChannel(channel);
			setClient(streamClient);
		};

		initChat();

		return () => {
			if (client) {
				client.disconnectUser();
			}
		};
	}, [userId, username]);

	if (!client || !channel) {
		return <div>Loading...</div>;
	}

	return (
		<Chat client={client} theme="messaging light">
			<Channel channel={channel}>
				<Window>
					<ChannelHeader />
					<MessageList />
					<MessageInput />
				</Window>
				<Thread />
			</Channel>
		</Chat>
	);
}
