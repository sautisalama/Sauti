"use client";

import { useEffect, useState } from "react";
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
import "stream-chat-react/dist/css/v2/index.css";
import styles from "./chat.module.css";

export function CommunityChat({ userId, username }: { userId: string; username: string }) {
  const [client, setClient] = useState<StreamChatClient | null>(null);
  const [channel, setChannel] = useState<any>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        if (client) return;
        const response = await fetch("/api/stream/token");
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch token");
        }
        const data = await response.json();
        const streamClient = new StreamChatClient(process.env.NEXT_PUBLIC_STREAM_KEY!, { timeout: 6000 });
        await streamClient.connectUser({ id: userId, name: username }, data.token);
        const ch = streamClient.channel("livestream", "community-global", { name: "Sauti Community" });
        await ch.create();
        await ch.watch();
        setClient(streamClient);
        setChannel(ch);
      } catch (e) {
        console.error(e);
        setConnectionError(e instanceof Error ? e.message : "Unable to connect to chat");
      }
    };
    init();
    return () => {
      const cleanup = async () => {
        if (client) await client.disconnectUser();
      };
      cleanup();
    };
  }, [userId, username, client]);

  if (!client || !channel) {
    return <div className="flex items-center justify-center min-h-screen">Loading community...</div>;
  }

  return (
    <div className="flex h-[calc(100vh-0px)] w-full">
      <StreamChat client={client}>
        <div className={`flex h-full w-full ${styles.chatBackground}`}>
          <div className="flex-1 flex flex-col min-w-0">
            <Channel channel={channel}>
              <Window>
                <div className="flex items-center justify-between p-2 bg-white/90 backdrop-blur border-b border-gray-200">
                  <ChannelHeader />
                </div>
                <MessageList />
                <MessageInput />
              </Window>
              <Thread />
            </Channel>
          </div>
        </div>
      </StreamChat>
    </div>
  );
}

