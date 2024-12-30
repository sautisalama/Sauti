"use client";

import { useEffect, useState } from "react";
import { Chat } from "stream-chat-react";
import { StreamChat } from "stream-chat";
import { connectToStream } from "@/utils/stream-chat";
import ChatChannels from "./ChatChannels";
import { createClient } from "@/utils/supabase/client";

import "stream-chat-react/dist/css/v2/index.css";

export default function ChatWrapper({
	children,
}: {
	children: React.ReactNode;
}) {
	const [client, setClient] = useState<StreamChat | null>(null);
	const supabase = createClient();
	const [user, setUser] = useState<any>(null);

	useEffect(() => {
		// Get user on mount
		supabase.auth.getUser().then(({ data: { user } }) => {
			setUser(user);
		});
	}, []);

	useEffect(() => {
		if (!user) return;

		const initChat = async () => {
			try {
				const connectedClient = await connectToStream(
					user.id,
					user.name || "Anonymous"
				);
				setClient(connectedClient);
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
	}, [user]);

	if (!client || !user) {
		return <div>Loading chat...</div>;
	}

	return (
		<Chat client={client} theme="messaging light">
			<div className="flex h-screen">
				<ChatChannels userId={user.id} />
				<div className="flex-1">{children}</div>
			</div>
		</Chat>
	);
}
