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
import { StreamChat as StreamChatClient, ChannelFilters, ChannelSort } from "stream-chat";
import { UserList } from "./UserList";
import "stream-chat-react/dist/css/v2/index.css";
import Animation from "@/components/LottieWrapper";
import animationData from "@/public/lottie-animations/messages.json";
import styles from "./chat.module.css";
import { Button } from "@/components/ui/button";
import { AppointmentScheduler } from "@/app/dashboard/_components/AppointmentScheduler";
import { createClient as createSbClient } from "@/utils/supabase/client";
import { CalendarDays, LinkIcon, Images, Search, Plus } from "lucide-react";
import { getPreloadedChat, preloadChat } from "@/utils/chat/preload";

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
	const communityChannelRef = useRef<any>(null);
	const [dmChannels, setDmChannels] = useState<any[]>([]);
	const [showSchedule, setShowSchedule] = useState(false);
	const [appointments, setAppointments] = useState<any[]>([]);
	const [mediaCounts, setMediaCounts] = useState<{attachments:number; links:number}>({attachments:0, links:0});
	const [search, setSearch] = useState("");
	const [showNewChat, setShowNewChat] = useState(false);

	// Helpers: count media and links in current channel messages
	const collectMedia = (ch: any) => {
		try {
			const msgs: any[] = ch?.state?.messages || [];
			let attachments = 0;
			let links = 0;
			msgs.forEach((m) => {
				if (Array.isArray(m.attachments) && m.attachments.length) attachments += m.attachments.length;
				if (typeof m.text === "string") {
					const found = (m.text.match(/https?:\/\//g) || []).length;
					links += found;
				}
			});
			setMediaCounts({ attachments, links });
			} catch (e) {
				console.debug('collectMedia: unable to compute media counts', e);
			}
	};
	const collectLinks = (ch: any) => {
		try {
			const msgs: any[] = ch?.state?.messages || [];
			let links = 0;
			msgs.forEach((m) => {
				if (typeof m.text === "string") {
					const found = (m.text.match(/https?:\/\//g) || []).length;
					links += found;
				}
			});
			setMediaCounts((prev) => ({ attachments: prev.attachments, links }));
			} catch (e) {
				console.debug('collectLinks: unable to compute link counts', e);
			}
	};

	useEffect(() => {
		const initChat = async () => {
			try {
				// Always prefer preloaded chat first for instant loading
				const pre = getPreloadedChat(userId);
				if (pre && !client) {
					console.log(`Using preloaded ${pre.isAnonymous ? 'anonymous' : 'regular'} chat data - instant load!`);
					setClient(pre.client);
					setConnectionError(null);
					setDmChannels(pre.dmChannels || []);
					communityChannelRef.current = pre.communityChannel;
					setUsers(pre.users || []);
					return; // Exit early for instant load
				} else if (client) {
					// Check if current client matches current anonymous mode
					const currentAnonymous = typeof window !== "undefined" && window.localStorage.getItem("ss_anon_mode") === "1";
					if (pre && pre.isAnonymous !== currentAnonymous) {
						console.log(`Mode changed to ${currentAnonymous ? 'anonymous' : 'regular'}, switching client...`);
						setClient(null); // Reset to trigger reload with correct mode
						return;
					}
					return; // Client already exists and mode matches
				}

				// Fallback: Load chat data if not preloaded (should rarely happen)
				console.log('Preloaded data not available, loading chat...');
				const loaded = await preloadChat(userId, username);
				setClient(loaded.client);
				setConnectionError(null);
				setDmChannels(loaded.dmChannels || []);
				communityChannelRef.current = loaded.communityChannel;
				setUsers(loaded.users || []);

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
						const newChannel = (pre || (await preloadChat(userId, username))).client.channel("messaging", channelId, {
							members: [userId, otherUserId],
							appointment_id: appointmentId,
						});

						await newChannel.create();
						setChannel(newChannel);
					}
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

		// Listen for anonymous mode changes
		const handleAnonymousModeChange = () => {
			console.log('Anonymous mode changed, refreshing chat...');
			setClient(null); // This will trigger a reload with the new mode
			setChannel(null);
			setDmChannels([]);
			setUsers([]);
			communityChannelRef.current = null;
		};

		window.addEventListener('anonymousModeChanged', handleAnonymousModeChange);

		// Cleanup function: do not disconnect the shared preloaded client here
		return () => {
			setChannel(null);
			window.removeEventListener('anonymousModeChanged', handleAnonymousModeChange);
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
		setShowNewChat(false);
		setChannel(null);
	};

	if (!client) {
		// Check if we have preloaded data for faster perceived loading
		const hasPreloadedData = getPreloadedChat(userId);
		
		return (
			<div className="flex flex-col items-center justify-center min-h-screen p-4">
				<div className="text-center space-y-4">
					<Animation animationData={animationData} />
					<p className="text-muted-foreground">
						{hasPreloadedData ? 'Initializing chat...' : 'Loading chat...'}
					</p>
					{hasPreloadedData && (
						<div className="w-32 bg-gray-200 rounded-full h-1.5">
							<div className="bg-teal-600 h-1.5 rounded-full transition-all duration-300 w-4/5"></div>
						</div>
					)}
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-[calc(100vh-0px)] w-full">
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
					<div className="hidden md:flex flex-col w-[380px] border-r border-gray-200 bg-white overflow-hidden">
						{/* Header with title, search, new chat */}
						<div className="p-3 border-b bg-white/90 backdrop-blur">
							<div className="flex items-center justify-between">
								{showNewChat ? (
									<>
										<button onClick={() => setShowNewChat(false)} className="p-2 rounded-full hover:bg-gray-100 -ml-2">←</button>
										<h2 className="text-lg font-semibold">New chat</h2>
										<div />
									</>
								) : (
									<>
										<h2 className="text-lg font-semibold">Chats</h2>
										<Button size="sm" variant="outline" onClick={() => { setShowUserList(true); setShowNewChat(true); }}> <Plus className="h-4 w-4 mr-1"/> New</Button>
									</>
								)}
							</div>
							<div className="mt-2">
								<div className="flex items-center gap-2 border rounded px-2 py-1.5">
									<Search className="h-4 w-4 text-gray-500" />
									<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={showNewChat ? "Search contacts" : "Search"} className="w-full outline-none text-sm bg-transparent" />
								</div>
							</div>
						</div>

						{/* List area: contacts picker or unified chats */}
						<div className="flex-1 overflow-y-auto">
							{showNewChat ? (
								<div>
									{users
										.filter((u) => u.username.toLowerCase().includes(search.toLowerCase()))
										.map((u) => (
											<button key={u.id} className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b" onClick={async () => { await startDirectMessage(u.id); setShowNewChat(false); }}>
												<div className="flex items-start gap-2">
													<div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm mt-1">
														{u.username.charAt(0).toUpperCase()}
													</div>
													<div className="flex-1 min-w-0">
														<div className="font-medium truncate">{u.username}</div>
														<div className="text-xs text-muted-foreground truncate">Tap to start a conversation</div>
													</div>
												</div>
											</button>
										))}
								</div>
							) : (
								<div className="">
									{([...(communityChannelRef.current ? [communityChannelRef.current] : []), ...dmChannels] as any[])
										.filter((ch: any) => {
											let label = "";
											if (ch?.type === "livestream") label = "Sauti Community";
											else {
												const members: any[] = Object.values(ch?.state?.members || {});
												const other = (members.find((m: any) => (m?.user?.id && m.user.id !== userId)) as any)?.user;
												label = other?.name || other?.id || "Unknown";
											}
											return label.toLowerCase().includes(search.toLowerCase());
										})
										.map((ch: any) => {
											const isCommunity = ch?.type === "livestream";
											const members: any[] = Object.values(ch?.state?.members || {});
											const other = isCommunity ? null : (members.find((m: any) => (m?.user?.id && m.user.id !== userId)) as any)?.user;
											const last = ch?.state?.messages?.slice().reverse().find((m: any) => !m.deleted_at);
											const label = isCommunity ? "Sauti Community" : (other?.name || other?.id || "Unknown");
											const unread = (ch as any).countUnread ? (ch as any).countUnread() : 0;
											return (
												<button key={ch.id || (isCommunity ? "community-global" : Math.random())} className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b" onClick={() => { setChannel(ch); setShowUserList(false); setShowNewChat(false); }}>
													<div className="flex items-start gap-2">
														<div className="relative mt-1">
															<div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm">
																{isCommunity ? 'C' : (label.toString().charAt(0).toUpperCase())}
															</div>
															{!isCommunity && <span className={`absolute -right-0 -bottom-0 w-2.5 h-2.5 rounded-full ${other?.online ? 'bg-green-500' : 'bg-gray-300'}`}></span>}
														</div>
														<div className="flex-1 min-w-0">
															<div className="flex items-center justify-between">
																<div className="font-medium truncate">{label}</div>
																<div className="text-[11px] text-muted-foreground">{last?.created_at ? new Date(last.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : ''}</div>
															</div>
															<div className="text-xs text-muted-foreground truncate">{last?.text || (last?.attachments?.length ? `${last.attachments.length} attachment(s)` : 'No messages yet')}</div>
														</div>
														{unread > 0 && <div className="ml-2 mt-1"><span className="inline-flex items-center justify-center min-w-5 h-5 text-[10px] rounded-full bg-green-600 text-white px-1">{unread}</span></div>}
													</div>
												</button>
											);
										})}
								</div>
							)}
						</div>
					</div>

					{/* Main area */}
					<div className="flex-1 flex flex-col min-w-0">
						{/* Mobile header and list (WhatsApp style) */}
						{showUserList ? (
							<div className="md:hidden flex-1 flex flex-col">
								<div className="p-3 border-b bg-white/90 backdrop-blur flex items-center justify-between sticky top-0 z-10">
									<h2 className="text-lg font-semibold">Chats</h2>
									<Button size="sm" variant="outline" onClick={() => { setShowNewChat(true); }}> <Plus className="h-4 w-4"/> </Button>
								</div>
								{showNewChat ? (
									<div className="flex-1 bg-white pb-20">
										<div className="p-2 border-b flex items-center gap-2">
											<button onClick={() => setShowNewChat(false)} className="p-2 rounded-full hover:bg-gray-100">←</button>
											<div className="flex-1 flex items-center gap-2 border rounded px-2 py-1.5">
												<Search className="h-4 w-4 text-gray-500" />
												<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search contacts" className="w-full outline-none text-sm bg-transparent" />
											</div>
										</div>
										<UserList users={users.filter(u => u.username.toLowerCase().includes(search.toLowerCase()))} onUserSelect={async (id) => { await startDirectMessage(id); setShowUserList(false); setShowNewChat(false); }} />
									</div>
								) : (
									<div className="flex-1 overflow-y-auto bg-white pb-20">
										<div className="p-2">
											<div className="flex items-center gap-2 border rounded px-2 py-1.5">
												<Search className="h-4 w-4 text-gray-500" />
												<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search" className="w-full outline-none text-sm bg-transparent" />
											</div>
										</div>
										{([...(communityChannelRef.current ? [communityChannelRef.current] : []), ...dmChannels] as any[])
											.filter((ch: any) => {
												let label = "";
												if (ch?.type === "livestream") label = "Sauti Community";
												else {
													const members: any[] = Object.values(ch?.state?.members || {});
													const other = (members.find((m: any) => (m?.user?.id && m.user.id !== userId)) as any)?.user;
													label = other?.name || other?.id || "Unknown";
												}
												return label.toLowerCase().includes(search.toLowerCase());
											})
											.map((ch: any) => {
												const isCommunity = ch?.type === "livestream";
												const members: any[] = Object.values(ch?.state?.members || {});
												const other = isCommunity ? null : (members.find((m: any) => (m?.user?.id && m.user.id !== userId)) as any)?.user;
												const last = ch?.state?.messages?.slice().reverse().find((m: any) => !m.deleted_at);
												const label = isCommunity ? "Sauti Community" : (other?.name || other?.id || "Unknown");
												const unread = (ch as any).countUnread ? (ch as any).countUnread() : 0;
												return (
													<button key={ch.id || (isCommunity ? "community-global" : Math.random())} className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b" onClick={() => { setChannel(ch); setShowUserList(false); }}>
														<div className="flex items-start gap-2">
															<div className="relative mt-1">
																<div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm">
																	{isCommunity ? 'C' : (label.toString().charAt(0).toUpperCase())}
																</div>
																{!isCommunity && <span className={`absolute -right-0 -bottom-0 w-2.5 h-2.5 rounded-full ${other?.online ? 'bg-green-500' : 'bg-gray-300'}`}></span>}
															</div>
															<div className="flex-1 min-w-0">
																<div className="flex items-center justify-between">
																	<div className="font-medium truncate">{label}</div>
																	<div className="text-[11px] text-muted-foreground">{last?.created_at ? new Date(last.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : ''}</div>
																</div>
																<div className="text-xs text-muted-foreground truncate">{last?.text || (last?.attachments?.length ? `${last.attachments.length} attachment(s)` : 'No messages yet')}</div>
															</div>
															{unread > 0 && <div className="ml-2 mt-1"><span className="inline-flex items-center justify-center min-w-5 h-5 text-[10px] rounded-full bg-green-600 text-white px-1">{unread}</span></div>}
														</div>
													</button>
												);
											})}
									</div>
								)}
						</div>
					) : (
						<div className="w-full h-full flex flex-col min-h-0">
							<Channel channel={channel}>
								<Window>
									<div className="flex items-center justify-between p-2 bg-white/90 backdrop-blur border-b border-gray-200">
										<button
											onClick={handleBackToUsers}
											className="md:hidden p-2 hover:bg-gray-100 rounded-full mr-2"
										>
											←
										</button>
										<ChannelHeader />
										<div className="flex items-center gap-2">
											<Button size="sm" variant="outline" className="hidden sm:inline-flex" onClick={() => collectMedia(channel)}>
												<Images className="h-4 w-4 mr-1" /> Media {mediaCounts.attachments ? `(${mediaCounts.attachments})` : ''}
											</Button>
											<Button size="sm" variant="outline" className="hidden sm:inline-flex" onClick={() => collectLinks(channel)}>
												<LinkIcon className="h-4 w-4 mr-1" /> Links {mediaCounts.links ? `(${mediaCounts.links})` : ''}
											</Button>
											<Button size="sm" variant="outline" onClick={() => setShowSchedule(true)}>
												<CalendarDays className="h-4 w-4 mr-1" /> Schedule
											</Button>
										</div>
									</div>
									{channel?.id !== "community-global" && (
										<div className="flex items-center justify-end gap-2 px-2 py-1 bg-white border-b">
											{(() => {
												const members = channel?.state?.members ? Object.keys(channel.state.members) : [];
												const other = members.find((m) => m !== userId);
												return (
													<>
														<Button size="sm" variant="outline" onClick={async () => {
															try { await client?.flagUser(other!); } catch (e) { console.warn('flagUser failed', e); }
														}}>
															Report User
														</Button>
														<Button size="sm" variant="destructive" onClick={async () => {
															try { await client?.banUser(other!, { timeout: 60 * 24 }); } catch (e) { console.warn('banUser failed', e); }
														}}>
															Block 24h
														</Button>
													</>
												);
											})()}
										</div>
									)}
									<MessageList />
									<MessageInput />
								</Window>
								<Thread />
							</Channel>

							{/* Appointment Scheduler (DM) */}
							<AppointmentScheduler
								isOpen={showSchedule}
								onClose={() => setShowSchedule(false)}
								onSchedule={async (date) => {
									const members = Object.keys(channel?.state?.members || {});
									const otherId = members.find((m) => m !== userId);
									const sb = createSbClient();
									const { data: me } = await sb.from("profiles").select("id,user_type").eq("id", userId).single();
									const { data: other } = await sb.from("profiles").select("id,user_type").eq("id", otherId as string).single();
									if (!me || !other) return;
									const isPro = me.user_type === "professional" || me.user_type === "ngo";
									const appointment = {
										appointment_date: date.toISOString(),
										professional_id: isPro ? me.id : other.id,
										survivor_id: isPro ? (other.id as string) : me.id,
										status: "confirmed" as any,
									};
									await sb.from("appointments").insert([appointment]);
									setShowSchedule(false);
								}}
							/>
						</div>
					) }
					</div>
					</div>
				</StreamChat>
			)}
		</div>
	);
}
