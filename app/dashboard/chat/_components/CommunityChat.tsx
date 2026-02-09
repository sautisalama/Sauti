'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/utils/supabase/client';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { EmojiPicker } from '@/components/chat/EmojiPicker';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Users, Settings, UserPlus, Send, Smile, Paperclip, Mic, ArrowLeft, Info, MoreVertical } from 'lucide-react';
import { Message } from '@/types/chat';

interface CommunityChatProps {
  communityId: string;
  communityName: string;
  communityAvatar?: string | null;
  communityDescription?: string | null;
  memberCount?: number;
  onBack?: () => void;
  currentUserId: string;
}

interface CommunityMember {
  id: string;
  user_id: string;
  role: 'admin' | 'moderator' | 'member';
  user?: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
}

export default function CommunityChat({
  communityId,
  communityName,
  communityAvatar,
  communityDescription,
  memberCount = 0,
  onBack,
  currentUserId
}: CommunityChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<CommunityMember[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showMemberList, setShowMemberList] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUserMember, setIsUserMember] = useState(false);
  const [userRole, setUserRole] = useState<'admin' | 'moderator' | 'member' | null>(null);
  

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  
  const handleBack = () => {
    if (onBack) {
      onBack();
    } else {
      router.back();
    }
  };
  
  const supabase = createClient();

  // Fetch messages and check membership
  useEffect(() => {
    loadData();
    
    // Subscribe to new messages
    const channel = supabase
      .channel(`community:${communityId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.community-${communityId}`
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => {
            if (prev.find(m => m.id === newMsg.id)) return prev;
            return [...prev, newMsg];
          });
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [communityId]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Check membership
      const { data: membership } = await supabase
        .from('community_members')
        .select('role')
        .eq('community_id', communityId)
        .eq('user_id', currentUserId)
        .single();
      
      if (membership) {
        setIsUserMember(true);
        setUserRole(membership.role);
      }

      // Load members
      const { data: membersData } = await supabase
        .from('community_members')
        .select(`
          id,
          user_id,
          role,
          user:profiles(first_name, last_name, avatar_url)
        `)
        .eq('community_id', communityId)
        .order('role', { ascending: true })
        .limit(50);
      
      if (membersData) {
        setMembers(membersData as any);
      }

      // Load messages (from a community chat table or messages with community prefix)
      const { data: messagesData } = await supabase
        .from('messages')
        .select('*')
        .eq('chat_id', `community-${communityId}`)
        .order('created_at', { ascending: true })
        .limit(100);
      
      if (messagesData) {
        setMessages(messagesData);
      }
    } catch (error) {
      console.error('Error loading community data:', error);
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSend = async () => {
    if (!inputText.trim() || sending || !isUserMember) return;
    setSending(true);
    
    try {
      const { data: newMessage, error } = await supabase
        .from('messages')
        .insert({
          chat_id: `community-${communityId}`,
          sender_id: currentUserId,
          content: inputText,
          type: 'text',
          metadata: {}
        })
        .select()
        .single();

      if (!error && newMessage) {
        setInputText('');
        scrollToBottom();
      }
    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  const handleJoinCommunity = async () => {
    try {
      const { error } = await supabase
        .from('community_members')
        .insert({
          community_id: communityId,
          user_id: currentUserId,
          role: 'member'
        });

      if (!error) {
        setIsUserMember(true);
        setUserRole('member');
        loadData(); // Refresh data
      }
    } catch (error) {
      console.error('Failed to join community:', error);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full bg-serene-neutral-50 relative w-full">
      {/* Background Pattern */}
      <div className="absolute inset-0 z-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
      
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-md border-b border-serene-neutral-200 z-10 shadow-sm">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="md:hidden text-serene-neutral-500" onClick={handleBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <Avatar className="h-10 w-10 ring-2 ring-white shadow-sm">
            <AvatarImage src={communityAvatar || undefined} />
            <AvatarFallback className="bg-gradient-to-br from-[#00a884] to-[#25d366] text-white">
              {communityName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <span className="text-serene-neutral-900 font-bold leading-tight">{communityName}</span>
            <span className="text-xs text-serene-neutral-500 flex items-center gap-1">
              <Users className="h-3 w-3" />
              {memberCount} members
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-full hover:bg-serene-neutral-50"
            onClick={() => setShowMemberList(!showMemberList)}
          >
            <Users className="h-5 w-5 text-serene-neutral-400" />
          </Button>
          {userRole === 'admin' && (
            <Button variant="ghost" size="icon" className="rounded-full hover:bg-serene-neutral-50">
              <Settings className="h-5 w-5 text-serene-neutral-400" />
            </Button>
          )}
          <Button variant="ghost" size="icon" className="rounded-full hover:bg-serene-neutral-50">
            <MoreVertical className="h-5 w-5 text-serene-neutral-400" />
          </Button>
        </div>
      </div>

      {/* Community Info Banner */}
      {communityDescription && (
        <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 z-10 flex items-center gap-2">
          <Info className="h-4 w-4 text-blue-600" />
          <span className="text-sm text-blue-800">{communityDescription}</span>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 z-10 custom-scrollbar flex flex-col gap-2">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00a884]"></div>
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <Users className="h-16 w-16 text-serene-neutral-200 mb-4" />
              <p className="text-serene-neutral-500 font-medium">Welcome to {communityName}!</p>
              <p className="text-serene-neutral-400 text-sm mt-1">Be the first to send a message</p>
            </div>
          ) : (
            <>
              {messages.map((msg, idx) => {
                const isOwn = msg.sender_id === currentUserId;
                const showTail = idx === 0 || messages[idx - 1].sender_id !== msg.sender_id;
                const member = members.find(m => m.user_id === msg.sender_id);
                
                return (
                  <div key={msg.id}>
                    {/* Show sender name for group messages */}
                    {!isOwn && showTail && member?.user && (
                      <div className="text-xs text-serene-neutral-500 ml-2 mb-1">
                        {member.user.first_name} {member.user.last_name}
                        {member.role === 'admin' && (
                          <span className="ml-1 text-[#00a884] font-medium">• Admin</span>
                        )}
                      </div>
                    )}
                    <MessageBubble 
                      message={msg} 
                      isOwn={isOwn} 
                      showTail={showTail}
                    />
                  </div>
                );
              })}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Member List Sidebar - slides in */}
        {showMemberList && (
          <div className="w-64 bg-white border-l border-serene-neutral-200 overflow-y-auto z-10 animate-in slide-in-from-right">
            <div className="p-3 border-b border-serene-neutral-100">
              <h3 className="font-semibold text-serene-neutral-900">Members</h3>
              <p className="text-xs text-serene-neutral-500">{members.length} members</p>
            </div>
            <div className="divide-y divide-serene-neutral-50">
              {members.map(member => (
                <div key={member.id} className="flex items-center gap-3 p-3 hover:bg-serene-neutral-50">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={member.user?.avatar_url || undefined} />
                    <AvatarFallback className="text-sm">
                      {member.user?.first_name?.charAt(0) || 'U'}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-serene-neutral-900 truncate">
                      {member.user?.first_name} {member.user?.last_name}
                    </p>
                    <p className="text-xs text-serene-neutral-500 capitalize">{member.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Join Community Banner (if not a member) */}
      {!isUserMember && !isLoading && (
        <div className="bg-gradient-to-r from-[#00a884] to-[#25d366] px-4 py-3 z-10 flex items-center justify-between">
          <span className="text-white font-medium">Join this community to participate</span>
          <Button 
            onClick={handleJoinCommunity}
            className="bg-white text-[#00a884] hover:bg-white/90"
          >
            <UserPlus className="h-4 w-4 mr-2" />
            Join
          </Button>
        </div>
      )}

      {/* Input Area (only if member) */}
      {isUserMember && (
        <div className="bg-white px-4 py-3 flex items-center gap-3 z-10 border-t border-serene-neutral-100 relative">
          {/* Emoji Picker */}
          {showEmojiPicker && (
            <div 
              ref={emojiPickerRef}
              className="absolute bottom-full left-0 mb-2 z-50"
            >
              <EmojiPicker 
                onEmojiSelect={(emoji) => {
                  setInputText(prev => prev + emoji);
                  textareaRef.current?.focus();
                }}
                onClose={() => setShowEmojiPicker(false)}
              />
            </div>
          )}
          
          <Button 
            variant="ghost" 
            size="icon" 
            className={`text-serene-neutral-400 hover:text-[#00a884] hover:bg-[#00a884]/10 rounded-full ${showEmojiPicker ? 'bg-[#00a884]/10 text-[#00a884]' : ''}`}
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          >
            <Smile className="h-6 w-6" />
          </Button>
          
          <Button variant="ghost" size="icon" className="text-serene-neutral-400 hover:text-[#00a884] hover:bg-[#00a884]/10 rounded-full">
            <Paperclip className="h-6 w-6" />
          </Button>
          
          <div className="flex-1 bg-serene-neutral-50 hover:bg-serene-neutral-100 transition-colors rounded-2xl flex items-end px-4 py-2 border border-transparent focus-within:border-[#00a884]/30 focus-within:bg-white focus-within:ring-2 focus-within:ring-[#00a884]/20">
            <textarea
              ref={textareaRef}
              className="flex-1 bg-transparent border-none outline-none text-serene-neutral-900 placeholder-serene-neutral-400 text-[15px] resize-none max-h-[120px] py-1"
              placeholder="Type a message..."
              rows={1}
              value={inputText}
              onChange={(e) => {
                setInputText(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              onKeyDown={handleKeyPress}
              onFocus={() => setShowEmojiPicker(false)}
            />
          </div>

          {inputText.trim() ? (
            <Button 
              onClick={handleSend} 
              disabled={sending}
              className="bg-[#00a884] hover:bg-[#00997a] text-white rounded-full h-12 w-12 flex items-center justify-center p-0 shadow-lg"
            >
              <Send className="h-5 w-5 ml-0.5" />
            </Button>
          ) : (
            <Button variant="ghost" size="icon" className="text-serene-neutral-400 hover:text-[#00a884] hover:bg-[#00a884]/10 rounded-full">
              <Mic className="h-6 w-6" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
