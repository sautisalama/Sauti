'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChatSidebar } from './ChatSidebar';
import { ChatWindow } from './ChatWindow';
import { Chat } from '@/types/chat';
import { getChats } from '@/app/actions/chat';
import { createClient } from '@/utils/supabase/client';

export function ChatLayout() {
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);

  const router = useRouter();
  const searchParams = useSearchParams();
  const chatId = searchParams.get('id');

  useEffect(() => {
    if (chatId && chats.length > 0) {
        const found = chats.find(c => c.id === chatId);
        if (found && found.id !== selectedChat?.id) {
            setSelectedChat(found);
        }
    } else if (!chatId && selectedChat) {
        setSelectedChat(null);
    }
  }, [chatId, chats, selectedChat]);

  const handleSelectChat = (chat: Chat) => {
    setSelectedChat(chat);
    try {
      const params = new URLSearchParams(searchParams.toString());
      params.set('id', chat.id);
      router.push(`?${params.toString()}`);
    } catch (e) {
      console.error("Nav error", e);
    }
  };

  const handleBack = () => {
    setSelectedChat(null);
    router.push('/dashboard/chat');
  };

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    
    // Fetch User
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => setCurrentUserId(data.user?.id));

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    if (currentUserId) {
        loadChats();
    }
  }, [currentUserId]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel('chat_updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chats' },
        () => loadChats() 
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
           loadChats();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const loadChats = async () => {
    try {
      const data = await getChats();
      setChats(data);
    } catch (error) {
      console.error('Failed to load chats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const currentView = isMobile ? (selectedChat ? 'chat' : 'list') : 'split';

  return (
    <div className="flex h-[100dvh] w-full bg-[#f0f2f5] overflow-hidden">
      {/* Sidebar */}
      {(currentView === 'split' || currentView === 'list') && (
        <div className={`${currentView === 'split' ? 'w-[400px] border-r border-[#d1d7db]' : 'w-full'} h-full bg-white z-10`}>
          <ChatSidebar 
            chats={chats} 
            selectedChatId={selectedChat?.id} 
            onSelectChat={handleSelectChat}
            isLoading={isLoading}
            currentUserId={currentUserId}
          />
        </div>
      )}

      {/* Chat Window */}
      {(currentView === 'split' || currentView === 'list' || currentView === 'chat') && (
        <div className={`${currentView === 'split' ? 'flex-1' : (currentView === 'chat' ? 'w-full fixed inset-0 z-20 bg-[#efeae2]' : 'hidden')} h-full flex flex-col`}>
          {selectedChat ? (
            <ChatWindow 
              chat={selectedChat} 
              onBack={handleBack} 
            />
          ) : (
            <div className="hidden md:flex flex-col items-center justify-center h-full bg-[#f8f9fa] text-[#8696a0] border-b-[6px] border-[#25d366]">
              <div className="text-3xl font-light mb-4">Sauti Salama for Web</div>
              <div className="text-sm">Safe, secure, and private messaging.</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
