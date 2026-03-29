'use client';

import { useState, useEffect, useRef } from 'react';
import { Chat, Message, MessageType, transformChat } from '@/types/chat';
import { getMessages, sendMessage, markMessagesAsRead, getCaseChat } from '@/app/actions/chat';
import { fetchLinkMetadata } from '@/app/actions/chat-media';
import { createClient } from '@/utils/supabase/client';
import { MessageBubble } from './MessageBubble';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { 
  Send, 
  Smile, 
  Paperclip, 
  MoreVertical, 
  X, 
  Loader2,
  MessageSquare,
  Minimize2,
  Maximize2,
  Phone,
  Video,
  Lock
} from 'lucide-react';
import { EmojiPicker } from './EmojiPicker';
import { AttachmentMenu } from './AttachmentMenu';
import { FilePreviewModal } from './FilePreviewModal';
import { format } from 'date-fns';

interface CaseChatPanelProps {
  matchId: string;
  survivorId: string;
  professionalId: string;
  professionalName: string;
  survivorName: string;
  existingChatId?: string;
  onClose?: () => void;
  className?: string;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}

export function CaseChatPanel({
  matchId,
  survivorId,
  professionalId,
  professionalName,
  survivorName,
  existingChatId,
  onClose,
  className = '',
  isExpanded = false,
  onToggleExpand
}: CaseChatPanelProps) {
  const [chat, setChat] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [linkPreview, setLinkPreview] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const supabase = createClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Get current user
  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    getUser();
  }, []);

  // Initialize or load chat
  useEffect(() => {
    const initChat = async () => {
      setIsLoading(true);
      try {
        if (existingChatId) {
          // Load existing chat
          const { data: chatData } = await supabase
            .from('chats')
            .select(`
              *,
              participants:chat_participants(
                *,
                user:profiles(*)
              )
            `)
            .eq('id', existingChatId)
            .single();

          if (chatData) {
            setChat(transformChat(chatData));
            const msgs = await getMessages(existingChatId);
            setMessages(msgs);
            markMessagesAsRead(existingChatId);
          }
        } else {
          // Create or get case chat
          const chatData = await getCaseChat(matchId, survivorId);
          setChat(chatData);
          if (chatData) {
            const msgs = await getMessages(chatData.id);
            setMessages(msgs);
            markMessagesAsRead(chatData.id);
          }
        }
      } catch (error) {
        console.error('Failed to init chat:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initChat();
  }, [matchId, existingChatId, survivorId]);

  // Subscribe to new messages
  useEffect(() => {
    if (!chat?.id) return;

    const channel = supabase
      .channel(`case-chat:${chat.id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `chat_id=eq.${chat.id}`
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages(prev => {
            // Already in list?
            if (prev.find(m => m.id === newMsg.id)) return prev;

            // If from current user, check if we can replace a temp message
            if (newMsg.sender_id === currentUserId) {
              const tempMessageIndex = prev.findIndex(m => 
                m.id.startsWith('temp-') && 
                m.content === newMsg.content
              );
              
              if (tempMessageIndex !== -1) {
                const updatedMessages = [...prev];
                updatedMessages[tempMessageIndex] = newMsg;
                return updatedMessages;
              }
            }

            return [...prev, newMsg];
          });
          scrollToBottom();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [chat?.id]);

  // Detect links in text
  useEffect(() => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const match = inputText.match(urlRegex);
    if (match && match[0] && !linkPreview) {
      fetchLinkMetadata(match[0]).then(meta => {
        if (meta) setLinkPreview(meta);
      });
    } else if (!match) {
      setLinkPreview(null);
    }
  }, [inputText]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSend = async () => {
    if ((!inputText.trim() && !linkPreview) || sending || !chat || !currentUserId) return;
    
    const tempId = `temp-${Date.now()}`;
    const newMessage: Message = {
      id: tempId,
      chat_id: chat.id,
      sender_id: currentUserId,
      content: inputText,
      type: 'text',
      metadata: linkPreview ? { link_preview: linkPreview } : {},
      created_at: new Date().toISOString(),
      is_read: true
    };

    // Optimistic update
    setMessages(prev => [...prev, newMessage]);
    const previousInput = inputText;
    const previousPreview = linkPreview;
    
    setInputText('');
    setLinkPreview(null);
    scrollToBottom();

    try {
      const metadata = previousPreview ? { link_preview: previousPreview } : {};
      await sendMessage(chat.id, previousInput, 'text', metadata);
    } catch (error) {
      console.error('Failed to send:', error);
      // Rollback on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setInputText(previousInput);
      setLinkPreview(previousPreview);
    } finally {
      // No need to setSending(false) here as it's optimistic
    }
  };

  const handleFileSelect = (file: File, type: 'image' | 'video' | 'document') => {
    setSelectedFile(file);
    setIsPreviewOpen(true);
  };

  const handleSendFile = async (file: File, caption: string) => {
    if (!chat) return;
    setIsUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${chat.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: signedData } = await supabase.storage
        .from('chat-media')
        .createSignedUrl(fileName, 60 * 60 * 24 * 365);

      const attachment = {
        url: signedData?.signedUrl || '',
        type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file',
        name: file.name,
        size: file.size,
        path: fileName
      };

      let msgType: MessageType = 'file';
      if (attachment.type === 'image') msgType = 'image';
      if (attachment.type === 'video') msgType = 'video';

      await sendMessage(chat.id, caption, msgType, {}, [attachment as any]);

      setIsPreviewOpen(false);
      setSelectedFile(null);
      scrollToBottom();
    } catch (err) {
      console.error('Upload failed:', err);
    } finally {
      setIsUploading(false);
    }
  };

  const otherPartyName = currentUserId === professionalId ? survivorName : professionalName;

  // Render loading state
  if (isLoading) {
    return (
      <div className={`flex flex-col bg-white rounded-2xl border border-serene-neutral-100 shadow-sm overflow-hidden ${className}`}>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-serene-blue-500" />
        </div>
      </div>
    );
  }

  // Render no chat state
  if (!chat) {
    return (
      <div className={`flex flex-col bg-white rounded-2xl border border-serene-neutral-100 shadow-sm overflow-hidden ${className}`}>
        <div className="flex flex-col items-center justify-center h-64 text-center p-6">
          <MessageSquare className="h-12 w-12 text-serene-neutral-300 mb-4" />
          <h3 className="font-bold text-serene-neutral-700 mb-2">Chat Unavailable</h3>
          <p className="text-sm text-serene-neutral-500">
            Chat will be available once the match is confirmed.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col bg-white rounded-2xl border border-serene-neutral-100 shadow-sm overflow-hidden ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-serene-blue-50 to-serene-blue-100/30 border-b border-serene-neutral-100">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 ring-2 ring-white shadow-sm">
            <AvatarFallback className="bg-serene-blue-100 text-serene-blue-600 font-bold text-sm">
              {otherPartyName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div>
            <h4 className="font-semibold text-serene-neutral-900 text-sm leading-tight">{otherPartyName}</h4>
            <p className="text-xs text-serene-neutral-500">Case Chat</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-serene-neutral-400 hover:text-serene-blue-600" disabled>
            <Phone className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-serene-neutral-400 hover:text-serene-blue-600" disabled>
            <Video className="h-4 w-4" />
          </Button>
          {onToggleExpand && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-serene-neutral-400 hover:text-serene-neutral-600" onClick={onToggleExpand}>
              {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </Button>
          )}
          {onClose && (
            <Button variant="ghost" size="icon" className="h-8 w-8 text-serene-neutral-400 hover:text-red-500" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className={`flex-1 overflow-y-auto p-4 space-y-2 bg-serene-neutral-50/50 ${isExpanded ? 'h-[500px]' : 'h-[300px]'}`}>
        {/* Security notice */}
        <div className="flex justify-center mb-4">
          <div className="bg-white/80 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs text-serene-neutral-500 shadow-sm border border-serene-neutral-100 flex items-center gap-2">
            <Lock className="h-3 w-3" />
            Messages are end-to-end encrypted
          </div>
        </div>

        {/* Date separator for first message */}
        {messages.length > 0 && (
          <div className="flex justify-center mb-4">
            <span className="text-xs text-serene-neutral-400 bg-white px-3 py-1 rounded-full shadow-sm border border-serene-neutral-100">
              {format(new Date(messages[0].created_at), 'MMMM d, yyyy')}
            </span>
          </div>
        )}

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
      </div>

      {/* Link Preview */}
      {linkPreview && (
        <div className="px-4 py-2 bg-serene-neutral-50 border-t border-serene-neutral-100">
          <div className="flex gap-3 items-center bg-white p-2 rounded-lg border border-serene-neutral-200">
            {linkPreview.image && (
              <img src={linkPreview.image} className="h-12 w-12 object-cover rounded" alt="" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm truncate">{linkPreview.title}</p>
              <p className="text-xs text-serene-neutral-500 truncate">{linkPreview.url}</p>
            </div>
            <button onClick={() => setLinkPreview(null)} className="text-serene-neutral-400 hover:text-serene-neutral-600">
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex items-center gap-2 p-3 bg-white border-t border-serene-neutral-100 relative">
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
          className={`h-9 w-9 rounded-full text-serene-neutral-400 hover:text-serene-blue-500 ${showEmojiPicker ? 'bg-serene-blue-50 text-serene-blue-500' : ''}`}
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
        >
          <Smile className="h-5 w-5" />
        </Button>

        <AttachmentMenu onFileSelect={handleFileSelect} />

        <div className="flex-1 bg-serene-neutral-50 rounded-xl px-3 py-2 border border-transparent focus-within:border-serene-blue-200 focus-within:bg-white transition-all">
          <textarea
            ref={textareaRef}
            className="w-full bg-transparent border-none outline-none text-sm resize-none max-h-[80px] text-serene-neutral-900 placeholder:text-serene-neutral-400"
            placeholder="Type a message..."
            rows={1}
            value={inputText}
            onChange={(e) => {
              setInputText(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = e.target.scrollHeight + 'px';
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            onFocus={() => setShowEmojiPicker(false)}
          />
        </div>

        <Button
          onClick={handleSend}
          disabled={!inputText.trim() || sending}
          size="icon"
          className={`h-9 w-9 rounded-full transition-all ${
            inputText.trim()
              ? 'bg-serene-blue-600 hover:bg-serene-blue-700 text-white shadow-md'
              : 'bg-serene-neutral-100 text-serene-neutral-400'
          }`}
        >
          {sending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Send className="h-4 w-4" />
          )}
        </Button>
      </div>

      {/* File Preview Modal */}
      <FilePreviewModal
        isOpen={isPreviewOpen}
        onClose={() => {
          setIsPreviewOpen(false);
          setSelectedFile(null);
        }}
        file={selectedFile}
        onSend={handleSendFile}
        isSending={isUploading}
      />
    </div>
  );
}
