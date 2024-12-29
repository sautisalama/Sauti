"use client";

import { useEffect, useState } from "react";
import {
	Channel,
	Window,
	MessageList,
	MessageInput,
	ChannelList,
} from "stream-chat-react";
import { createClient } from "@/utils/supabase/client";
import { StreamChat, Channel as StreamChannel } from "stream-chat";

const apiKey = process.env.NEXT_PUBLIC_STREAM_KEY!;

type ListProps = {
	loadedChannels?: StreamChannel[];
	setActiveChannel?: (channel: StreamChannel) => void;
	error?: boolean;
};

export default function ChatPage() {
	const [client, setClient] = useState<StreamChat | null>(null);
	const [channel, setChannel] = useState<StreamChannel | null>(null);
	const [error, setError] = useState<string | null>(null);
	const supabase = createClient();

	useEffect(() => {
		const initializeChat = async () => {
			try {
				// 1. Get current user from Supabase
				const { data: currentUser } = await supabase.auth.getUser();
				console.log("Current user:", currentUser);

				if (!currentUser.user) {
					setError("No authenticated user found");
					return;
				}

				// 2. Get user profile for name
				const { data: profile } = await supabase
					.from("profiles")
					.select("first_name, last_name, user_type")
					.eq("id", currentUser.user.id)
					.single();

				console.log("User profile:", profile);

				if (!profile) {
					setError("No profile found");
					return;
				}

				// 3. Initialize Stream Chat client
				const chatClient = StreamChat.getInstance(apiKey);
				console.log("Chat client initialized with API key:", apiKey);

				// 4. Connect user to Stream
				await chatClient.connectUser(
					{
						id: currentUser.user.id,
						name: `${profile.first_name} ${profile.last_name}`,
						role: profile.user_type,
					},
					chatClient.devToken(currentUser.user.id)
				);
				console.log("User connected to Stream");

				// 5. Create default channels if they don't exist and add user as member
				const channels = [
					{ id: "general", name: "General Chat" },
					{ id: "support", name: "Support" },
					{ id: "random", name: "Random" },
				];

				for (const channelInfo of channels) {
					const channel = chatClient.channel("messaging", channelInfo.id, {
						name: channelInfo.name,
						members: [currentUser.user.id],
					});
					await channel.create();
					// Ensure the user is added as a member
					await channel.addMembers([currentUser.user.id]);
				}

				setClient(chatClient);
			} catch (err) {
				console.error("Error initializing chat:", err);
				setError("Failed to initialize chat");
			}
		};

		initializeChat();

		return () => {
			client?.disconnectUser();
		};
	}, []);

	if (error) {
		return <div className="p-4 text-red-500">{error}</div>;
	}

	if (!client) {
		return <div className="p-4">Loading chat...</div>;
	}

	return (
		<div className="h-screen flex">
			{client && (
				<>
					<div className="w-60 flex-none border-r">
						<ChannelList
							filters={{
								type: "messaging",
							}}
							sort={{ last_message_at: -1 }}
							options={{ state: true, presence: true, limit: 10 }}
							customActiveChannel={channel?.id}
							onSelect={(channel: StreamChannel) => {
								console.log("Channel selected:", channel);
								setChannel(channel);
							}}
						/>
					</div>
					<div className="flex-1">
						{channel ? (
							<Channel channel={channel}>
								<Window>
									<MessageList />
									<MessageInput />
								</Window>
							</Channel>
						) : (
							<div className="p-4">Select a channel to start chatting</div>
						)}
					</div>
				</>
			)}
		</div>
	);
}
