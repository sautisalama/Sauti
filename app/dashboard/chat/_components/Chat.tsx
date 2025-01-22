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
import Animation from "@/components/LottieWrapper";
import ChatAnimation from "@/public/lottie-animations/messages.json";

interface ChatComponentProps {
	userId: string;
	username: string;
}

export function ChatComponent({ userId, username }: ChatComponentProps) {
	const [client, setClient] = useState<StreamChat | null>(null);
	const [channel, setChannel] = useState<StreamChannel | null>(null);
	const [isLoading, setIsLoading] = useState(true);

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
						role: "user",
					},
					token
				);

				const channel = streamClient.channel("messaging", "general", {
					name: "General",
					members: [userId],
					configs: {
						replies: true,
						typing_events: true,
						read_events: true,
						connect_events: true,
					},
				});

				await channel.watch();
				setChannel(channel);
				setClient(streamClient);
				setIsLoading(false);
			} catch (error) {
				console.error("Error initializing chat:", error);
				setIsLoading(false);
			}
		};

		initChat();

		return () => {
			if (client) {
				client.disconnectUser();
			}
		};
	}, [userId, username, isLoading, client, channel]);

	if (isLoading || !client || !channel) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen p-4">
				<div className="text-center space-y-4">
					<Animation animationData={ChatAnimation} />
					<p className="text-muted-foreground">Getting community chats...</p>
				</div>
			</div>
		);
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
