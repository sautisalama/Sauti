'use client';

import { Chat } from '@/types/chat';
import { Search, MessageSquare, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { NewChatModal } from './NewChatModal';
import { useUser } from '@/hooks/useUser';
import Link from 'next/link';

interface ChatSidebarProps {
  chats: Chat[];
  selectedChatId?: string;
  onSelectChat: (chat: Chat) => void;
  isLoading: boolean;
  currentUserId?: string;
}

export function ChatSidebar({ chats, selectedChatId, onSelectChat, isLoading, currentUserId }: ChatSidebarProps) {
  const user = useUser();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'unread' | 'groups'>('all');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);

  const getInitials = () => {
    if (!user?.profile) return 'U';
    const names = `${user.profile.first_name || ""} ${user.profile.last_name || ""}`.trim();
    return names.charAt(0).toUpperCase() || user.email?.charAt(0).toUpperCase() || 'U';
  };

  const filteredChats = chats.filter(chat => {
    const meta = chat.metadata || {};
    const otherParticipant = chat.participants?.find(p => p.user_id !== currentUserId) || chat.participants?.[0];
    const name = meta.name || otherParticipant?.user?.first_name || 'Unknown User'; 
    const matchesSearch = name.toLowerCase().includes(search.toLowerCase());
    
    if (!matchesSearch) return false;
    if (filter === 'unread') return (chat.unread_count || 0) > 0;
    if (filter === 'groups') return chat.type === 'group';
    return true;
  });

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-[#f0f2f5] border-r border-[#d1d7db]">
        <div className="flex items-center gap-3">
          {/* Mobile Profile Logic: Since top bar is hidden, show avatar here */}
          <Link href="/dashboard/profile" className="lg:hidden">
              <Avatar className="h-10 w-10 border-2 border-white shadow-sm cursor-pointer hover:opacity-80 transition-opacity">
                <AvatarImage src={user?.profile?.avatar_url || ""} />
                <AvatarFallback className="bg-gradient-to-br from-serene-blue-500 to-serene-blue-600 text-white font-medium">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
          </Link>
          <h1 className="text-xl font-bold text-[#54656f] ml-1">Messages</h1>
        </div>

        <div className="flex gap-2 text-[#54656f]">
           <Button 
             variant="ghost" 
             size="icon" 
             className="rounded-full h-10 w-10" 
             title="New Chat"
             onClick={() => setIsNewChatOpen(true)}
            >
             <MessageSquare className="h-5 w-5" />
           </Button>
           <Button variant="ghost" size="icon" className="rounded-full h-10 w-10">
             <Filter className="h-5 w-5" />
           </Button>
        </div>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-r border-[#f0f2f5] bg-white">
        <div className="relative flex items-center bg-[#f0f2f5] rounded-lg px-3 py-1.5">
          <Search className="h-4 w-4 text-[#54656f]" />
          <input 
            type="text"
            placeholder="Search or start new chat"
            className="w-full bg-transparent border-none focus:ring-0 text-sm ml-3 placeholder-[#54656f] h-7"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        {/* Filter Chips */}
        <div className="flex gap-2 mt-2 px-1">
          {['All', 'Unread', 'Groups'].map(f => (
            <button
              key={f}
              onClick={() => setFilter(f.toLowerCase() as any)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === f.toLowerCase() 
                ? 'bg-[#00a884] text-white' 
                : 'bg-[#f0f2f5] text-[#54656f] hover:bg-[#e9edef]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {isLoading ? (
          <div className="grid gap-2 p-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        ) : (
          <>
             {/* Salama AI Item */}
             {search === '' && filter === 'all' && (
               <div 
                  onClick={() => onSelectChat({
                    id: 'salama-ai-bot',
                    type: 'dm',
                    last_message_at: new Date().toISOString(),
                    created_by: 'system',
                    created_at: new Date().toISOString(),
                    metadata: {
                      name: 'Salama AI',
                      is_official: true,
                      last_message_preview: {
                        content: "Hello! I'm Salama, your AI assistant.",
                        sender_id: 'system',
                        type: 'text',
                        created_at: new Date().toISOString()
                      }
                    },
                    participants: [],
                    unread_count: 1
                  })}
                  className={`flex items-center gap-3 p-3 cursor-pointer border-b border-[#f0f2f5] hover:bg-[#f5f6f6] transition-colors relative ${
                    selectedChatId === 'salama-ai-bot' ? 'bg-[#f0f2f5]' : ''
                  }`}
               >
                 <div className="relative">
                   <Avatar className="h-12 w-12 border-2 border-[#25d366]">
                      <AvatarImage src="/icons/salama-ai.png" />
                      <AvatarFallback className="bg-purple-100 text-purple-700">AI</AvatarFallback>
                   </Avatar>
                   <span className="absolute bottom-0 right-0 h-3 w-3 bg-[#25d366] border-2 border-white rounded-full"></span>
                 </div>
                 
                 <div className="flex-1 min-w-0 flex flex-col justify-center">
                   <div className="flex justify-between items-baseline">
                     <span className="font-semibold text-[#111b21] truncate text-[17px]">Salama AI</span>
                     <span className="text-xs text-[#667781] whitespace-nowrap ml-2">Just now</span>
                   </div>
                   <div className="flex justify-between items-center mt-0.5">
                     <span className="text-[14px] text-[#667781] truncate flex-1 block">
                        Hello! I'm Salama, your AI assistant.
                     </span>
                     <span className="ml-2 bg-[#25d366] text-white text-[11px] font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center px-1">
                       1
                     </span>
                   </div>
                 </div>
               </div>
             )}

            {filteredChats.map(chat => {
            const meta = chat.metadata || {};
            const otherParticipant = chat.participants?.find(p => p.user_id !== currentUserId) || chat.participants?.[0];
            const name = meta.name || `${otherParticipant?.user?.first_name || 'User'} ${otherParticipant?.user?.last_name || ''}`;
            const lastMsg = meta.last_message_preview;
            const time = lastMsg?.created_at ? format(new Date(lastMsg.created_at), 'HH:mm') : '';

            return (
              <div 
                key={chat.id}
                onClick={() => onSelectChat(chat)}
                className={`flex items-center gap-3 p-3 cursor-pointer border-b border-[#f0f2f5] hover:bg-[#f5f6f6] transition-colors relative ${
                  selectedChatId === chat.id ? 'bg-[#f0f2f5]' : ''
                }`}
              >
                <Avatar className="h-12 w-12">
                   <AvatarImage src={meta.image_url || otherParticipant?.user?.avatar_url} />
                   <AvatarFallback>{name.charAt(0)}</AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex justify-between items-baseline">
                    <span className="font-normal text-[#111b21] truncate text-[17px]">{name}</span>
                    <span className="text-xs text-[#667781] whitespace-nowrap ml-2">{time}</span>
                  </div>
                  <div className="flex justify-between items-center mt-0.5">
                    <span className="text-[14px] text-[#667781] truncate flex-1 block">
                       {lastMsg?.content || 'No messages yet'}
                    </span>
                    {(chat.unread_count || 0) > 0 && (
                      <span className="ml-2 bg-[#25d366] text-white text-[11px] font-bold rounded-full h-5 min-w-[20px] flex items-center justify-center px-1">
                        {chat.unread_count}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          </>
        )}
      </div>

      <NewChatModal 
        isOpen={isNewChatOpen} 
        onClose={() => setIsNewChatOpen(false)}
        onChatCreated={() => {
           // Reload chats logic will be triggered by realtime potentially, or we need a callback
           // Ideally we simply wait for realtime or bubble up the event
        }}
      />
    </div>
  );
}
