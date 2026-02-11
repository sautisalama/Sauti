'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@/utils/supabase/client';
import { MessageBubble } from '@/components/chat/MessageBubble';
import { EmojiPicker } from '@/components/chat/EmojiPicker';
import { Button } from '@/components/ui/button';
import { Send, Smile, Paperclip, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { Message } from '@/types/chat';

interface CaseInlineChatProps {
  matchId: string;
  survivorId: string;
  currentUserId: string;
  survivorName?: string;
  expanded?: boolean;
  onToggleExpand?: () => void;
}

export function CaseInlineChat({
  matchId,
  survivorId,
  currentUserId,
  survivorName = 'Survivor',
  expanded = false,
  onToggleExpand
}: CaseInlineChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [chatId, setChatId] = useState<string | null>(null);
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const supabase = createClient();

  // Find or create chat for this match
  useEffect(() => {
    const initChat = async () => {
      setIsLoading(true);
      try {
        // Check if a support_match chat exists for this match
        const { data: existingChat } = await supabase
          .from('chats')
          .select('id')
          .eq('type', 'support_match')
          .contains('metadata', { match_id: matchId })
          .single();

        if (existingChat) {
          setChatId(existingChat.id);
          await loadMessages(existingChat.id);
        } else {
          // Create a new chat for this match
          const { data: newChat, error } = await supabase
            .from('chats')
            .insert({
              type: 'support_match',
              created_by: currentUserId,
              metadata: {
                match_id: matchId,
                survivor_id: survivorId,
                survivor_name: survivorName
              }
            })
            .select()
            .single();

          if (newChat) {
            setChatId(newChat.id);
            
            // Add participants
            await supabase.from('chat_participants').insert([
              { chat_id: newChat.id, user_id: currentUserId },
              { chat_id: newChat.id, user_id: survivorId }
            ]);
          }
        }
      } catch (error) {
        console.error('Error initializing chat:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (matchId && survivorId) {
      initChat();
    }
  }, [matchId, survivorId, currentUserId]);

  // Subscribe to new messages
  useEffect(() => {
    if (!chatId) return;

    const channel = supabase
      .channel(`inline-chat:${chatId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chatId}`
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
  }, [chatId]);

  const loadMessages = async (cid: string) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('chat_id', cid)
      .order('created_at', { ascending: true })
      .limit(50);

    if (data) {
      setMessages(data);
      scrollToBottom();
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSend = async () => {
    if (!inputText.trim() || sending || !chatId) return;
    setSending(true);

    try {
      await supabase.from('messages').insert({
        chat_id: chatId,
        sender_id: currentUserId,
        content: inputText,
        type: 'text',
        metadata: { source: 'case_inline' }
      });

      setInputText('');
      
      // Update chat last_message_at
      await supabase
        .from('chats')
        .update({ 
          last_message_at: new Date().toISOString(),
          metadata: supabase.rpc('jsonb_set_nested', {
            target: 'metadata',
            path: '{last_message_preview}',
            value: JSON.stringify({
              content: inputText.substring(0, 100),
              sender_id: currentUserId,
              type: 'text',
              created_at: new Date().toISOString()
            })
          }) as any
        })
        .eq('id', chatId);

    } catch (error) {
      console.error('Failed to send message:', error);
    } finally {
      setSending(false);
    }
  };

  if (!expanded) {
    return (
      <button
        onClick={onToggleExpand}
        className="flex items-center justify-between w-full p-3 bg-serene-neutral-50 hover:bg-serene-neutral-100 rounded-xl transition-colors text-sm"
      >
        <div className="flex items-center gap-2">
          <span className="text-serene-neutral-600 font-medium">Quick Message</span>
          {messages.length > 0 && (
            <span className="text-xs text-serene-neutral-400">
              {messages.length} messages
            </span>
          )}
        </div>
        <ChevronDown className="h-4 w-4 text-serene-neutral-400" />
      </button>
    );
  }

  return (
    <div className="border border-serene-neutral-200 rounded-xl overflow-hidden bg-white">
      {/* Header */}
      <button
        onClick={onToggleExpand}
        className="flex items-center justify-between w-full p-3 bg-serene-blue-50 hover:bg-serene-blue-100 transition-colors"
      >
        <span className="text-serene-blue-700 font-medium text-sm">
          Chat with {survivorName}
        </span>
        <ChevronUp className="h-4 w-4 text-serene-blue-600" />
      </button>

      {/* Messages */}
      <div className="h-48 overflow-y-auto p-3 bg-serene-neutral-50/50 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-5 w-5 animate-spin text-serene-neutral-400" />
          </div>
        ) : messages.length === 0 ? (
          <div className="flex items-center justify-center h-full text-serene-neutral-400 text-sm">
            No messages yet. Start the conversation!
          </div>
        ) : (
          <>
            {messages.map((msg, idx) => {
              const isOwn = msg.sender_id === currentUserId;
              const showTail = idx === 0 || messages[idx - 1].sender_id !== msg.sender_id;
              return (
                <MessageBubble 
                  key={msg.id} 
                  message={msg} 
                  isOwn={isOwn} 
                  showTail={showTail}
                />
              );
            })}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input */}
      <div className="p-2 border-t border-serene-neutral-100 flex items-center gap-2 relative">
        {showEmojiPicker && (
          <div className="absolute bottom-full left-0 mb-2 z-50">
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
          className="h-8 w-8 text-serene-neutral-400 hover:text-serene-blue-500"
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        >
          <Smile className="h-4 w-4" />
        </Button>
        
        <textarea
          ref={textareaRef}
          className="flex-1 bg-serene-neutral-50 border border-serene-neutral-200 rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-1 focus:ring-serene-blue-300"
          placeholder="Type a message..."
          rows={1}
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          onFocus={() => setShowEmojiPicker(false)}
        />
        
        <Button 
          size="icon"
          className="h-8 w-8 bg-serene-blue-500 hover:bg-serene-blue-600 rounded-lg"
          onClick={handleSend}
          disabled={!inputText.trim() || sending}
        >
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
