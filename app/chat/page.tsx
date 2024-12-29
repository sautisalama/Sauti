"use client";

import { useEffect, useState } from "react";
import { Channel, Window, MessageList, MessageInput } from "stream-chat-react";
import { createClient } from "@/utils/supabase/client";
import { StreamChat } from "stream-chat";

const apiKey = process.env.NEXT_PUBLIC_STREAM_KEY!;

export default function ChatPage() {
	const [channel, setChannel] = useState<any>(null);
	const [error, setError] = useState<string | null>(null);
	const supabase = createClient();

	useEffect(() => {
		const initializeChat = async () => {
			try {
				// 1. Get current user from Supabase
				const { data: currentUser } = await supabase.auth.getUser();
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

				if (!profile) {
					setError("No profile found");
					return;
				}

				// 3. Initialize Stream Chat client
				const chatClient = StreamChat.getInstance(apiKey);

				// 4. Connect user to Stream
				await chatClient.connectUser(
					{
						id: currentUser.user.id,
						name: `${profile.first_name} ${profile.last_name}`,
						role: profile.user_type, // This can be used for permissions
					},
					chatClient.devToken(currentUser.user.id) // In production, you should generate this token on the server
				);

				// 5. Create or join a channel
				const channel = chatClient.channel("messaging", "general", {
					name: "General Chat",
					members: [currentUser.user.id],
				});

				await channel.watch();
				setChannel(channel);
			} catch (err) {
				console.error("Error initializing chat:", err);
				setError("Failed to initialize chat");
			}
		};

		initializeChat();
	}, []);

	if (error) {
		return <div className="p-4 text-red-500">{error}</div>;
	}

	if (!channel) {
		return <div className="p-4">Loading chat...</div>;
	}

	return (
		<div className="h-screen">
			<Channel channel={channel}>
				<Window>
					<MessageList />
					<MessageInput />
				</Window>
			</Channel>
		</div>
	);
}
