"use client";

// Stub implementation to fix build error.
// The original implementation relied on 'stream-chat' which is currently not in package.json.
// This file provides the necessary exports to prevent build failures, but the chat functionality
// will naturally be disabled until the library is re-added and implemented.

export const preloadChat = async (userId: string, username: string) => {
  console.warn("preloadChat called but stream-chat is missing");
  return {} as any;
};

export const getPreloadedChat = (userId: string, forceAnonymous?: boolean) => {
  return {} as any;
};

export const isChatReady = (userId: string, isAnonymous: boolean) => {
  return false;
};

export const warmupBothModes = (userId: string, username: string) => {
  console.warn("warmupBothModes called but stream-chat is missing");
};

export const getCurrentAnonymousId = () => {
    if (typeof window !== "undefined") {
        return window.localStorage.getItem("ss_anon_id");
    }
    return null;
};
