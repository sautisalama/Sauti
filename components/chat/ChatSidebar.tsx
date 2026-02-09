'use client';

import { Chat } from '@/types/chat';
import { Search, MessageSquare, Filter, Users, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { useState, useEffect } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { NewChatModal } from './NewChatModal';
import { CommunityCreateModal } from './CommunityCreateModal';
import { useUser } from '@/hooks/useUser';
import Link from 'next/link';
import { createClient } from '@/utils/supabase/client';

interface Community {
  id: string;
  name: string;
  description: string | null;
  avatar_url: string | null;
  is_public: boolean;
  member_count: number;
  created_at: string;
  creator_id: string;
}

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
  const [activeTab, setActiveTab] = useState<'chats' | 'communities'>('chats');
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isCreateCommunityOpen, setIsCreateCommunityOpen] = useState(false);
  const [communities, setCommunities] = useState<Community[]>([]);
  const [isLoadingCommunities, setIsLoadingCommunities] = useState(false);

  const supabase = createClient();

  // Fetch communities
  useEffect(() => {
    if (activeTab === 'communities' && currentUserId) {
      setIsLoadingCommunities(true);
      // Fetch all public communities and communities user is a member of
      const fetchCommunities = async () => {
        try {
          const { data, error } = await supabase
            .from('communities')
            .select('*')
            .or(`is_public.eq.true,creator_id.eq.${currentUserId}`)
            .order('created_at', { ascending: false });
          
          if (!error && data) {
            setCommunities(data);
          }
        } catch (e) {
          console.error('Error fetching communities:', e);
        } finally {
          setIsLoadingCommunities(false);
        }
      };
      fetchCommunities();
    }
  }, [activeTab, currentUserId, supabase]);

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

  const filteredCommunities = communities.filter(community => 
    community.name.toLowerCase().includes(search.toLowerCase())
  );

  const handleCommunityClick = (community: Community) => {
    // Create a chat-like object for community
    onSelectChat({
      id: `community-${community.id}`,
      type: 'community' as any,
      last_message_at: community.created_at,
      created_by: community.creator_id,
      created_at: community.created_at,
      metadata: {
        name: community.name,
        description: community.description ?? undefined,
        image_url: community.avatar_url ?? undefined,
        is_community: true,
        community_id: community.id,
        member_count: community.member_count
      },
      participants: [],
      unread_count: 0
    });
  };

  const isProfessional = user?.profile?.user_type === 'professional' || user?.profile?.user_type === 'ngo';

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
          <h1 className="text-xl font-bold text-[#54656f] ml-1">
            {activeTab === 'chats' ? 'Messages' : 'Communities'}
          </h1>
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

      {/* Tab Switcher */}
      <div className="flex border-b border-[#f0f2f5] bg-white">
        <button
          onClick={() => setActiveTab('chats')}
          className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'chats' 
              ? 'text-[#00a884]' 
              : 'text-[#54656f] hover:bg-[#f5f6f6]'
          }`}
        >
          Messages
          {activeTab === 'chats' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00a884]" />
          )}
        </button>
        <button
          onClick={() => setActiveTab('communities')}
          className={`flex-1 py-3 text-sm font-medium transition-colors relative ${
            activeTab === 'communities' 
              ? 'text-[#00a884]' 
              : 'text-[#54656f] hover:bg-[#f5f6f6]'
          }`}
        >
          <span className="flex items-center justify-center gap-1.5">
            <Users className="h-4 w-4" />
            Communities
          </span>
          {activeTab === 'communities' && (
            <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#00a884]" />
          )}
        </button>
      </div>

      {/* Search */}
      <div className="p-2 border-b border-r border-[#f0f2f5] bg-white">
        <div className="relative flex items-center bg-[#f0f2f5] rounded-lg px-3 py-1.5">
          <Search className="h-4 w-4 text-[#54656f]" />
          <input 
            type="text"
            placeholder={activeTab === 'chats' ? "Search or start new chat" : "Search communities"}
            className="w-full bg-transparent border-none focus:ring-0 text-sm ml-3 placeholder-[#54656f] h-7"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        
        {/* Filter Chips - Only show for chats */}
        {activeTab === 'chats' && (
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
        )}

        {/* Create Community Button - Only for professionals */}
        {activeTab === 'communities' && isProfessional && (
          <div className="mt-2 px-1">
            <Button 
              variant="outline" 
              size="sm" 
              className="w-full text-[#00a884] border-[#00a884] hover:bg-[#00a884]/10"
              onClick={() => setIsCreateCommunityOpen(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Create Community
            </Button>
          </div>
        )}
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === 'chats' ? (
          // Chats List
          isLoading ? (
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
                        <AvatarImage src="/logo-small.png" />
                        <AvatarFallback className="bg-gradient-to-br from-sauti-teal to-sauti-orange text-white">AI</AvatarFallback>
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
          )
        ) : (
          // Communities List
          isLoadingCommunities ? (
            <div className="grid gap-2 p-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-16 bg-gray-100 rounded animate-pulse" />
              ))}
            </div>
          ) : filteredCommunities.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-4">
              <Users className="h-12 w-12 text-[#54656f]/30 mb-3" />
              <p className="text-[#54656f] text-sm">
                {search ? 'No communities found' : 'No communities yet'}
              </p>
              <p className="text-[#667781] text-xs mt-1">
                {isProfessional 
                  ? 'Create a community to connect with survivors' 
                  : 'Join a community to connect with others'}
              </p>
            </div>
          ) : (
            filteredCommunities.map(community => (
              <div 
                key={community.id}
                onClick={() => handleCommunityClick(community)}
                className={`flex items-center gap-3 p-3 cursor-pointer border-b border-[#f0f2f5] hover:bg-[#f5f6f6] transition-colors relative ${
                  selectedChatId === `community-${community.id}` ? 'bg-[#f0f2f5]' : ''
                }`}
              >
                <Avatar className="h-12 w-12">
                   <AvatarImage src={community.avatar_url || undefined} />
                   <AvatarFallback className="bg-gradient-to-br from-[#00a884] to-[#25d366] text-white">
                     {community.name.charAt(0).toUpperCase()}
                   </AvatarFallback>
                </Avatar>
                
                <div className="flex-1 min-w-0 flex flex-col justify-center">
                  <div className="flex justify-between items-baseline">
                    <span className="font-normal text-[#111b21] truncate text-[17px]">{community.name}</span>
                    <span className="text-xs text-[#667781] whitespace-nowrap ml-2">
                      {community.member_count} members
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-0.5">
                    <span className="text-[14px] text-[#667781] truncate flex-1 block">
                       {community.description || 'A community for support'}
                    </span>
                    {community.is_public && (
                      <span className="ml-2 bg-[#f0f2f5] text-[#54656f] text-[10px] font-medium rounded px-1.5 py-0.5">
                        Public
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )
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

      {currentUserId && (
        <CommunityCreateModal
          isOpen={isCreateCommunityOpen}
          onClose={() => setIsCreateCommunityOpen(false)}
          currentUserId={currentUserId}
          onCommunityCreated={(community: Community) => {
            setCommunities(prev => [community, ...prev]);
            setIsCreateCommunityOpen(false);
          }}
        />
      )}
    </div>
  );
}
