"use client";

import { StreamChat as StreamChatClient, ChannelFilters, ChannelSort } from "stream-chat";

export type PreloadedUser = { id: string; username: string };
export type PreloadedChat = {
  client: StreamChatClient;
  userId: string;
  username: string;
  dmChannels: any[];
  users: PreloadedUser[];
  communityChannel: any | null;
};

let cached: PreloadedChat | null = null;
let inflight: Promise<PreloadedChat> | null = null;

async function connectClient(userId: string, username: string): Promise<StreamChatClient> {
  // Determine anonymous mode from localStorage
  let effectiveId = userId;
  let effectiveName = username;
  let qs = "";
  if (typeof window !== "undefined") {
    try {
      const anon = window.localStorage.getItem("ss_anon_mode");
      const anonId = window.localStorage.getItem("ss_anon_id");
      if (anon === "1" && anonId) {
        effectiveId = anonId;
        effectiveName = "Anonymous";
        qs = `?anon=1&anonId=${encodeURIComponent(anonId)}`;
      }
    } catch {}
  }

  const response = await fetch(`/api/stream/token${qs}`);
  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.error || "Failed to fetch token");
  }
  const data = await response.json();
  if (!data.token) throw new Error("No token received");
  const streamClient = new StreamChatClient(process.env.NEXT_PUBLIC_STREAM_KEY!, { timeout: 6000 });
  await streamClient.connectUser({ id: effectiveId, name: effectiveName }, data.token);
  return streamClient;
}

export async function preloadChat(userId: string, username: string): Promise<PreloadedChat> {
  // Account for anonymous cache key
  let cacheKey = userId;
  if (typeof window !== "undefined") {
    try {
      const anon = window.localStorage.getItem("ss_anon_mode");
      const anonId = window.localStorage.getItem("ss_anon_id");
      if (anon === "1" && anonId) cacheKey = anonId;
    } catch {}
  }

  if (cached && cached.userId === cacheKey) return cached;
  if (inflight) return inflight;

  inflight = (async () => {
    const client = await connectClient(userId, username);

    // DM channels
    let dmChannels: any[] = [];
    try {
      const filters: ChannelFilters = { type: "messaging", members: { $in: [userId] } } as any;
      const sort: ChannelSort = { last_message_at: -1 } as any;
      dmChannels = await client.queryChannels(filters, sort, { watch: true, state: true, presence: true, limit: 100 } as any);
    } catch (e) {
      console.warn("Failed to preload DM channels", e);
    }

    // Community channel
    let communityChannel: any | null = null;
    try {
      const community = client.channel("livestream", "community-global", { name: "Sauti Community" });
      try { await community.create(); } catch {}
      await community.watch();
      communityChannel = community;
    } catch (e) {
      console.warn("Failed to preload community channel", e);
    }

    // Users (paged by 100)
    const pageSize = 100;
    let offset = 0;
    let allUsers: any[] = [];
    while (true) {
      const { users } = await client.queryUsers(
        { id: { $ne: userId } },
        { last_active: -1 },
        { limit: pageSize, offset, presence: true } as any
      );
      if (!users || users.length === 0) break;
      allUsers = allUsers.concat(users);
      if (users.length < pageSize) break;
      offset += pageSize;
    }
    const mappedUsers: PreloadedUser[] = allUsers.map((u) => ({ id: u.id, username: (u as any).name || u.id }));

    // Use effective id/name for cached values
    let effectiveId = userId;
    let effectiveName = username;
    if (typeof window !== "undefined") {
      try {
        const anon = window.localStorage.getItem("ss_anon_mode");
        const anonId = window.localStorage.getItem("ss_anon_id");
        if (anon === "1" && anonId) {
          effectiveId = anonId;
          effectiveName = "Anonymous";
        }
      } catch {}
    }

    cached = { client, userId: effectiveId, username: effectiveName, dmChannels, users: mappedUsers, communityChannel };
    inflight = null;
    return cached;
  })();

  return inflight;
}

export function getPreloadedChat(userId?: string): PreloadedChat | null {
  if (!cached) return null;
  if (userId && cached.userId !== userId) return null;
  return cached;
}

export async function disconnectPreloadedChat() {
  try {
    if (cached?.client) await cached.client.disconnectUser();
  } catch {}
  cached = null;
  inflight = null;
}

