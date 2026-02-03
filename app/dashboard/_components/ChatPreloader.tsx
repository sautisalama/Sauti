"use client";

import { useEffect, useRef, useState } from "react";
import { preloadChat, getPreloadedChat } from "@/utils/chat/preload";

export function ChatPreloader({ userId, username }: { userId: string; username: string }) {
  const [isPreloading, setIsPreloading] = useState(false);
  const [isPreloaded, setIsPreloaded] = useState(false);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const retryCountRef = useRef(0);
  const maxRetries = 3;

  useEffect(() => {
    let mounted = true;

    const preloadWithRetry = async () => {
      // Check if already preloaded for this user
      const existing = getPreloadedChat(userId);
      if (existing && existing.userId === userId) {
        setIsPreloaded(true);
        return;
      }

      setIsPreloading(true);
      
      try {
        await preloadChat(userId, username);
        if (mounted) {
          setIsPreloaded(true);
          setIsPreloading(false);
          retryCountRef.current = 0;
        }
      } catch (error) {
        console.warn('Chat preload failed:', error);
        if (mounted && retryCountRef.current < maxRetries) {
          retryCountRef.current++;
          const retryDelay = Math.min(1000 * Math.pow(2, retryCountRef.current), 10000);
          
          retryTimeoutRef.current = setTimeout(() => {
            if (mounted) {
              preloadWithRetry();
            }
          }, retryDelay);
        } else {
          setIsPreloading(false);
        }
      }
    };

    // Start preloading immediately
    preloadWithRetry();

    return () => {
      mounted = false;
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
    };
  }, [userId, username]);

  // Optional: render a small indicator during preloading (for debugging)
  if (process.env.NODE_ENV === 'development') {
    return (
      <div className="fixed bottom-2 left-2 z-50">
        {isPreloading && (
          <div className="bg-blue-500 text-white px-2 py-1 rounded text-xs opacity-75">
            Preloading chat... {retryCountRef.current > 0 && `(retry ${retryCountRef.current})`}
          </div>
        )}
        {isPreloaded && (
          <div className="bg-green-500 text-white px-2 py-1 rounded text-xs opacity-75">
            Chat ready ✓
          </div>
        )}
      </div>
    );
  }

  return null;
}

