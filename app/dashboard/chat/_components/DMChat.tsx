"use client";

import { useEffect, useState, useRef } from "react";
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
import { Button } from "@/components/ui/button";
import { CalendarDays, Images, LinkIcon } from "lucide-react";
import { createClient as createSbClient } from "@/utils/supabase/client";

export function DMChat({ userId, username, channelId }: { userId: string; username: string; channelId: string }) {
  const [client, setClient] = useState<StreamChatClient | null>(null);
  const [channel, setChannel] = useState<any>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [showSchedule, setShowSchedule] = useState(false);
  const [mediaCounts, setMediaCounts] = useState<{ attachments: number; links: number }>({ attachments: 0, links: 0 });

  // Hide mobile bottom nav while in a DM
  useEffect(() => {
    try { window.dispatchEvent(new CustomEvent('ss:chat-active', { detail: { active: true } })); } catch {}
    return () => { try { window.dispatchEvent(new CustomEvent('ss:chat-active', { detail: { active: false } })); } catch {} };
  }, []);

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
      console.debug('DMChat.collectMedia: unable to compute media counts', e);
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
      console.debug('DMChat.collectLinks: unable to compute link counts', e);
    }
  };

  useEffect(() => {
    const init = async () => {
      try {
        if (client) return;
        // Support anonymous mode via query params
        let qs = "";
        if (typeof window !== "undefined") {
          try {
            const anon = window.localStorage.getItem("ss_anon_mode");
            const anonId = window.localStorage.getItem("ss_anon_id");
            if (anon === "1" && anonId) qs = `?anon=1&anonId=${encodeURIComponent(anonId)}`;
          } catch (e) {
            console.debug('DMChat: unable to read anonymous mode from localStorage', e);
          }
        }
        const response = await fetch(`/api/stream/token${qs}`);
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch token");
        }
        const data = await response.json();
        const streamClient = new StreamChatClient(process.env.NEXT_PUBLIC_STREAM_KEY!, { timeout: 6000 });
        let effectiveId = userId, effectiveName = username;
        if (typeof window !== "undefined") {
          try {
            if (window.localStorage.getItem("ss_anon_mode") === "1") {
              effectiveName = "Anonymous";
              effectiveId = window.localStorage.getItem("ss_anon_id") || effectiveId;
            }
          } catch (e) {
            console.debug('DMChat: failed to read anon identity', e);
          }
        }
        await streamClient.connectUser({ id: effectiveId, name: effectiveName, image: effectiveName === "Anonymous" ? "/anon.svg" : undefined }, data.token);
        const ch = streamClient.channel("messaging", channelId, {});
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
  }, [userId, username, channelId, client]);

  if (!client || !channel) {
    return <div className="flex items-center justify-center min-h-screen">Loading conversation...</div>;
  }

  return (
    <div className="flex h-screen w-full">
      <StreamChat client={client}>
        <div className={`flex h-full w-full ${styles.chatBackground}`}>
          <div className="flex-1 flex flex-col min-w-0">
            <Channel channel={channel}>
              <Window>
                <div className="flex items-center justify-between p-2 bg-white/90 backdrop-blur border-b border-gray-200">
                  <ChannelHeader />
                  <div className="flex items-center gap-2">
                    <Button size="sm" variant="outline" className="hidden sm:inline-flex" onClick={() => collectMedia(channel)}>
                      <Images className="h-4 w-4 mr-1" /> Media {mediaCounts.attachments ? `(${mediaCounts.attachments})` : ''}
                    </Button>
                    <Button size="sm" variant="outline" className="hidden sm:inline-flex" onClick={() => collectLinks(channel)}>
                      <LinkIcon className="h-4 w-4 mr-1" /> Links {mediaCounts.links ? `(${mediaCounts.links})` : ''}
                    </Button>
                  </div>
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

