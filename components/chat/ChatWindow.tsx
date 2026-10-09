import { Chat, Message } from '@/types/chat';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useState, useEffect, useRef, useOptimistic, startTransition } from 'react';
import { getMessages, sendMessage } from '@/app/actions/chat';
import { deleteMessage, getAssistantHistory, clearAssistantHistory } from '@/app/actions/chat-social';
import { getCommunityDetails } from '@/app/actions/community-admin';
import { MemberProfileSheet } from './MemberProfileSheet';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { markMessagesAsRead } from '@/lib/chat/client-read';
import { fetchLinkMetadata } from '@/app/actions/chat-media';
import { createClient } from '@/utils/supabase/client';
import { MessageBubble } from './MessageBubble';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Phone, Video, Search, MoreVertical, Smile, ShieldCheck, Mic, Send, X, Lock, ArrowLeft, FileText  } from 'lucide-react';
import { ChatMediaDrawer } from './ChatMediaDrawer';
import { EmojiPicker } from './EmojiPicker';
import { AttachmentMenu } from './AttachmentMenu';
import { FilePreviewModal } from './FilePreviewModal';
import { format } from 'date-fns';
import { usePathname } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { History, User, Shield, Info } from 'lucide-react';

interface ChatWindowProps {
  chat: Chat;
  onBack: () => void;
}

export function ChatWindow({ chat, onBack }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [optimisticMessages, addOptimisticMessage] = useOptimistic(
    messages,
    (state: Message[], newMessage: Message) => {
        // Check for duplicates in optimistic state (e.g. if real-time update arrived simultaneously)
        if (state.find(m => m.id === newMessage.id)) return state;
        return [...state, newMessage];
    }
  );

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
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [profileUserId, setProfileUserId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Message | null>(null);
  const [groupRole, setGroupRole] = useState<'admin' | 'moderator' | 'member' | null>(null);

  const supabase = createClient();
  const { toast } = useToast();
  const loadToken = useRef(0);
  const aiAbort = useRef<AbortController | null>(null);
  const isBot = chat.id === 'salama-ai-bot';
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>('there');
  const [isTyping, setIsTyping] = useState(false);
  const pathname = usePathname();
  const isCaseDetailPage = pathname.includes('/dashboard/cases/');
  const isReportDetailPage = pathname.includes('/dashboard/reports/');
  const [isOwner, setIsOwner] = useState(false);
  const [sharedMatches, setSharedMatches] = useState<any[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  useEffect(() => {
    const getUserData = async () => {
       const { data: { user } } = await supabase.auth.getUser();
       if (user) {
           setCurrentUserId(user.id);
           const { data: profile } = await supabase.from('profiles').select('first_name, last_name').eq('id', user.id).single();
           if (profile?.first_name) setCurrentUserName(profile.first_name);

           // Fetch chat ownership/role context
           const { data: creator } = await supabase.from('chats').select('created_by').eq('id', chat.id).single();
           setIsOwner(creator?.created_by === user.id);

           // Fetch Shared Match History
           fetchMatchHistory(user.id);
       }
    };
    getUserData();
  }, [chat.id]);

  const fetchMatchHistory = async (userId: string) => {
      setIsLoadingHistory(true);
      try {
          const otherId = chat.participants?.find(p => p.user_id !== userId)?.user_id;
          if (!otherId) return;

          const { data } = await supabase
            .from('matched_services')
            .select(`
                *,
                report:reports(type_of_incident, report_id, user_id)
            `)
            .or(`survivor_id.eq.${userId},survivor_id.eq.${otherId}`)
            .order('match_date', { ascending: false });

          if (data) {
              // Filter for matches involving both parties
              const filtered = data.filter((m: any) => {
                  const profId = (m as any).support_services?.user_id || (m as any).hrd_profile_id;
                  return (m.survivor_id === userId && profId === otherId) ||
                         (m.survivor_id === otherId && profId === userId);
              });
              setSharedMatches(filtered);
          }
      } catch (e) {
          console.error('History fetch failed', e);
      } finally {
          setIsLoadingHistory(false);
      }
  };

  const isGroup = chat.type === 'community' || chat.type === 'group' || !!chat.metadata?.is_community;
  useEffect(() => {
    setGroupRole(null);
    if (chat.type !== 'community' && !chat.metadata?.is_community) return;
    getCommunityDetails(chat.id).then((d) => setGroupRole(d?.myRole ?? null)).catch(() => undefined);
  }, [chat.id]);

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
    // Never show the previous chat's messages while the next one loads.
    setMessages([]);
    aiAbort.current?.abort();
    setIsTyping(false);
    loadMessages();
    if (isBot) return;

    const ids = chat.metadata?.all_chat_ids || [chat.id];
    const channels = ids.map(id => {
        return supabase
          .channel(`chat:${id}:${Math.random().toString(36).slice(2)}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `chat_id=eq.${id}`
            },
            (payload) => {
              const newMsg = payload.new as Message;
              // Dedupe: our own sends are added when the server action resolves.
              setMessages(prev => (prev.some(m => m.id === newMsg.id) ? prev : [...prev, newMsg]));
              scrollToBottom();
              if (newMsg.sender_id !== currentUserIdRef.current) {
                markMessagesAsRead(id).catch(() => undefined);
              }
            }
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'messages', filter: `chat_id=eq.${id}` },
            (payload) => {
              // Reactions and server-fetched link previews arrive as updates to an existing message.
              const next = payload.new as Message;
              setMessages(prev => prev.map(m => (m.id === next.id ? { ...m, reactions: next.reactions, metadata: next.metadata, read_by: next.read_by, delivered_at: next.delivered_at, is_deleted: next.is_deleted, content: next.content, attachments: next.attachments } : m)));
            }
          )
          .subscribe();
    });

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
      aiAbort.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chat.id, JSON.stringify(chat.metadata?.all_chat_ids ?? null)]);

  const loadMessages = async () => {
    const token = ++loadToken.current;
    setIsLoading(true);
    try {
      if (isBot) {
          // Salama remembers: restore the saved conversation (the greeting only shows on an empty one).
          const [saved, { data: { user: me } }] = await Promise.all([getAssistantHistory(), supabase.auth.getUser()]);
          if (token !== loadToken.current) return;
          setMessages(saved.map((h) => ({
            id: h.id,
            chat_id: 'salama-ai-bot',
            sender_id: h.role === 'assistant' ? 'system' : (me?.id || 'user'),
            content: h.content,
            type: 'text',
            created_at: h.created_at,
            metadata: {},
          }) as Message));
      } else {
          // Use all_chat_ids if available to get full consolidated history
          const idsToFetch = chat.metadata?.all_chat_ids || chat.id;
          const data = await getMessages(idsToFetch);
          if (token !== loadToken.current) return; // a newer load superseded this one
          setMessages(data);
          // Mark as read immediately on load
          if (Array.isArray(idsToFetch)) {
              idsToFetch.forEach(id => markMessagesAsRead(id).catch(err => console.error('Failed to mark read', id, err)));
          } else {
              markMessagesAsRead(idsToFetch).catch(err => console.error('Failed to mark read', err));
          }
      }
      scrollToBottom();
    } catch (error) {
      if (token !== loadToken.current) return;
      console.error('Failed to load messages', error);
      toast({ title: "Couldn't load messages", description: 'Check your connection and try again.', variant: 'destructive' });
    } finally {
      if (token === loadToken.current) setIsLoading(false);
    }
  };

  // Salama (AI assistant): greet once per open.
  const botGreeted = useRef(false);
  useEffect(() => {
    botGreeted.current = false;
  }, [chat.id]);
  useEffect(() => {
    if (!isBot || isLoading || botGreeted.current || messages.length > 0) return;
    botGreeted.current = true;
    setMessages([{
      id: 'bot-welcome',
      chat_id: 'salama-ai-bot',
      sender_id: 'system',
      content: `Hello ${currentUserName}, I'm Salama, an AI assistant. I can share information about your options, rights and safety, and help you prepare for a counsellor, clinic or police visit. I'm not a replacement for a professional.\n\nIf you are in danger right now, call **999** or the free GBV helpline **1195**.`,
      type: 'text',
      created_at: new Date().toISOString(),
      metadata: {}
    } as Message]);
  }, [isBot, isLoading, messages.length, currentUserName, chat.id]);

  const currentUserIdRef = useRef<string | null>(null);
  useEffect(() => {
    currentUserIdRef.current = currentUserId;
  }, [currentUserId]);

  /** Stream a reply from /api/assistant into a single growing message. */
  const askAssistant = async (history: Message[]) => {
    aiAbort.current?.abort();
    const controller = new AbortController();
    aiAbort.current = controller;
    const replyId = `bot-${Date.now()}`;
    setIsTyping(true);
    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          messages: history
            .filter(m => m.id !== 'bot-welcome' && m.content)
            .map(m => ({ role: m.sender_id === 'system' ? 'assistant' : 'user', content: m.content }))
        })
      });
      if (!res.ok || !res.body) {
        const err = await res.json().catch(() => null);
        throw new Error(err?.error || 'Salama is unavailable right now.');
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let text = '';
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        text += decoder.decode(value, { stream: true });
        setIsTyping(false);
        setMessages(prev => {
          const reply = { id: replyId, chat_id: 'salama-ai-bot', sender_id: 'system', content: text, type: 'text', created_at: new Date().toISOString(), metadata: {} } as Message;
          return prev.some(m => m.id === replyId) ? prev.map(m => (m.id === replyId ? reply : m)) : [...prev, reply];
        });
        scrollToBottom();
      }
      if (!text.trim()) throw new Error('Salama did not reply. Please try again.');
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      toast({ title: 'Salama could not reply', description: e instanceof Error ? e.message : 'Please try again.', variant: 'destructive' });
    } finally {
      setIsTyping(false);
    }
  };

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  const handleSend = async () => {
    const text = inputText.trim();
    if ((!text && !linkPreview) || sending) return;

    const previousInput = inputText;
    const previousPreview = linkPreview;
    const tempId = `temp-${Date.now()}`;
    const pendingMsg: Message = {
        id: tempId,
        chat_id: chat.id,
        sender_id: currentUserId || 'user',
        content: text,
        type: 'text',
        created_at: new Date().toISOString(),
        metadata: previousPreview ? { link_preview: previousPreview } : {},
        is_read: true
    };

    // Clear the composer immediately (restored below if sending fails).
    setInputText('');
    setLinkPreview(null);
    scrollToBottom();

    if (isBot) {
      const userMsg = { ...pendingMsg, id: `user-${Date.now()}` } as Message;
      const history = [...messages, userMsg];
      setMessages(history);
      void askAssistant(history);
      return;
    }

    setSending(true);
    startTransition(() => addOptimisticMessage(pendingMsg));
    try {
      const saved = await sendMessage(chat.id, text, 'text', pendingMsg.metadata);
      // Commit the real row now; the realtime event for it is deduped by id.
      // The server attaches the verified preview a moment later (arrives as an update); show the composer's meanwhile.
      const shown = previousPreview ? { ...saved, metadata: { ...((saved.metadata as object) || {}), link_preview: previousPreview } } : saved;
      setMessages(prev => (prev.some(m => m.id === saved.id) ? prev : [...prev, shown as Message]));
    } catch (error) {
      console.error('Failed to send', error);
      setInputText(previousInput);
      setLinkPreview(previousPreview);
      toast({ title: 'Message not sent', description: 'Check your connection and try again. Your text is still in the box.', variant: 'destructive' });
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
      setUploadProgress(0);
      try {
          const fileExt = file.name.split('.').pop();
          const fileName = `${chat.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;

          // Direct upload with real progress (the storage client has no progress callback).
          const { data: target, error: targetError } = await supabase.storage.from('chat-media').createSignedUploadUrl(fileName);
          if (targetError || !target) throw targetError || new Error('Could not start the upload');
          await new Promise<void>((resolve, reject) => {
              const xhr = new XMLHttpRequest();
              xhr.open('PUT', target.signedUrl);
              xhr.upload.onprogress = (e) => {
                  if (e.lengthComputable) setUploadProgress(Math.min(99, Math.round((e.loaded / e.total) * 100)));
              };
              xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Upload failed (${xhr.status})`)));
              xhr.onerror = () => reject(new Error('Network error during upload'));
              xhr.onabort = () => reject(new Error('Upload cancelled'));
              const body = new FormData();
              body.append('cacheControl', '3600');
              body.append('', file);
              xhr.send(body);
          });
          setUploadProgress(100);

          const { data: signedData, error: signedError } = await supabase.storage
            .from('chat-media')
            .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year validity
          if (signedError) throw signedError;

          const attachment = {
              url: signedData.signedUrl,
              type: file.type.startsWith('image/') ? 'image' : file.type.startsWith('video/') ? 'video' : file.type.startsWith('audio/') ? 'audio' : 'file',
              name: file.name,
              size: file.size,
              path: fileName
          };

          let msgType: any = 'file';
          if (attachment.type === 'image') msgType = 'image';
          if (attachment.type === 'video') msgType = 'video';
          if (attachment.type === 'audio') msgType = 'audio';

          const saved = await sendMessage(chat.id, caption, msgType, {}, [attachment as any]);
          setMessages(prev => (prev.some(m => m.id === saved.id) ? prev : [...prev, saved]));
          scrollToBottom();

          setIsPreviewOpen(false);
          setSelectedFile(null);
      } catch (err) {
          console.error('Upload failed', err);
          toast({ title: 'Upload failed', description: 'Check your connection and try again.', variant: 'destructive' });
      } finally {
          setIsUploading(false);
          setUploadProgress(null);
      }
  };

  const confirmDelete = async () => {
      const target = pendingDelete;
      setPendingDelete(null);
      if (!target) return;
      // Show it as deleted straight away; the server confirms (and restores it if that fails).
      const before = messages;
      setMessages(prev => prev.map(m => (m.id === target.id ? { ...m, is_deleted: true, content: '', attachments: null, reactions: {}, metadata: { deleted_by: currentUserId } as any } : m)));
      try {
          await deleteMessage(target.id);
      } catch (e) {
          setMessages(before);
          toast({ title: 'Could not delete', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
      }
  };

  const handleClearBot = async () => {
      if (!window.confirm('Clear your conversation with Salama? This cannot be undone.')) return;
      try {
          await clearAssistantHistory();
          botGreeted.current = false;
          setMessages([]);
      } catch {
          toast({ title: 'Could not clear the conversation', variant: 'destructive' });
      }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Chat Info Logic
  // Filter out the current user to find the other party
  const otherParticipant = chat.participants?.find((p) => p.user_id !== currentUserId) || chat.participants?.[0];
  const meta = chat.metadata || {};
  const name = meta.name || `${otherParticipant?.user?.first_name || 'User'} ${otherParticipant?.user?.last_name || ''}`;
  const avatar = meta.image_url || otherParticipant?.user?.avatar_url;
  const senderOf = (id: string) => {
    const u = chat.participants?.find((p) => p.user_id === id)?.user;
    return u ? { name: `${u.first_name || ''} ${u.last_name || ''}`.trim() || 'Member', avatar: u.avatar_url || null } : undefined;
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-serene-neutral-50 to-white relative w-full font-sans">
       {/* Background Pattern - subtle and premium */}
       <div className="absolute inset-0 z-0 opacity-[0.02]" style={{ backgroundImage: 'radial-gradient(#374151 0.5px, transparent 0.5px)', backgroundSize: '24px 24px' }}></div>

       {/* Header - Premium Glassmorphism */}
       <div className="flex items-center justify-between px-3 md:px-5 pb-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] bg-white/70 backdrop-blur-xl border-b border-serene-neutral-100/80 z-10 shadow-sm">
         <div className="flex items-center gap-3">
           <Button
             variant="ghost"
             size="icon"
             aria-label="Back to chats" className="md:hidden touch-manipulation text-serene-neutral-500 hover:text-serene-neutral-700 hover:bg-serene-neutral-100 rounded-full h-11 w-11 -ml-1"
             onClick={(e) => { e.stopPropagation(); onBack(); }}
           >
             <ArrowLeft className="h-5 w-5" />
           </Button>
           <button type="button" onClick={() => !isBot && setIsDrawerOpen(true)} className="flex items-center gap-3 text-left touch-manipulation" aria-label="Open chat details">
           <Avatar className="h-11 w-11 cursor-pointer ring-2 ring-white shadow-md transition-transform hover:scale-105">
             <AvatarImage src={avatar} />
             <AvatarFallback className="bg-gradient-to-br from-serene-blue-100 to-serene-blue-50 text-serene-blue-600 font-bold">{name.charAt(0)}</AvatarFallback>
           </Avatar>
           <div className="flex flex-col">
             <span className="text-serene-neutral-900 font-bold leading-tight text-[15px]">{name}</span>
             {chat.id === 'salama-ai-bot' ? (
               <span className="text-xs text-serene-blue-600 font-medium flex items-center gap-1.5">
                 <span className="w-2 h-2 rounded-full bg-serene-blue-500 animate-pulse"/> AI Assistant
               </span>
             ) : isGroup ? (
               <span className="text-xs text-serene-neutral-400">{chat.participants?.length ? `${chat.participants.length} members · tap for group info` : 'Tap for group info'}</span>
             ) : (
               <span className="text-xs text-serene-neutral-400">{(otherParticipant?.user as any)?.user_type ? String((otherParticipant?.user as any).user_type).replace(/_/g, ' ') : 'Secure chat'}</span>
             )}
           </div>
           </button>
         </div>
         <div className="flex items-center gap-0.5">
           <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 text-serene-neutral-400 hover:bg-serene-blue-50 hover:text-serene-blue-600 transition-all" disabled title="Coming Soon">
             <Video className="h-5 w-5" />
           </Button>
           <Button variant="ghost" size="icon" className="rounded-full h-10 w-10 text-serene-neutral-400 hover:bg-serene-blue-50 hover:text-serene-blue-600 transition-all" disabled title="Coming Soon">
             <Phone className="h-5 w-5" />
           </Button>
           <div className="w-px h-7 bg-serene-neutral-200 mx-1.5" />

           <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="rounded-full h-10 w-10 text-serene-neutral-400 hover:bg-serene-neutral-100 hover:text-serene-neutral-600 transition-all"
                >
                   <MoreVertical className="h-5 w-5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 rounded-2xl p-2 shadow-2xl border-serene-neutral-100 bg-white">
                <DropdownMenuLabel className="px-3 py-2 text-xs font-bold text-serene-neutral-400 uppercase tracking-widest">Chat Options</DropdownMenuLabel>
                {isBot ? (
                  <DropdownMenuItem onClick={handleClearBot} className="rounded-xl px-3 py-2.5 cursor-pointer gap-3 text-red-600 focus:text-red-600">
                    <X className="h-4 w-4" />
                    <span className="font-medium">Clear conversation</span>
                  </DropdownMenuItem>
                ) : (
                <DropdownMenuItem onClick={() => setIsDrawerOpen(true)} className="rounded-xl px-3 py-2.5 cursor-pointer hover:bg-serene-neutral-50 gap-3">
                  <Info className="h-4 w-4 text-serene-neutral-400" />
                  <span className="font-medium text-serene-neutral-700">{isGroup ? 'Group info, media and members' : 'Chat Media & Info'}</span>
                </DropdownMenuItem>
                )}

                <DropdownMenuSeparator className="my-2 bg-serene-neutral-100" />

                <DropdownMenuLabel className="px-3 py-2 text-xs font-bold text-serene-neutral-400 uppercase tracking-widest flex items-center gap-2">
                  <History className="h-3 w-3" /> Shared {isOwner ? 'Reports' : 'Cases'}
                </DropdownMenuLabel>

                {isLoadingHistory ? (
                   <DropdownMenuItem className="px-3 py-2 text-xs text-serene-neutral-400 animate-pulse">Loading history...</DropdownMenuItem>
                ) : sharedMatches.length === 0 ? (
                   <DropdownMenuItem className="px-3 py-2 text-xs text-serene-neutral-400 italic">No shared history found</DropdownMenuItem>
                ) : (
                  sharedMatches.map(match => (
                    <DropdownMenuItem
                      key={match.id}
                      asChild
                      className="rounded-xl px-3 py-2.5 cursor-pointer hover:bg-serene-blue-50 group"
                    >
                      <Link href={`/dashboard/${isOwner ? 'reports' : 'cases'}/${match.id}`} className="flex flex-col items-start gap-0.5">
                        <div className="flex items-center gap-2 w-full">
                          <span className="font-bold text-serene-neutral-800 text-[13px] truncate">
                            {match.report?.type_of_incident?.replace(/_/g, ' ') || 'Support Context'}
                          </span>
                          <Badge variant="outline" className="ml-auto text-[8px] bg-white border-serene-neutral-100 text-serene-neutral-400 font-bold uppercase py-0 px-1">
                            {match.match_status_type}
                          </Badge>
                        </div>
                        <span className="text-[10px] text-serene-neutral-400 font-medium">
                          {format(new Date(match.match_date), 'PPP')}
                        </span>
                      </Link>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
           </DropdownMenu>
         </div>
       </div>

         {/* Dynamic Context Pin - Sticky & Premium */}
         {(chat.metadata?.case_id || chat.metadata?.report_id) && (
           <div className="bg-white/80 backdrop-blur-md border-b border-serene-neutral-100/50 px-4 py-2.5 flex items-center justify-between z-10 animate-in fade-in slide-in-from-top-1">
              <div className="flex items-center gap-3 pl-1">
                <div className={cn(
                  "p-2 rounded-xl",
                  isOwner ? "bg-teal-50 text-teal-600" : "bg-serene-blue-50 text-serene-blue-600"
                )}>
                  {isOwner ? <ShieldCheck className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-serene-neutral-400 uppercase tracking-widest">{isOwner ? 'Report Journey' : 'Case Context'}</span>
                  <span className="text-[13px] font-bold text-serene-neutral-800 leading-tight">
                    {sharedMatches.find(m => m.id === (chat.metadata?.case_id || chat.metadata?.report_id))?.report?.type_of_incident?.replace(/_/g, ' ') || 'Active Session'}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {!isCaseDetailPage && !isReportDetailPage && (
                  <Button asChild variant="outline" size="sm" className={cn(
                    "h-8 text-[11px] font-bold px-4 rounded-xl shadow-sm transition-all hover:scale-105 active:scale-95",
                    isOwner ? "border-teal-100 text-teal-700 hover:bg-teal-50" : "border-serene-blue-100 text-serene-blue-700 hover:bg-serene-blue-50"
                  )}>
                    <Link href={`/dashboard/${isOwner ? 'reports' : 'cases'}/${chat.metadata?.case_id || chat.metadata?.report_id}`}>
                      {isOwner ? 'View Journey' : 'View Case'}
                    </Link>
                  </Button>
                )}
              </div>
           </div>
         )}

       {/* Out of Office Warning */}
       {(otherParticipant?.user as any)?.out_of_office && (
           <div className="bg-amber-50 border-b border-amber-100 p-2 flex items-center justify-center z-10 text-sm text-amber-900 gap-2">
                <span>⚠️ <b>{name}</b> is currently Out of Office. Replies may be delayed.</span>
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
         {optimisticMessages.map((msg, idx) => {
           const isOwn = msg.sender_id === currentUserId;
           const showTail = idx === 0 || optimisticMessages[idx - 1].sender_id !== msg.sender_id;
           return (
             <MessageBubble
               key={msg.id}
               message={msg}
               isOwn={isOwn}
               showTail={showTail}
               currentUserId={currentUserId || undefined}
               showSender={isGroup && msg.type !== 'system'}
               senderName={senderOf(msg.sender_id)?.name}
               senderAvatar={senderOf(msg.sender_id)?.avatar}
               onOpenProfile={setProfileUserId}
               recipientCount={Math.max(1, (chat.participants?.length ?? 2) - 1)}
               onDelete={!isBot && !msg.id.startsWith('temp') && (isOwn || groupRole === 'admin' || groupRole === 'moderator') ? setPendingDelete : undefined}
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

       {/* Input Area - Premium Design */}
       <div className="bg-white/80 backdrop-blur-xl px-4 py-3 flex items-end gap-2 z-10 border-t border-serene-neutral-100/80 relative">
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
           className={`text-serene-neutral-400 hover:text-serene-blue-500 hover:bg-serene-blue-50 rounded-full h-10 w-10 transition-all flex-shrink-0 ${showEmojiPicker ? 'bg-serene-blue-50 text-serene-blue-500' : ''}`}
           onClick={() => setShowEmojiPicker(!showEmojiPicker)}
         >
           <Smile className="h-5 w-5" />
         </Button>

         {/* Attachment Menu */}
         <AttachmentMenu onFileSelect={handleFileSelect} />

         <div className="flex-1 bg-serene-neutral-50/80 hover:bg-serene-neutral-100/80 transition-all rounded-2xl flex items-end px-4 py-2.5 border border-serene-neutral-100 focus-within:border-serene-blue-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-serene-blue-100 focus-within:shadow-sm">
           <textarea
             ref={(el) => {
                // @ts-ignore
                textareaRef.current = el;
                if (el) {
                    el.style.height = 'auto'; // Reset
                    el.style.height = el.scrollHeight + 'px';
                }
             }}
             className="flex-1 bg-transparent border-none outline-none text-serene-neutral-900 placeholder-serene-neutral-400 text-base md:text-[15px] resize-none max-h-[120px] py-0.5 leading-relaxed"
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
             aria-label="Send message"
             className="bg-gradient-to-r from-serene-blue-600 to-serene-blue-500 hover:from-serene-blue-700 hover:to-serene-blue-600 text-white rounded-full h-11 w-11 flex items-center justify-center p-0 shadow-lg shadow-serene-blue-200/50 transition-all hover:scale-105 active:scale-95 flex-shrink-0"
           >
             <Send className="h-5 w-5 ml-0.5" />
           </Button>
         ) : null}
       </div>

       <ChatMediaDrawer
         chatId={chat.id}
         chat={chat}
         currentUserId={currentUserId}
         isOpen={isDrawerOpen}
         onClose={() => setIsDrawerOpen(false)}
         onOpenProfile={(id) => setProfileUserId(id)}
         onLeft={onBack}
       />

       <MemberProfileSheet
         userId={profileUserId}
         chatId={chat.id}
         currentUserId={currentUserId}
         onClose={() => setProfileUserId(null)}
       />

       <AlertDialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
         <AlertDialogContent>
           <AlertDialogHeader>
             <AlertDialogTitle>Delete this message?</AlertDialogTitle>
             <AlertDialogDescription>
               It will be removed for everyone in the chat. They will see that a message was deleted.
             </AlertDialogDescription>
           </AlertDialogHeader>
           <AlertDialogFooter>
             <AlertDialogCancel>Cancel</AlertDialogCancel>
             <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">Delete</AlertDialogAction>
           </AlertDialogFooter>
         </AlertDialogContent>
       </AlertDialog>

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
         progress={uploadProgress}
       />
    </div>
  );
}
