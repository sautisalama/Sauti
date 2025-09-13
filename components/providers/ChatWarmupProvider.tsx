"use client";

import { createContext, useContext, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { createClient } from '@/utils/supabase/client';
import { warmupChat, warmupBothModes, isChatReady, disconnectPreloadedChat, clearAnonymousData } from '@/utils/chat/preload';

interface ChatWarmupContextType {
  warmupChatForUser: (userId: string, username: string, bothModes?: boolean) => void;
  isChatReady: (userId?: string) => boolean;
}

const ChatWarmupContext = createContext<ChatWarmupContextType | null>(null);

export function ChatWarmupProvider({ children }: { children: ReactNode }) {
  const supabase = useMemo(() => createClient(), []);

  const warmupChatForUser = useCallback((userId: string, username: string, bothModes = true) => {
    console.log('🔥 Warming up chat for user:', username, bothModes ? '(both modes)' : '');
    if (bothModes) {
      warmupBothModes(userId, username);
    } else {
      warmupChat(userId, username);
    }
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        console.log('🚀 User signed in, starting chat warmup...');
        
        // Get user profile for the username
        try {
          const { data: profile } = await supabase
            .from('profiles')
            .select('first_name')
            .eq('id', session.user.id)
            .single();
          
          const username = profile?.first_name || session.user.email || session.user.id;
          
          // Start warmup immediately after sign in
          setTimeout(() => {
            warmupChatForUser(session.user.id, username);
          }, 100); // Small delay to ensure other auth processes complete
          
        } catch (error) {
          console.warn('Failed to get user profile for chat warmup:', error);
          // Fallback to email or id
          warmupChatForUser(session.user.id, session.user.email || session.user.id);
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('🔒 User signed out, cleaning up chat data...');
        
        // Disconnect all chat clients and clear caches
        await disconnectPreloadedChat('both');
        
        // Clear anonymous data for security
        clearAnonymousData();
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [supabase, warmupChatForUser]);

  const contextValue: ChatWarmupContextType = {
    warmupChatForUser,
    isChatReady
  };

  return (
    <ChatWarmupContext.Provider value={contextValue}>
      {children}
    </ChatWarmupContext.Provider>
  );
}

export function useChatWarmup() {
  const context = useContext(ChatWarmupContext);
  if (!context) {
    throw new Error('useChatWarmup must be used within a ChatWarmupProvider');
  }
  return context;
}
