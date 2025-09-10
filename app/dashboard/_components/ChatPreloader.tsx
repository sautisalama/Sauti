"use client";

import { useEffect } from "react";
import { preloadChat } from "@/utils/chat/preload";

export function ChatPreloader({ userId, username }: { userId: string; username: string }) {
  useEffect(() => {
    let mounted = true;
    preloadChat(userId, username).catch(() => {});
    return () => {
      mounted = false;
    };
  }, [userId, username]);
  return null;
}

