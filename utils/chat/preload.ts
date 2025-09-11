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
  isAnonymous: boolean;
};

export type DualChatCache = {
  regular: PreloadedChat | null;
  anonymous: PreloadedChat | null;
};

// Dual cache system - separate caches for regular and anonymous modes
let chatCache: DualChatCache = {
  regular: null,
  anonymous: null
};

let inflightConnections = {
  regular: null as Promise<PreloadedChat> | null,
  anonymous: null as Promise<PreloadedChat> | null
};

let connectionHealthy = {
  regular: true,
  anonymous: true
};

let lastConnectionCheck = {
  regular: 0,
  anonymous: 0
};

const CONNECTION_CHECK_INTERVAL = 30000; // 30 seconds

// Generate or retrieve anonymous ID for a user
function getAnonymousId(userId: string): string {
  if (typeof window !== "undefined") {
    try {
      let anonId = window.localStorage.getItem("ss_anon_id");
      if (!anonId) {
        // Generate stable anonymous ID for this user session
        const base = userId.slice(0, 12);
        const rand = Math.random().toString(36).slice(2, 8);
        anonId = `anon-${base}-${rand}`;
        window.localStorage.setItem("ss_anon_id", anonId);
      }
      return anonId;
    } catch {
      // Fallback for server-side or localStorage issues
      const base = userId.slice(0, 12);
      const rand = Math.random().toString(36).slice(2, 8);
      return `anon-${base}-${rand}`;
    }
  }
  // Server-side fallback
  const base = userId.slice(0, 12);
  const rand = Math.random().toString(36).slice(2, 8);
  return `anon-${base}-${rand}`;
}

async function connectClient(userId: string, username: string, forceAnonymous?: boolean): Promise<StreamChatClient> {
  // Determine if we should connect as anonymous
  const isAnonymous = forceAnonymous ?? (typeof window !== "undefined" && window.localStorage.getItem("ss_anon_mode") === "1");
  
  let effectiveId = userId;
  let effectiveName = username;
  let qs = "";
  
  if (isAnonymous) {
    effectiveId = getAnonymousId(userId);
    effectiveName = "Anonymous";
    qs = `?anon=1&anonId=${encodeURIComponent(effectiveId)}`;
  }

  let retries = 0;
  const maxRetries = 3;
  
  while (retries < maxRetries) {
    try {
      const response = await fetch(`/api/stream/token${qs}`, {
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (!response.ok) {
        if (response.status === 429) {
          // Rate limited, wait and retry
          const retryAfter = parseInt(response.headers.get('Retry-After') || '5', 10);
          await new Promise(resolve => setTimeout(resolve, retryAfter * 1000));
          retries++;
          continue;
        }
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}: Failed to fetch token`);
      }
      
      const data = await response.json();
      if (!data.token) throw new Error("No token received");
      
      const streamClient = new StreamChatClient(process.env.NEXT_PUBLIC_STREAM_KEY!, { 
        timeout: 10000
      });
      
      await streamClient.connectUser(
        { 
          id: effectiveId, 
          name: effectiveName, 
          image: effectiveName === "Anonymous" ? "/anon.svg" : undefined 
        }, 
        data.token
      );
      
      // Set up connection health monitoring for the appropriate cache
      const cacheType = isAnonymous ? 'anonymous' : 'regular';
      streamClient.on('connection.changed', (event) => {
        connectionHealthy[cacheType] = event.online ?? true;
        lastConnectionCheck[cacheType] = Date.now();
      });
      
      return streamClient;
    } catch (error) {
      retries++;
      if (retries >= maxRetries) {
        const cacheType = isAnonymous ? 'anonymous' : 'regular';
        connectionHealthy[cacheType] = false;
        throw error;
      }
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, retries), 5000)));
    }
  }
  
  throw new Error("Failed to connect after multiple retries");
}

function checkConnectionHealth(isAnonymous: boolean): boolean {
  const cacheType = isAnonymous ? 'anonymous' : 'regular';
  const now = Date.now();
  if (now - lastConnectionCheck[cacheType] > CONNECTION_CHECK_INTERVAL) {
    // Connection check is stale, assume healthy until proven otherwise
    return true;
  }
  return connectionHealthy[cacheType];
}

export async function preloadChat(userId: string, username: string, forceAnonymous?: boolean): Promise<PreloadedChat> {
  const isAnonymous = forceAnonymous ?? (typeof window !== "undefined" && window.localStorage.getItem("ss_anon_mode") === "1");
  const cacheType = isAnonymous ? 'anonymous' : 'regular';
  const cacheKey = isAnonymous ? getAnonymousId(userId) : userId;
  
  // Return cached if available and connection is healthy
  const existingCache = chatCache[cacheType];
  if (existingCache && existingCache.userId === cacheKey && checkConnectionHealth(isAnonymous)) {
    try {
      // Quick health check - try to query users with a timeout
      await Promise.race([
        existingCache.client.queryUsers({ id: cacheKey }, {}, { limit: 1 }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 2000))
      ]);
      return existingCache;
    } catch {
      // Client is unhealthy, clear cache and reconnect
      console.warn(`Cached ${cacheType} client unhealthy, reconnecting...`);
      chatCache[cacheType] = null;
    }
  }
  
  // Check if we already have an inflight connection for this cache type
  if (inflightConnections[cacheType]) return inflightConnections[cacheType]!;

  inflightConnections[cacheType] = (async () => {
    const client = await connectClient(userId, username, forceAnonymous);

    // Fetch data in parallel for better performance
    const [dmChannelsResult, communityChannelResult, usersResult] = await Promise.allSettled([
      // DM channels
      (async () => {
        try {
          const filters: ChannelFilters = { type: "messaging", members: { $in: [cacheKey] } } as any;
          const sort: ChannelSort = { last_message_at: -1 } as any;
          return await client.queryChannels(filters, sort, { 
            watch: true, 
            state: true, 
            presence: true, 
            limit: 50 // Reduced for faster initial load
          } as any);
        } catch (e) {
          console.warn(`Failed to preload ${cacheType} DM channels`, e);
          return [];
        }
      })(),
      
      // Community channel
      (async () => {
        try {
          const community = client.channel("livestream", "community-global", { name: "Sauti Community" });
          try { await community.create(); } catch {}
          await community.watch();
          return community;
        } catch (e) {
          console.warn("Failed to preload community channel", e);
          return null;
        }
      })(),
      
      // Users (get first batch quickly)
      (async () => {
        try {
          const { users } = await client.queryUsers(
            { id: { $ne: cacheKey } },
            { last_active: -1 },
            { limit: 50, presence: true } as any // Start with 50 for faster loading
          );
          return users || [];
        } catch (e) {
          console.warn(`Failed to preload ${cacheType} users`, e);
          return [];
        }
      })()
    ]);
    
    const dmChannels = dmChannelsResult.status === 'fulfilled' ? dmChannelsResult.value : [];
    const communityChannel = communityChannelResult.status === 'fulfilled' ? communityChannelResult.value : null;
    const initialUsers = usersResult.status === 'fulfilled' ? usersResult.value : [];
    
    const mappedUsers: PreloadedUser[] = initialUsers.map((u) => ({ id: u.id, username: (u as any).name || u.id }));
    
    // Background load more users after initial cache is set
    setTimeout(async () => {
      try {
        let offset = 50;
        const pageSize = 100;
        let allAdditionalUsers: any[] = [];
        
        while (offset < 500) { // Limit to 500 total users for performance
          const { users } = await client.queryUsers(
            { id: { $ne: cacheKey } },
            { last_active: -1 },
            { limit: pageSize, offset, presence: false } as any // No presence for background loading
          );
          if (!users || users.length === 0) break;
          allAdditionalUsers = allAdditionalUsers.concat(users);
          if (users.length < pageSize) break;
          offset += pageSize;
        }
        
        // Update cached users if still valid
        const currentCache = chatCache[cacheType];
        if (currentCache && currentCache.userId === cacheKey) {
          const additionalMappedUsers: PreloadedUser[] = allAdditionalUsers.map((u) => ({ id: u.id, username: (u as any).name || u.id }));
          currentCache.users = [...mappedUsers, ...additionalMappedUsers];
        }
      } catch (e) {
        console.warn("Failed to load additional users in background", e);
      }
    }, 100); // Load additional users after 100ms

    // Create and store the cache
    const effectiveName = isAnonymous ? "Anonymous" : username;
    const preloadedChat: PreloadedChat = { 
      client, 
      userId: cacheKey, 
      username: effectiveName, 
      dmChannels, 
      users: mappedUsers, 
      communityChannel,
      isAnonymous
    };
    
    chatCache[cacheType] = preloadedChat;
    inflightConnections[cacheType] = null;
    connectionHealthy[cacheType] = true;
    lastConnectionCheck[cacheType] = Date.now();
    
    return preloadedChat;
  })();

  return inflightConnections[cacheType]!;
}

export function getPreloadedChat(userId?: string, forceAnonymous?: boolean): PreloadedChat | null {
  const isAnonymous = forceAnonymous ?? (typeof window !== "undefined" && window.localStorage.getItem("ss_anon_mode") === "1");
  const cacheType = isAnonymous ? 'anonymous' : 'regular';
  const cached = chatCache[cacheType];
  
  if (!cached) return null;
  if (userId) {
    const expectedUserId = isAnonymous ? getAnonymousId(userId) : userId;
    if (cached.userId !== expectedUserId) return null;
  }
  return cached;
}

export async function disconnectPreloadedChat(mode?: 'regular' | 'anonymous' | 'both') {
  const modesToDisconnect = mode === 'both' ? ['regular', 'anonymous'] as const : [mode || 'regular'];
  
  for (const cacheType of modesToDisconnect) {
    try {
      if (chatCache[cacheType]?.client) {
        await chatCache[cacheType]!.client.disconnectUser();
      }
    } catch {}
    chatCache[cacheType] = null;
    inflightConnections[cacheType] = null;
    connectionHealthy[cacheType] = true;
    lastConnectionCheck[cacheType] = 0;
  }
}

// Force refresh the cache (useful after user profile updates)
export async function refreshPreloadedChat(userId: string, username: string, mode?: 'regular' | 'anonymous' | 'both'): Promise<PreloadedChat | PreloadedChat[]> {
  await disconnectPreloadedChat(mode);
  
  if (mode === 'both') {
    const [regular, anonymous] = await Promise.all([
      preloadChat(userId, username, false),
      preloadChat(userId, username, true)
    ]);
    return [regular, anonymous];
  } else {
    const forceAnonymous = mode === 'anonymous';
    return preloadChat(userId, username, forceAnonymous);
  }
}

// Check if chat is ready without triggering a load
export function isChatReady(userId?: string, forceAnonymous?: boolean): boolean {
  const isAnonymous = forceAnonymous ?? (typeof window !== "undefined" && window.localStorage.getItem("ss_anon_mode") === "1");
  const cached = getPreloadedChat(userId, forceAnonymous);
  if (!cached) return false;
  return checkConnectionHealth(isAnonymous);
}

// Warmup function that can be called from anywhere
export function warmupChat(userId: string, username: string): void {
  // Fire and forget preload for current mode
  preloadChat(userId, username).catch(console.warn);
}

// Warmup both regular and anonymous modes
export function warmupBothModes(userId: string, username: string): void {
  // Fire and forget preload for both modes
  preloadChat(userId, username, false).catch(console.warn);
  preloadChat(userId, username, true).catch(console.warn);
}

// Get current anonymous ID without generating a new one
export function getCurrentAnonymousId(): string | null {
  if (typeof window !== "undefined") {
    return window.localStorage.getItem("ss_anon_id");
  }
  return null;
}

// Security: Clear sensitive anonymous data
export function clearAnonymousData(): void {
  if (typeof window !== "undefined") {
    try {
      window.localStorage.removeItem("ss_anon_mode");
      window.localStorage.removeItem("ss_anon_id");
      
      // Clear anonymous cache
      if (chatCache.anonymous?.client) {
        chatCache.anonymous.client.disconnectUser().catch(() => {});
      }
      chatCache.anonymous = null;
      inflightConnections.anonymous = null;
      connectionHealthy.anonymous = true;
      lastConnectionCheck.anonymous = 0;
      
      console.log('🧹 Anonymous data cleared for security');
    } catch (error) {
      console.warn('Failed to clear anonymous data:', error);
    }
  }
}

// Validate that user has permission to use anonymous mode
export function validateAnonymousPermission(userId: string): boolean {
  // Add any business logic here to determine if user can use anonymous mode
  // For example, check user type, subscription status, etc.
  if (!userId || userId.length < 8) {
    return false;
  }
  
  // For now, allow all valid users to use anonymous mode
  return true;
}

// Get cache statistics for monitoring
export function getCacheStats(): {
  regular: { connected: boolean; userId: string | null; channelCount: number; userCount: number };
  anonymous: { connected: boolean; userId: string | null; channelCount: number; userCount: number };
} {
  return {
    regular: {
      connected: !!chatCache.regular?.client,
      userId: chatCache.regular?.userId || null,
      channelCount: chatCache.regular?.dmChannels?.length || 0,
      userCount: chatCache.regular?.users?.length || 0
    },
    anonymous: {
      connected: !!chatCache.anonymous?.client,
      userId: chatCache.anonymous?.userId || null,
      channelCount: chatCache.anonymous?.dmChannels?.length || 0,
      userCount: chatCache.anonymous?.users?.length || 0
    }
  };
}

