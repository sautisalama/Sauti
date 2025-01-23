"use client";

import { useEffect, useState } from "react";
import {
	Chat as StreamChat,
	Channel,
	ChannelHeader,
	MessageInput,
	MessageList,
	Window,
} from "stream-chat-react";
import { StreamChat as StreamChatClient } from "stream-chat";
import "stream-chat-react/dist/css/v2/index.css";
import { fetchAppointmentById } from "@/app/dashboard/_views/actions/appointments";

interface AppointmentChatProps {
	userId: string;
	username: string;
	appointmentId: string;
}

export function AppointmentChat({
	userId,
	username,
	appointmentId,
}: AppointmentChatProps) {
	const [client, setClient] = useState<StreamChatClient | null>(null);
	const [channel, setChannel] = useState<any>(null);
	const [connectionError, setConnectionError] = useState<string | null>(null);

	useEffect(() => {
		const initChat = async () => {
			try {
				if (client) return;

				const response = await fetch("/api/stream/token");
				if (!response.ok) {
					const errorData = await response.json();
					throw new Error(errorData.error || "Failed to fetch token");
				}

				const data = await response.json();
				if (!data.token) {
					throw new Error("No token received");
				}

				const streamClient = new StreamChatClient(
					process.env.NEXT_PUBLIC_STREAM_KEY!,
					{ timeout: 6000 }
				);

				await streamClient.connectUser(
					{
						id: userId,
						name: username,
					},
					data.token
				);

				const appointmentData = await fetchAppointmentById(appointmentId);
				const otherUserId =
					appointmentData.professional_id === userId
						? appointmentData.survivor_id
						: appointmentData.professional_id;

				// Create a consistent channel ID using sorted user IDs
				const channelId = [userId.slice(0, 12), otherUserId.slice(0, 12)]
					.sort()
					.join("-");

				const newChannel = streamClient.channel("messaging", channelId, {
					members: [userId, otherUserId],
				});

				await newChannel.create();
				setChannel(newChannel);
				setClient(streamClient);
				setConnectionError(null);
			} catch (error) {
				console.error("Error connecting to Stream:", error);
				setConnectionError(
					error instanceof Error
						? error.message
						: "Unable to connect to chat. Please try again later."
				);
			}
		};

		initChat();

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
	}, [userId, username, appointmentId, client, channel]);

	if (!client || !channel) {
		return (
			<div className="flex items-center justify-center h-full">
				<div className="text-center">
					{connectionError ? (
						<>
							<p className="text-red-500 mb-4">{connectionError}</p>
							<button
								onClick={() => {
									setConnectionError(null);
									setClient(null);
								}}
								className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700"
							>
								Retry Connection
							</button>
						</>
					) : (
						<div className="animate-pulse">Loading chat...</div>
					)}
				</div>
			</div>
		);
	}

	return (
		<div className="h-full">
			<StreamChat client={client}>
				<Channel channel={channel}>
					<Window>
						<ChannelHeader />
						<MessageList />
						<MessageInput />
					</Window>
				</Channel>
			</StreamChat>
		</div>
	);
}
