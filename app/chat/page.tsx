"use client";
import { useEffect, useState } from "react";
import {
	Channel,
	Window,
	MessageList,
	MessageInput,
	ChannelList,
	ChannelPreviewUIComponentProps,
	ChannelPreviewMessenger,
} from "stream-chat-react";
import { StreamChat, Channel as StreamChannel } from "stream-chat";
import { createClient } from "@/utils/supabase/client";
import { Database } from "@/types/db-schema";

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

const DEFAULT_CHANNELS = [
	{ id: "general", name: "General Chat" },
	{ id: "support", name: "Support" },
	{ id: "random", name: "Random" },
] as const;

interface ChatPageProps {
	apiKey: string;
}

function CustomChannelPreview(props: ChannelPreviewUIComponentProps) {
	const handleDelete = async () => {
		try {
			await props.channel.delete();
		} catch (error) {
			console.error("Failed to delete channel:", error);
		}
	};

	return (
		<div className="flex items-center justify-between p-2 hover:bg-gray-100">
			<div className="flex-grow">
				<ChannelPreviewMessenger {...props} />
			</div>
			<button
				onClick={(e) => {
					e.stopPropagation();
					handleDelete();
				}}
				className="px-2 py-1 text-red-600 hover:text-red-800"
			>
				×
			</button>
		</div>
	);
}

export default function ChatPage({ apiKey }: ChatPageProps) {
	const [client, setClient] = useState<StreamChat | null>(null);
	const [channel, setChannel] = useState<StreamChannel | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [channels, setChannels] = useState<StreamChannel[]>([]);
	const supabase = createClient();

	useEffect(() => {
		const initializeChat = async () => {
			try {
				// Get current user from Supabase
				const {
					data: { user },
				} = await supabase.auth.getUser();
				if (!user) {
					setError("No authenticated user found");
					return;
				}

				// Get user profile
				const { data: profile, error: profileError } = await supabase
					.from("profiles")
					.select("*")
					.eq("id", user.id)
					.single();

				if (profileError || !profile) {
					setError("Failed to load user profile");
					return;
				}

				// Get Stream token
				const response = await fetch("/api/stream/token", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ userId: user.id }),
				});

				const { token } = await response.json();
				if (!token) {
					setError("Failed to get chat token");
					return;
				}

				// Initialize Stream Chat client
				const chatClient = StreamChat.getInstance(apiKey);
				await chatClient.connectUser(
					{
						id: user.id,
						name: `${profile.first_name} ${profile.last_name}`,
						role: profile.user_type,
					},
					token
				);

				// Create and join default channels
				const channelPromises = DEFAULT_CHANNELS.map(async (channelInfo) => {
					const channel = chatClient.channel("messaging", channelInfo.id, {
						name: channelInfo.name,
						members: [user.id],
					});

					try {
						await channel.create();
					} catch (error) {
						// Channel might already exist, try to watch it
						await channel.watch();
					}

					try {
						await channel.addMembers([user.id]);
					} catch (error) {
						// User might already be a member
						console.log(`User already member of ${channelInfo.name}`);
					}

					return channel;
				});

				const createdChannels = await Promise.all(channelPromises);
				setChannels(createdChannels);
				setClient(chatClient);

				// Set initial active channel
				if (createdChannels.length > 0) {
					setChannel(createdChannels[0]);
				}
			} catch (err) {
				console.error("Error initializing chat:", err);
				setError("Failed to initialize chat");
			}
		};

		initializeChat();

		return () => {
			client?.disconnectUser().then(() => {
				setClient(null);
			});
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
			<div className="w-60 flex-none border-r">
				<ChannelList
					filters={{
						type: "messaging",
						members: { $in: [client.userID] },
					}}
					sort={{ last_message_at: -1 }}
					options={{ state: true, presence: true, limit: 10 }}
					customActiveChannel={channel?.id}
					onSelect={(channel: StreamChannel) => setChannel(channel)}
					Preview={CustomChannelPreview}
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
		</div>
	);
}
