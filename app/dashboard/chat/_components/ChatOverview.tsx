"use client";

import { useEffect, useRef, useState } from "react";
import {
  Chat as StreamChat,
  Channel,
  ChannelHeader,
  MessageList,
  Window,
} from "stream-chat-react";
import { StreamChat as StreamChatClient, ChannelFilters, ChannelSort } from "stream-chat";
import { UserList } from "./UserList";
import "stream-chat-react/dist/css/v2/index.css";
import Animation from "@/components/LottieWrapper";
import animationData from "@/public/lottie-animations/messages.json";
import styles from "./chat.module.css";
import { Button } from "@/components/ui/button";
import { Images, LinkIcon } from "lucide-react";
import { useRouter } from "next/navigation";

interface User {
  id: string;
  username: string;
}

export function ChatOverview({
  userId,
  username,
}: { userId: string; username: string }) {
  const [client, setClient] = useState<StreamChatClient | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"community" | "dm" | "contacts">("community");
  const communityChannelRef = useRef<any>(null);
  const [dmChannels, setDmChannels] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const router = useRouter();

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

        // Load DM channels list for left rail
        try {
          const filters: ChannelFilters = { type: "messaging", members: { $in: [userId] } } as any;
          const sort: ChannelSort = { last_message_at: -1 } as any;
          const channels = await streamClient.queryChannels(filters, sort, { watch: true, state: true, presence: true, limit: 100 } as any);
          setDmChannels(channels);
        } catch (e) {
          console.warn("Failed to load DM channels", e);
        }

        // Prepare or join community channel (public)
        try {
          const community = streamClient.channel("livestream", "community-global", {
            name: "Sauti Community",
          });
          await community.create();
          await community.watch();
          communityChannelRef.current = community;
        } catch (err) {
          const community = streamClient.channel("livestream", "community-global", {
            name: "Sauti Community",
          });
          await community.watch();
          communityChannelRef.current = community;
        }

        // Fetch users in pages of 100 (Stream limit)
        const pageSize = 100;
        let offset = 0;
        let allUsers: any[] = [];
        let hasMore = true;
        while (hasMore) {
          const { users: page } = await streamClient.queryUsers(
            { id: { $ne: userId } },
            { last_active: -1 },
            { limit: pageSize, offset, presence: true } as any
          );
          if (!page || page.length === 0) { hasMore = false; break; }
          allUsers = allUsers.concat(page);
          if (page.length < pageSize) { hasMore = false; break; }
          offset += pageSize;
        }
        setUsers(
          allUsers.map((user) => ({
            id: user.id,
            username: (user as any).name || user.id,
          }))
        );
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

    // Cleanup
    return () => {
      const cleanup = async () => {
        if (client) {
          await client.disconnectUser();
        }
      };
      cleanup();
    };
  }, [userId, username, client]);

  const openDM = async (otherUserId: string) => {
    // Build deterministic channel id
    const channelId = [userId.slice(0, 12), otherUserId.slice(0, 12)]
      .sort()
      .join("-");
    router.push(`/dashboard/chat/c/${channelId}`);
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
    <div className="flex h-[calc(100vh-0px)] w-full">
      <StreamChat client={client}>
        <div className={`flex h-full w-full ${styles.chatBackground}`}>
          {/* Left rail (desktop) */}
          <div className="hidden md:flex flex-col w-96 border-r border-gray-200 bg-white overflow-hidden">
            <div className="p-3 border-b">
              <div className="flex gap-2">
                <Button size="sm" variant={activeTab === "community" ? "default" : "outline"} onClick={() => setActiveTab("community")}>Community</Button>
                <Button size="sm" variant={activeTab === "dm" ? "default" : "outline"} onClick={() => setActiveTab("dm")}>Messages</Button>
                <Button size="sm" variant={activeTab === "contacts" ? "default" : "outline"} onClick={() => setActiveTab("contacts")}>Contacts</Button>
              </div>
            </div>
            {activeTab === "dm" ? (
              <div className="flex-1 overflow-y-auto">
                {dmChannels.map((ch: any) => {
                  const members: any[] = Object.values(ch.state.members || {});
                  const other = (members.find((m: any) => (m?.user?.id && m.user.id !== userId)) as any)?.user;
                  const last = ch.state?.messages?.slice().reverse().find((m: any) => !m.deleted_at);
                  return (
                    <button key={ch.id} className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b" onClick={() => router.push(`/dashboard/chat/c/${ch.id}`)}>
                      <div className="flex items-start gap-2">
                        <div className="relative mt-1">
                          <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm">
                            {(other?.name || other?.id || "?").toString().charAt(0).toUpperCase()}
                          </div>
                          <span className={`absolute -right-0 -bottom-0 w-2.5 h-2.5 rounded-full ${other?.online ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between">
                            <div className="font-medium truncate">{other?.name || other?.id}</div>
                            <div className="text-[11px] text-muted-foreground">{last?.created_at ? new Date(last.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : ''}</div>
                          </div>
                          <div className="text-xs text-muted-foreground truncate">{last?.text || (last?.attachments?.length ? `${last.attachments.length} attachment(s)` : 'No messages yet')}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : activeTab === "contacts" ? (
              <div className="flex-1 overflow-y-auto">
                {users.map((u) => (
                  <button key={u.id} className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b" onClick={() => openDM(u.id)}>
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
              <div className="p-0 flex-1 flex flex-col min-h-0">
                {/* Community preview: header + recent messages, no input; button to open full chat */}
                <Channel channel={communityChannelRef.current}>
                  <Window>
                    <div className="flex items-center justify-between p-2 bg-white/90 backdrop-blur border-b border-gray-200">
                      <ChannelHeader />
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => router.push("/dashboard/chat/community")}>Open</Button>
                      </div>
                    </div>
                    <MessageList />
                    {/* No MessageInput here to avoid overlap with BottomNav */}
                  </Window>
                </Channel>
              </div>
            )}
          </div>

          {/* Main area (mobile focus only provides tabs + lists/previews) */}
          <div className="flex-1 flex flex-col min-w-0">
            <div className="md:hidden p-2 bg-white border-b flex gap-2 sticky top-0 z-10">
              <Button size="sm" variant={activeTab === "community" ? "default" : "outline"} onClick={() => setActiveTab("community")}>Community</Button>
              <Button size="sm" variant={activeTab === "dm" ? "default" : "outline"} onClick={() => setActiveTab("dm")}>Messages</Button>
              <Button size="sm" variant={activeTab === "contacts" ? "default" : "outline"} onClick={() => setActiveTab("contacts")}>Contacts</Button>
            </div>

            {activeTab === "community" ? (
              <div className="w-full h-full flex flex-col min-h-0">
                <Channel channel={communityChannelRef.current}>
                  <Window>
                    <div className="flex items-center justify-between p-2 bg-white/90 backdrop-blur border-b border-gray-200">
                      <ChannelHeader />
                      <Button size="sm" variant="outline" onClick={() => router.push("/dashboard/chat/community")}>Open</Button>
                    </div>
                    <MessageList />
                    {/* No MessageInput here */}
                  </Window>
                </Channel>
              </div>
            ) : (
              <div className="w-full md:hidden bg-white pb-20">
                {/* On mobile, show combined list based on tab */}
                {activeTab === "dm" ? (
                  dmChannels.length ? (
                    <div>
                      {dmChannels.map((ch: any) => {
                        const members: any[] = Object.values(ch.state.members || {});
                        const other = (members.find((m: any) => (m?.user?.id && m.user.id !== userId)) as any)?.user;
                        const last = ch.state?.messages?.slice().reverse().find((m: any) => !m.deleted_at);
                        return (
                          <button key={ch.id} className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b" onClick={() => router.push(`/dashboard/chat/c/${ch.id}`)}>
                            <div className="flex items-start gap-2">
                              <div className="relative mt-1">
                                <div className="w-9 h-9 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm">
                                  {(other?.name || other?.id || "?").toString().charAt(0).toUpperCase()}
                                </div>
                                <span className={`absolute -right-0 -bottom-0 w-2.5 h-2.5 rounded-full ${other?.online ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <div className="font-medium truncate">{other?.name || other?.id}</div>
                                  <div className="text-[11px] text-muted-foreground">{last?.created_at ? new Date(last.created_at).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : ''}</div>
                                </div>
                                <div className="text-xs text-muted-foreground truncate">{last?.text || (last?.attachments?.length ? `${last.attachments.length} attachment(s)` : 'No messages yet')}</div>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="p-4 text-center text-gray-500">No messages yet</div>
                  )
                ) : (
                  <UserList users={users} onUserSelect={openDM} />
                )}
              </div>
            )}
          </div>
        </div>
      </StreamChat>
    </div>
  );
}

