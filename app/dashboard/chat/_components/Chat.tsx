"use client";

import { useEffect, useRef, useState } from "react";
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
import Animation from "@/components/LottieWrapper";
import animationData from "@/public/lottie-animations/messages.json";
import styles from "./chat.module.css";
import { Button } from "@/components/ui/button";

interface User {
	id: string;
	username: string;
}

interface ChatComponentProps {
	userId: string;
	username: string;
	appointmentId?: string;
}

export function ChatComponent({
	userId,
	username,
	appointmentId,
}: ChatComponentProps) {
	const [client, setClient] = useState<StreamChatClient | null>(null);
	const [channel, setChannel] = useState<any>(null);
	const [users, setUsers] = useState<User[]>([]);
	const [connectionError, setConnectionError] = useState<string | null>(null);
	const [showUserList, setShowUserList] = useState(true);
	const [activeTab, setActiveTab] = useState<"community" | "dm">("community");
	const communityChannelRef = useRef<any>(null);

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
					{
						timeout: 6000,
					}
				);

				await streamClient.connectUser(
					{
						id: userId,
						name: username,
					},
					data.token
				);

				setConnectionError(null);
				setClient(streamClient);

				// Prepare or join community channel
				try {
					const community = streamClient.channel("messaging", "community-global", {
						name: "Sauti Community",
						members: [userId],
					});
					await community.create();
					communityChannelRef.current = community;
				} catch (err) {
					// ignore if already exists
					communityChannelRef.current = streamClient.channel("messaging", "community-global", {
						name: "Sauti Community",
						members: [userId],
					});
				}

				if (appointmentId) {
					const appointmentResponse = await fetch(
						`/api/appointments/${appointmentId}`
					);
					const appointmentData = await appointmentResponse.json();

					const otherUserId =
						appointmentData.professional_id === userId
							? appointmentData.survivor_id
							: appointmentData.professional_id;

					if (otherUserId) {
						const channelId = `appointment-${appointmentId}`;
						const newChannel = streamClient.channel("messaging", channelId, {
							members: [userId, otherUserId],
							appointment_id: appointmentId,
						});

						await newChannel.create();
						setChannel(newChannel);
					}
				} else {
					const { users: streamUsers } = await streamClient.queryUsers(
						{ id: { $ne: userId } },
						{ last_active: -1 }
					);
					setUsers(
						streamUsers.map((user) => ({
							id: user.id,
							username: user.name || user.id,
						}))
					);
				}
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

		// Cleanup function
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
	}, [userId, username, client, appointmentId]);

	const startDirectMessage = async (otherUserId: string) => {
		if (!client) return;

		const channelId = [userId.slice(0, 12), otherUserId.slice(0, 12)]
			.sort()
			.join("-");

		const newChannel = client.channel("messaging", channelId, {
			members: [userId, otherUserId],
		});

		await newChannel.create();
		setChannel(newChannel);
		setShowUserList(false);
	};

	const handleBackToUsers = () => {
		setShowUserList(true);
		setChannel(null);
	};

	if (!client) {
		return (
			<div className="flex flex-col items-center justify-center min-h-screen p-4">
				<div className="text-center space-y-4">
					<Animation animationData={animationData} />
					<p className="text-muted-foreground">Loading chat...</p>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-full pb-[72px] md:pb-0">
			{connectionError ? (
				<div className="w-full flex items-center justify-center">
					<div className="text-center">
						<p className="text-red-500 mb-4">{connectionError}</p>
						<button
							onClick={() => {
								setConnectionError(null);
								setClient(null); // Reset client to trigger reconnection
							}}
							className="px-4 py-2 bg-teal-600 text-white rounded hover:bg-teal-700"
						>
							Retry Connection
						</button>
					</div>
				</div>
			) : (
				<StreamChat client={client}>
					<div className={`flex h-full w-full ${styles.chatBackground}`}>
						{/* Left rail (desktop) */}
						<div className="hidden md:flex flex-col w-80 border-r border-gray-200 bg-white">
							<div className="p-3 border-b">
								<div className="flex gap-2">
									<Button size="sm" variant={activeTab === "community" ? "default" : "outline"} onClick={() => setActiveTab("community")}>Community</Button>
									<Button size="sm" variant={activeTab === "dm" ? "default" : "outline"} onClick={() => setActiveTab("dm")}>Messages</Button>
								</div>
							</div>
							{activeTab === "dm" ? (
								<UserList users={users} onUserSelect={startDirectMessage} />
							) : (
								<div className="p-4 text-sm text-gray-600">Welcome to the Sauti Community. Be respectful and kind.</div>
							)}
						</div>

						{/* Main area */}
						<div className="flex-1 flex flex-col">
							{/* Mobile tabs */}
							<div className="md:hidden p-2 bg-white border-b flex gap-2 sticky top-0 z-10">
								<Button size="sm" variant={activeTab === "community" ? "default" : "outline"} onClick={() => setActiveTab("community")}>Community</Button>
								<Button size="sm" variant={activeTab === "dm" ? "default" : "outline"} onClick={() => setActiveTab("dm")}>Messages</Button>
							</div>

							{activeTab === "community" ? (
								<div className="w-full">
									<Channel channel={communityChannelRef.current}>
										<Window>
											<div className="flex items-center p-2 bg-white border-b border-gray-200">
												<ChannelHeader />
											</div>
											<MessageList />
											<MessageInput />
										</Window>
										<Thread />
									</Channel>
								</div>
							) : showUserList ? (
								<div className="w-full md:hidden bg-white">
									<UserList users={users} onUserSelect={startDirectMessage} />
								</div>
							) : (
								<div className="w-full">
									<Channel channel={channel}>
										<Window>
											<div className="flex items-center p-2 bg-white border-b border-gray-200">
												<button
													onClick={handleBackToUsers}
													className="md:hidden p-2 hover:bg-gray-100 rounded-full mr-2"
												>
													←
												</button>
												<ChannelHeader />
											</div>
											<MessageList />
											<MessageInput />
										</Window>
										<Thread />
									</Channel>
								</div>
							)}
						</div>
					</div>
				</StreamChat>
			)}
		</div>
	);
}
