import { Chat, Message } from '@/types/chat';
import { useState, useEffect, useRef } from 'react';
import { getMessages, sendMessage } from '@/app/actions/chat';
import { fetchLinkMetadata } from '@/app/actions/chat-media';
import { createClient } from '@/utils/supabase/client';
import { MessageBubble } from './MessageBubble';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, Video, Search, MoreVertical, Smile, Paperclip, Mic, Send, X, Lock } from 'lucide-react';
import { ChatMediaDrawer } from './ChatMediaDrawer';
import { EmojiPicker } from './EmojiPicker';
import { AttachmentMenu } from './AttachmentMenu';
import { FilePreviewModal } from './FilePreviewModal';

interface ChatWindowProps {
  chat: Chat;
  onBack: () => void;
}

export function ChatWindow({ chat, onBack }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const [linkPreview, setLinkPreview] = useState<any>(null);
  
  // File Handling State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileType, setSelectedFileType] = useState<'image' | 'video' | 'document' | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  
  const supabase = createClient();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('there');
  const [isTyping, setIsTyping] = useState(false);

  // ... (User Data and Effect logic remains the same) ...
  // Fetch current user ID and Profile
  useEffect(() => {
    const getUserData = async () => {
       const { data: { user } } = await supabase.auth.getUser();
       if (user) {
           setCurrentUserId(user.id);
           const { data: profile } = await supabase.from('profiles').select('first_name').eq('id', user.id).single();
           if (profile?.first_name) setCurrentUserName(profile.first_name);
       }
    };
    getUserData();
  }, []);

  // Detect link in text
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

  // Load messages and subscribe
  useEffect(() => {
    loadMessages();

    const channel = supabase
      .channel(`chat:${chat.id}`)
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
          // Check if message ID already exists (optimistic update handling)
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
  }, [chat.id]);

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      if (chat.id === 'salama-ai-bot') {
          // Fake AI Bot logic preserved
          setMessages([]);
      } else {
          const data = await getMessages(chat.id);
          setMessages(data);
      }
      scrollToBottom();
    } catch (error) {
      console.error('Failed to load messages', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Bot Logic State
  const botSequenceStarted = useRef(false);

  // Reset bot sequence on chat change
  useEffect(() => {
     botSequenceStarted.current = false;
  }, [chat.id]);

  // Bot Logic preserved...
  useEffect(() => {
      if (chat.id === 'salama-ai-bot' && messages.length === 0 && !isLoading && !botSequenceStarted.current) {
          botSequenceStarted.current = true;
          const runSequence = async () => {
             setIsTyping(true);
             scrollToBottom();
             await new Promise(r => setTimeout(r, 6000));
             
             const welcomeMsg: Message = {
                 id: 'bot-welcome',
                 chat_id: 'salama-ai-bot',
                 sender_id: 'system',
                 content: `Hello ${currentUserName}, Welcome to Sauti Salama AI Chat.`,
                 type: 'text',
                 created_at: new Date().toISOString(),
                 metadata: {}
             };
             
             setMessages(prev => {
                 if (prev.some(m => m.id === 'bot-welcome')) return prev;
                 return [...prev, welcomeMsg];
             });
             
             setIsTyping(false); 
             scrollToBottom();

             setIsTyping(true);
             await new Promise(r => setTimeout(r, 1500)); 
             
             const infoMsg: Message = {
                 id: 'bot-info',
                 chat_id: 'salama-ai-bot',
                 sender_id: 'system',
                 content: `This feature is under development and is coming soon. Stay tuned!`,
                 type: 'text',
                 created_at: new Date().toISOString(),
                 metadata: {}
             };
             
             setMessages(prev => {
                if (prev.some(m => m.id === 'bot-info')) return prev;
                return [...prev, infoMsg];
             });
             setIsTyping(false);
             scrollToBottom();
          };
          runSequence();
      }
  }, [chat.id, isLoading, messages.length, currentUserName]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSend = async () => {
    if ((!inputText.trim() && !linkPreview) || sending) return;
    setSending(true);
    
    try {
      if (chat.id === 'salama-ai-bot') {
          // Fake Send preserved
          const userMsg: Message = {
              id: Date.now().toString(),
              chat_id: chat.id,
              sender_id: currentUserId || 'user',
              content: inputText,
              type: 'text',
              created_at: new Date().toISOString(),
              metadata: {}
          };
          setMessages(prev => [...prev, userMsg]);
          setInputText('');
          scrollToBottom();

          setTimeout(async () => {
              setIsTyping(true);
              scrollToBottom();
              await new Promise(r => setTimeout(r, 2000));
              
              const replyMsg: Message = {
                 id: Date.now().toString() + '-reply',
                 chat_id: 'salama-ai-bot',
                 sender_id: 'system',
                 content: `This feature is under development and is coming soon.`,
                 type: 'text',
                 created_at: new Date().toISOString(),
                 metadata: {}
             };
             setMessages(prev => [...prev, replyMsg]);
             setIsTyping(false);
             scrollToBottom();
          }, 500);

      } else {
        const metadata = linkPreview ? { link_preview: linkPreview } : {};
        await sendMessage(chat.id, inputText, 'text', metadata);
        setInputText('');
        setLinkPreview(null);
        // height reset logic handled by state change usually, but explicit reset in ref if needed
      }
    } catch (error) {
      console.error('Failed to send', error);
    } finally {
      setSending(false);
    }
  };

  const handleFileSelect = (file: File, type: 'image' | 'video' | 'document') => {
      setSelectedFile(file);
      setSelectedFileType(type);
      setIsPreviewOpen(true);
  };

  const handleSendFile = async (file: File, caption: string) => {
      setIsUploading(true);
      try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${chat.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('chat-media')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          const { data: signedData, error: signedError } = await supabase.storage
            .from('chat-media')
            .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year validity

          if (signedError) throw signedError;
          
          const attachment = {
              url: signedData.signedUrl,
              type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : 'file',
              name: file.name,
              size: file.size,
              path: fileName
          };

          let msgType: any = 'file';
          if (attachment.type === 'image') msgType = 'image';
          if (attachment.type === 'video') msgType = 'video';

          await sendMessage(chat.id, caption, msgType, {}, [attachment as any]);
          
          setIsPreviewOpen(false);
          setSelectedFile(null);
      } catch (err) {
          console.error('Upload failed', err);
          alert('Upload failed. Please try again.');
      } finally {
          setIsUploading(false);
      }
  };


  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Chat Info Logic
  const otherParticipant = chat.participants?.find((p) => p.user_id !== chat.created_by) || chat.participants?.[0]; 
  const meta = chat.metadata || {};
  const name = meta.name || `${otherParticipant?.user?.first_name || 'User'} ${otherParticipant?.user?.last_name || ''}`;
  const avatar = meta.image_url || otherParticipant?.user?.avatar_url;

  return (
    <div className="flex flex-col h-full bg-serene-neutral-50 relative w-full font-sans">
       {/* Background Pattern - subtle dots or just white/gray */}
       <div className="absolute inset-0 z-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(#000 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
       <div className="flex items-center justify-between px-6 py-4 bg-white/80 backdrop-blur-md border-b border-serene-neutral-200 z-10 shadow-sm">
         <div className="flex items-center gap-4">
           <Button variant="ghost" size="icon" className="md:hidden text-serene-neutral-500" onClick={(e) => { e.stopPropagation(); onBack(); }}>
             <span className="text-xl">←</span>
           </Button>
           <Avatar className="h-10 w-10 cursor-pointer ring-2 ring-white shadow-sm">
             <AvatarImage src={avatar} />
             <AvatarFallback className="bg-serene-blue-50 text-serene-blue-600">{name.charAt(0)}</AvatarFallback>
           </Avatar>
           <div className="flex flex-col">
             <span className="text-serene-neutral-900 font-bold leading-tight">{name}</span>
             {chat.id === 'salama-ai-bot' && <span className="text-xs text-serene-blue-600 font-medium flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-serene-blue-600 animate-pulse"/> AI Assistant</span>}
           </div>
         </div>
         <div className="flex items-center gap-1 text-serene-neutral-400">
           <Button variant="ghost" size="icon" className="rounded-full hover:bg-serene-neutral-50 hover:text-serene-blue-600" disabled title="Coming Soon"><Video className="h-5 w-5" /></Button>
           <Button variant="ghost" size="icon" className="rounded-full hover:bg-serene-neutral-50 hover:text-serene-blue-600" disabled title="Coming Soon"><Phone className="h-5 w-5" /></Button>
           <div className="w-[1px] h-6 bg-serene-neutral-200 mx-2" />
           <Button variant="ghost" size="icon" className="rounded-full hover:bg-serene-neutral-50 hover:text-serene-neutral-600" onClick={(e) => { e.stopPropagation(); setIsDrawerOpen(true); }}>
              <MoreVertical className="h-5 w-5" />
           </Button>
         </div>
       </div>

       {/* Appointment Banner */}
       {chat.metadata?.appointment_id && (
         <div className="bg-teal-50 border-b border-teal-100 p-2 flex items-center justify-between z-10 text-sm text-teal-900">
            <div className="flex items-center gap-2">
              <span className="font-semibold">📅 Upcoming Appointment</span>
              <span>- View details</span>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs border-teal-200 hover:bg-teal-100 text-teal-700">
              View
            </Button>
         </div>
       )}

       {/* Case File Banner */}
       {chat.metadata?.case_id && (
         <div className="bg-blue-50 border-b border-blue-100 p-2 flex items-center justify-between z-10 text-sm text-blue-900">
            <div className="flex items-center gap-2">
              <span className="font-semibold">📂 Case File</span>
              <span>- Review case details</span>
            </div>
            <Button variant="outline" size="sm" className="h-7 text-xs border-blue-200 hover:bg-blue-100 text-blue-700">
              View Case
            </Button>
         </div>
       )}

       {/* Messages */}
       <div className="flex-1 overflow-y-auto p-4 z-10 custom-scrollbar flex flex-col gap-2">
         {chat.id === 'salama-ai-bot' && messages.length > 0 && (
             <div className="flex justify-center my-4">
                 <div className="bg-white/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs text-serene-neutral-500 shadow-sm border border-serene-neutral-100 flex items-center gap-2">
                     <Lock className="h-3 w-3" /> Messages are generated by AI
                 </div>
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
         {/* Typing Indicator */}
         {isTyping && (
             <div className="flex justify-start mb-1 animate-in fade-in slide-in-from-left-2">
                 <div className="bg-white px-4 py-3 rounded-2xl rounded-tl-none shadow-sm flex items-center gap-1">
                     <span className="w-2 h-2 bg-serene-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                     <span className="w-2 h-2 bg-serene-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                     <span className="w-2 h-2 bg-serene-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                 </div>
             </div>
         )}
         <div ref={messagesEndRef} />
       </div>

       {/* Link Preview Floating */}
       {linkPreview && (
          <div className="z-20 p-2 m-2 bg-gray-50 rounded-lg border flex gap-3 shadow-lg max-w-sm self-center">
             {linkPreview.image && <img src={linkPreview.image} className="h-16 w-16 object-cover rounded" />}
             <div className="flex-1 min-w-0">
                <div className="font-bold text-sm truncate">{linkPreview.title}</div>
                <div className="text-xs text-gray-500 line-clamp-2">{linkPreview.description}</div>
             </div>
             <button onClick={() => setLinkPreview(null)}><X className="h-4 w-4" /></button>
          </div>
       )}

       {/* Input Area */}
       <div className="bg-white px-4 py-3 flex items-center gap-3 z-10 border-t border-serene-neutral-100 relative">
         {/* Emoji Picker Popover */}
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
           className={`text-serene-neutral-400 hover:text-serene-blue-500 hover:bg-serene-blue-50 rounded-full transition-colors ${showEmojiPicker ? 'bg-serene-blue-50 text-serene-blue-500' : ''}`}
           onClick={() => setShowEmojiPicker(!showEmojiPicker)}
         >
           <Smile className="h-6 w-6" />
         </Button>

         {/* Attachment Menu Replaces old Paperclip */}
         <AttachmentMenu onFileSelect={handleFileSelect} />
         
         <div className="flex-1 bg-serene-neutral-50 hover:bg-serene-neutral-100 transition-colors rounded-2xl flex items-end px-4 py-2 border border-transparent focus-within:border-serene-blue-200 focus-within:bg-white focus-within:ring-2 focus-within:ring-serene-blue-100">
           <textarea
             ref={(el) => {
                // @ts-ignore
                textareaRef.current = el;
                if (el) {
                    el.style.height = 'auto'; // Reset
                    el.style.height = el.scrollHeight + 'px';
                }
             }}
             className="flex-1 bg-transparent border-none outline-none text-serene-neutral-900 placeholder-serene-neutral-400 text-[15px] resize-none max-h-[120px] py-1"
             onFocus={() => setShowEmojiPicker(false)} 
             placeholder="Type a message..."
             rows={1}
             value={inputText}
             onChange={(e) => {
                setInputText(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
             }}
             onKeyDown={(e) => {
                if(e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend();
                }
             }}
           />
         </div>

         {inputText.trim() ? (
           <Button 
             onClick={handleSend} 
             disabled={sending}
             className="bg-serene-blue-600 hover:bg-serene-blue-700 text-white rounded-full h-12 w-12 flex items-center justify-center p-0 shadow-lg shadow-serene-blue-200 transition-all"
           >
             <Send className="h-5 w-5 ml-0.5" />
           </Button>
         ) : (
           <Button variant="ghost" size="icon" className="text-serene-neutral-400 hover:text-serene-blue-600 hover:bg-serene-blue-50 rounded-full transition-colors">
             <Mic className="h-6 w-6" />
           </Button>
         )}
       </div>

       <ChatMediaDrawer 
         chatId={chat.id} 
         isOpen={isDrawerOpen} 
         onClose={() => setIsDrawerOpen(false)} 
       />

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
