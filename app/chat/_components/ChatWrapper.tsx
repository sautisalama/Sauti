"use client";

import { StreamChat } from "stream-chat";
import { Chat } from "stream-chat-react";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";

// Make sure to add your Stream API key to your environment variables
const apiKey = process.env.NEXT_PUBLIC_STREAM_KEY!;

export default function ChatWrapper({
	children,
}: {
	children: React.ReactNode;
}) {
	const [chatClient, setChatClient] = useState<StreamChat | null>(null);
	const supabase = createClient();

	useEffect(() => {
		const initChat = async () => {
			const client = StreamChat.getInstance(apiKey);

			// Get current user from Supabase
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) return;

			// Get user profile
			const { data: profile } = await supabase
				.from("profiles")
				.select("*")
				.eq("id", user.id)
				.single();

			if (!profile) return;

			// Get Stream Chat token from our API
			const response = await fetch("/api/stream/token", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ userId: user.id }),
			});

			const { token } = await response.json();
			if (!token) return;

			// Connect user to Stream Chat
			await client.connectUser(
				{
					id: user.id,
					name: `${profile.first_name} ${profile.last_name}`,
					role: profile.user_type,
				},
				token // Using the server-generated token
			);

			setChatClient(client);
		};

		initChat();

		return () => {
			if (chatClient) chatClient.disconnectUser();
		};
	}, []);

	if (!chatClient) {
		return <div>Loading chat...</div>;
	}

	return <Chat client={chatClient}>{children}</Chat>;
}
