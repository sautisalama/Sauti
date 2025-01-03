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
import { StreamChat, Channel as StreamChannel } from "stream-chat";
import "stream-chat-react/dist/css/v2/index.css";

interface ChatComponentProps {
	userId: string;
	username: string;
}

export function ChatComponent({ userId, username }: ChatComponentProps) {
	const [client, setClient] = useState<StreamChat | null>(null);
	const [channel, setChannel] = useState<StreamChannel | null>(null);

	useEffect(() => {
		const initChat = async () => {
			try {
				const response = await fetch("/api/stream/token", {
					signal: AbortSignal.timeout(10000),
				});

				if (!response.ok) throw new Error("Failed to fetch token");

				const { token } = await response.json();

				const streamClient = StreamChat.getInstance(
					process.env.NEXT_PUBLIC_STREAM_KEY!
				);

				await streamClient.connectUser(
					{
						id: userId,
						name: username,
					},
					token
				);

				const channel = streamClient.channel("messaging", "general", {
					name: "General",
					created_by_id: userId,
					members: [],
					configs: {
						replies: true,
						typing_events: true,
						read_events: true,
						connect_events: true,
					},
					permissions: {
						"read-channel": ["*"],
						"write-channel": ["*"],
						"send-message": ["*"],
						"read-messages": ["*"],
					},
				});

				await channel.watch();
				setChannel(channel);
				setClient(streamClient);
			} catch (error) {
				console.error("Error initializing chat:", error);
			}
		};

		initChat();

		return () => {
			if (client) {
				client.disconnectUser();
			}
		};
	}, [userId, username, client]);

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
