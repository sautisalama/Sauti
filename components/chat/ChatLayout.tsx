'use client';

import { useState, useEffect, useLayoutEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ChatSidebar } from './ChatSidebar';
import { ChatWindow } from './ChatWindow';
import { Chat } from '@/types/chat';
import { getChats } from '@/app/actions/chat';
import { createClient } from '@/utils/supabase/client';
import { SALAMA_BOT_ID, salamaBotChat } from '@/utils/chat/bot';
import { CHATS_CHANGED_EVENT } from '@/lib/chat/client-read';

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

export function ChatLayout() {
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [chats, setChats] = useState<Chat[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(undefined);

  const router = useRouter();
  const searchParams = useSearchParams();
  const chatId = searchParams.get('id');
  // The chat the user just tapped, until the URL catches up (avoids the effect below deselecting it).
  const pendingSelect = useRef<string | null>(null);
  // Set while a community is being opened (it needs a round trip). The old conversation is deselected for that time,
  // otherwise the user could type into it believing they are in the community.
  const OPENING = '__opening__';
  // True once this page itself pushed a history entry for an open chat, so "back" can pop it
  // instead of stacking another entry (which made the phone's back button bounce between list and chat).
  const pushedRef = useRef(false);

  useEffect(() => {
    if (pendingSelect.current) {
      // A selection the user just made is still travelling into the URL: do not let the OLD id in the URL
      // pull the old conversation back (it used to flash up, and a message typed then went to the wrong chat).
      if (pendingSelect.current === OPENING || chatId !== pendingSelect.current) return;
      pendingSelect.current = null;
    }

    if (chatId === SALAMA_BOT_ID) {
        if (selectedChat?.id !== SALAMA_BOT_ID) setSelectedChat(salamaBotChat());
    } else if (chatId && chats.length > 0) {
        const found = chats.find(c => c.id === chatId);
        if (found && found.id !== selectedChat?.id) {
            setSelectedChat(found);
        }
    } else if (!chatId && selectedChat && pendingSelect.current !== selectedChat.id) {
        setSelectedChat(null);
    }
  }, [chatId, chats, selectedChat]);

  const handleSelectChat = (chat: Chat) => {
    pendingSelect.current = chat.id;
    setSelectedChat(chat);
    try {
      const params = new URLSearchParams(searchParams.toString());
      params.set('id', chat.id);
      // Phones: one history entry per opened chat so the system back gesture returns to the list.
      // Desktop shows both panes, so switching chats shouldn't pile up history.
      if (isMobile && !chatId) {
        pushedRef.current = true;
        router.push(`?${params.toString()}`);
      } else {
        router.replace(`?${params.toString()}`);
      }
    } catch (e) {
      console.error("Nav error", e);
    }
  };

  const handleBack = () => {
    setSelectedChat(null);
    if (pushedRef.current) {
      pushedRef.current = false;
      router.back();
    } else {
      router.replace('/dashboard/chat');
    }
    loadChats(); // refresh unread badges after reading
  };

  // Decide phone vs desktop layout before the first paint (no flash of the two-pane layout on phones).
  useIsoLayoutEffect(() => {
    setIsMobile(window.innerWidth < 768);
  }, []);

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
      .channel(`chat_updates:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'chats' },
        () => scheduleReload()
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        () => scheduleReload()
      )
      .subscribe();

    // A chat was opened/read somewhere: its unread badge should clear.
    window.addEventListener(CHATS_CHANGED_EVENT, scheduleReload);

    return () => {
      window.removeEventListener(CHATS_CHANGED_EVENT, scheduleReload);
      supabase.removeChannel(channel);
    };
  }, []);

  // Many events can arrive together (a burst of messages, read receipts): refetch once.
  const reloadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleReload = () => {
    if (reloadTimer.current) clearTimeout(reloadTimer.current);
    reloadTimer.current = setTimeout(() => loadChats(), 350);
  };
  useEffect(() => () => { if (reloadTimer.current) clearTimeout(reloadTimer.current); }, []);

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
            onOpeningChat={() => { pendingSelect.current = OPENING; setSelectedChat(null); }}
            onOpenFailed={() => { pendingSelect.current = null; }}
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
