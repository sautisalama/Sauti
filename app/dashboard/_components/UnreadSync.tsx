"use client";

import { useEffect } from "react";
import { getPreloadedChat, preloadChat } from "@/utils/chat/preload";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";

export function UnreadSync({ userId, username }: { userId: string; username: string }) {
  const dash = useDashboardData();
  const setUnread = dash?.setUnreadChatCount;

  useEffect(() => {
    if (!userId || !setUnread) return;
    let cleanup: (() => void) | undefined;
    const init = async () => {
      try {
        let pre = getPreloadedChat(userId);
        if (!pre) {
          pre = await preloadChat(userId, username);
        }
        const compute = () => {
          try {
            const total = (pre?.dmChannels || []).reduce((sum: number, ch: any) => {
              const n = typeof ch.countUnread === "function" ? ch.countUnread() : 0;
              return sum + (Number.isFinite(n) ? n : 0);
            }, 0);
            setUnread(total);
          } catch {
            setUnread(0);
          }
        };
        compute();
        const client = pre?.client as any;
        if (client && typeof client.on === "function") {
          const handler = () => compute();
          client.on("notification.message_new", handler);
          client.on("message.new", handler);
          client.on("notification.mark_read", handler);
          client.on("notification.channel_marked_read", handler);
          client.on("notification.added_to_channel", handler);
          cleanup = () => {
            try {
              client.off("notification.message_new", handler);
              client.off("message.new", handler);
              client.off("notification.mark_read", handler);
              client.off("notification.channel_marked_read", handler);
              client.off("notification.added_to_channel", handler);
            } catch {}
          };
        }
      } catch {
        setUnread(0);
      }
    };
    init();
    return () => {
      if (cleanup) cleanup();
    };
  }, [userId, username, setUnread]);

  return null;
}
