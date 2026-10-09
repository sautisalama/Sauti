'use client';

import { Message } from '@/types/chat';
import { MarkdownText } from "@/components/ui/MarkdownText";
import { format } from 'date-fns';
import { Check, CheckCheck, Reply, Trash2, Copy, Smile, Clock, Play, Lock } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { addMessageReaction } from '@/app/actions/chat';
import { DocumentPreview } from './DocumentPreview';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from '@/components/ui/context-menu';

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showTail?: boolean;
  currentUserId?: string;
  /** Group chats: show who sent it (name above the text, avatar beside the bubble). */
  showSender?: boolean;
  senderName?: string;
  senderAvatar?: string | null;
  onOpenProfile?: (userId: string) => void;
  /** How many other people must read it before the ticks turn blue. */
  recipientCount?: number;
  /** Provide to allow deleting this message (own messages, or a group admin's moderation). */
  onDelete?: (message: Message) => void;
}

// A stable accent per person so names in a busy group are easy to tell apart.
const NAME_COLORS = ['text-rose-600', 'text-amber-700', 'text-emerald-700', 'text-sky-700', 'text-violet-700', 'text-pink-700', 'text-teal-700', 'text-orange-700'];
const nameColor = (id: string) => NAME_COLORS[[...id].reduce((n, c) => n + c.charCodeAt(0), 0) % NAME_COLORS.length];

type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

export function MessageBubble({ message, isOwn, showTail = true, currentUserId, showSender, senderName, senderAvatar, onOpenProfile, recipientCount = 1, onDelete }: MessageBubbleProps) {
  const [showReactions, setShowReactions] = useState(false);
  const [isReacting, setIsReacting] = useState(false);
  // Local copy so a reaction shows instantly; the server's answer / realtime update replaces it.
  const [reactions, setReactions] = useState<Record<string, string>>((message.reactions as Record<string, string>) || {});
  useEffect(() => {
    setReactions((message.reactions as Record<string, string>) || {});
  }, [message.reactions]);
  const myReaction = currentUserId ? reactions[currentUserId] : undefined;
  
  const time = useMemo(() => {
    try {
      return format(new Date(message.created_at), 'HH:mm');
    } catch {
      return '--:--';
    }
  }, [message.created_at]);

  // Ticks: one grey = saved, two grey = reached the recipient's device, two blue = read
  // (in groups, blue once everyone else has read it).
  const messageStatus = useMemo((): MessageStatus => {
    if (!message.id || String(message.id).startsWith('temp')) return 'sending';
    const readers = new Set(((message.read_by as Array<{ user_id: string }> | undefined) ?? []).map(r => r.user_id).filter(id => id !== message.sender_id));
    if (readers.size >= Math.max(1, recipientCount)) return 'read';
    if (message.delivered_at || readers.size > 0) return 'delivered';
    return 'sent';
  }, [message, recipientCount]);

  const handleReaction = async (emoji: string) => {
      if (isReacting || !message.id || String(message.id).startsWith('temp')) return;
      setIsReacting(true);
      setShowReactions(false);
      const before = reactions;
      if (currentUserId) {
          const next = { ...reactions };
          if (next[currentUserId] === emoji) delete next[currentUserId];
          else next[currentUserId] = emoji;
          setReactions(next);
      }
      try {
          const res = await addMessageReaction(message.id, emoji);
          setReactions(res.reactions as Record<string, string>);
      } catch (e) {
          console.error('Failed to react', e);
          setReactions(before);
      } finally {
          setIsReacting(false);
      }
  };

  const reactionCounts = useMemo(() => {
      const counts: Record<string, number> = {};
      Object.values(reactions).forEach(emoji => {
          counts[emoji] = (counts[emoji] || 0) + 1;
      });
      return counts;
  }, [reactions]);

  const toggleReactionPicker = () => setShowReactions(!showReactions);

  // Status tick component - WhatsApp style
  const StatusTicks = () => {
    if (!isOwn) return null;
    
    switch (messageStatus) {
      case 'sending':
        return <Clock className="h-3 w-3 opacity-60" />;
      case 'sent':
        return <Check className="h-3.5 w-3.5 opacity-70" />;
      case 'delivered':
        return <CheckCheck className="h-3.5 w-3.5 opacity-70" />;
      case 'read':
        return <CheckCheck className="h-3.5 w-3.5 text-sky-300 drop-shadow-sm" />;
      default:
        return <Check className="h-3.5 w-3.5 opacity-70" />;
    }
  };

  // Link Preview Card helper
  const LinkCard = ({ preview }: { preview: any }) => {
    const domain = (() => {
      try {
        return new URL(preview.url).hostname.replace('www.', '');
      } catch {
        return preview.url;
      }
    })();
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    
    return (
      <a 
        href={preview.url} 
        target="_blank" 
        rel="noreferrer" 
        className={`block mt-2 mb-1 rounded-xl overflow-hidden border transition-all hover:scale-[1.01] active:scale-[0.99] max-w-sm ${isOwn ? 'bg-white/10 border-white/20' : 'bg-serene-neutral-50 border-serene-neutral-100'}`}
      >
        {preview.image && (
          <div className="h-32 w-full bg-cover bg-center" style={{ backgroundImage: `url(${preview.image})` }} />
        )}
        <div className="p-3">
          <div className={`font-bold text-sm mb-1 line-clamp-2 ${isOwn ? 'text-white' : 'text-serene-neutral-900'}`}>
            {preview.title || domain}
          </div>
          {preview.description && (
            <div className={`text-xs line-clamp-2 mb-2 ${isOwn ? 'text-blue-100' : 'text-serene-neutral-500'}`}>
              {preview.description}
            </div>
          )}
          <div className={`flex items-center gap-2 text-xs ${isOwn ? 'text-blue-200' : 'text-serene-neutral-400'}`}>
            <img src={faviconUrl} alt="" className="w-4 h-4 rounded" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
            <span className="truncate">{domain}</span>
          </div>
        </div>
      </a>
    );
  };

  if (message.type === 'system') {
    return (
      <div className="flex justify-center my-4 px-6 animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="bg-serene-neutral-100/50 backdrop-blur-sm px-4 py-2 rounded-2xl text-center shadow-sm border border-serene-neutral-200/50 max-w-[85%]">
          <div className="flex items-center justify-center gap-2 mb-1">
            <Lock className="h-3 w-3 text-serene-neutral-400" />
            <span className="text-[10px] font-bold text-serene-neutral-400 uppercase tracking-widest">Secure Coordination</span>
          </div>
          <p className="text-xs font-medium text-serene-neutral-600 leading-relaxed whitespace-pre-wrap">
            {message.content}
          </p>
        </div>
      </div>
    );
  }

  if (message.is_deleted) {
    const byAdmin = (message.metadata as { deleted_by?: string } | undefined)?.deleted_by && (message.metadata as { deleted_by?: string }).deleted_by !== message.sender_id;
    return (
      <div className={`flex mb-2 w-full items-end gap-2 ${isOwn ? 'justify-end' : 'justify-start'}`}>
        <div className="max-w-[75%] rounded-2xl border border-dashed border-serene-neutral-200 bg-white/70 px-4 py-2 text-[13px] italic text-serene-neutral-500">
          🚫 {isOwn ? (byAdmin ? 'An admin removed your message' : 'You deleted this message') : byAdmin ? 'An admin removed this message' : 'This message was deleted'}
        </div>
      </div>
    );
  }

  const showAvatar = Boolean(showSender && !isOwn);
  const openProfile = () => onOpenProfile?.(message.sender_id);

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div
          className={`flex w-full mb-2 items-center gap-1 ${isOwn ? 'justify-end' : 'justify-start'} group relative`}
          onDoubleClick={() => handleReaction('👍')}
        >
          
          {/* Reaction Picker Popover - WhatsApp Style */}
          {showReactions && (
              <div className="fixed inset-0 z-40" onClick={() => setShowReactions(false)} aria-hidden />
          )}
          {showReactions && (
              <div className={`absolute bottom-full mb-2 z-50 bg-white shadow-xl rounded-full px-3 py-2 flex gap-0.5 border border-serene-neutral-100 animate-in fade-in zoom-in-95 duration-200 ${isOwn ? 'right-0' : 'left-0'}`}>
                  {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji, idx) => (
                      <button 
                          key={emoji}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleReaction(emoji); }}
                          disabled={isReacting}
                          className={`p-2 rounded-full transition-all text-xl leading-none hover:scale-125 active:scale-95 disabled:opacity-50 ${myReaction === emoji ? 'bg-serene-blue-100' : 'hover:bg-serene-neutral-100'}`}
                          style={{ animationDelay: `${idx * 30}ms` }}
                      >
                          {emoji}
                      </button>
                  ))}
              </div>
          )}

          {showAvatar && (
            <button type="button" onClick={openProfile} aria-label={`View ${senderName || 'member'}'s details`} className="mr-1 mt-auto h-8 w-8 shrink-0 self-end overflow-hidden rounded-full bg-serene-blue-100 text-xs font-bold text-serene-blue-700 ring-2 ring-white touch-manipulation">
              {senderAvatar ? <img src={senderAvatar} alt="" className="h-full w-full object-cover" /> : <span className="flex h-full w-full items-center justify-center">{(senderName || '?').charAt(0).toUpperCase()}</span>}
            </button>
          )}
          <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} max-w-[75%]`}>
            <div 
                className={`
                relative px-4 py-2.5 rounded-2xl text-[15px] leading-relaxed shadow-sm
                ${isOwn 
                    ? 'bg-serene-blue-600 text-white rounded-br-none' 
                    : 'bg-white text-serene-neutral-900 border border-serene-neutral-100 rounded-bl-none'
                }
                `}
            >
                <div className="pt-0.5">
                    {showAvatar && senderName && (
                        <button type="button" onClick={openProfile} className={`mb-0.5 block max-w-full truncate text-left text-[12px] font-bold ${nameColor(message.sender_id)}`}>
                            {senderName}
                        </button>
                    )}
                    {/* Media Attachments - Enhanced */}
                    {((message.attachments as any[]) || []).concat(
                        ((message.metadata as any)?.attachment_urls || []).map((url: any) => ({ url, type: message.type as any }))
                    ).map((attachment: any, i: number) => (
                        <div key={i} className="mb-2 max-w-sm relative">
                            {attachment.type === 'image' && (
                                <div className="relative group/img rounded-xl overflow-hidden">
                                    <img 
                                        src={attachment.url} 
                                        alt="Shared" 
                                        className="w-full h-auto max-h-[300px] object-cover cursor-pointer transition-transform hover:scale-[1.02]" 
                                        onClick={() => window.open(attachment.url, '_blank')}
                                    />
                                    <div className="absolute inset-0 bg-black/0 group-hover/img:bg-black/10 transition-colors pointer-events-none" />
                                </div>
                            )}
                            {attachment.type === 'video' && (
                                <div className="relative rounded-xl overflow-hidden bg-black">
                                    <video 
                                        src={attachment.url} 
                                        controls 
                                        className="w-full h-auto max-h-[300px] rounded-xl"
                                        preload="metadata"
                                    />
                                </div>
                            )}
                            {attachment.type === 'file' && (
                                <DocumentPreview
                                    url={attachment.url}
                                    name={attachment.name || 'Document'}
                                    size={attachment.size}
                                    isOwn={isOwn}
                                />
                            )}
                        </div>
                    ))}

                    {/* Text Content */}
                    {message.type !== 'image' && message.type !== 'video' && (
                        <MarkdownText 
                            content={message.content || ''} 
                            className={isOwn ? 'text-white' : 'text-serene-neutral-900'} 
                        />
                    )}

                    {/* Link Preview */}
                    {(message.metadata as any)?.link_preview && (
                        <LinkCard preview={(message.metadata as any).link_preview} />
                    )}
                </div>

                {/* Metadata & Status - WhatsApp Style */}
                <div className={`flex justify-end items-center gap-1.5 mt-1 select-none text-[10px] ${isOwn ? 'text-blue-100/90' : 'text-serene-neutral-400'}`}>
                    <span className="font-medium">{time}</span>
                    <span title={messageStatus === 'read' ? 'Read' : messageStatus === 'delivered' ? 'Delivered' : messageStatus === 'sending' ? 'Sending' : 'Sent'}>
                        <StatusTicks />
                    </span>
                </div>
            </div>

            {/* Reactions Display - WhatsApp Style */}
            {Object.keys(reactionCounts).length > 0 && (
                <div className={`flex flex-wrap gap-1 mt-1.5 ${isOwn ? 'justify-end' : 'justify-start'}`}>
                    {Object.entries(reactionCounts).map(([emoji, count]) => (
                        <div 
                            key={emoji} 
                            role="button"
                            aria-label={`${emoji} ${count}`}
                            className={`border shadow-sm rounded-full px-2 py-0.5 text-sm flex items-center gap-1 cursor-pointer transition-all hover:scale-105 active:scale-95 animate-in zoom-in-95 ${myReaction === emoji ? 'bg-serene-blue-50 border-serene-blue-300' : 'bg-white border-serene-neutral-100 hover:bg-serene-blue-50 hover:border-serene-blue-200'}`}
                            onClick={() => handleReaction(emoji)}
                        >
                            <span className="text-base">{emoji}</span>
                            {count > 1 && <span className="text-serene-neutral-600 font-semibold text-xs">{count}</span>}
                        </div>
                    ))}
                </div>
            )}
          </div>
          {/* Desktop hover affordance; on touch, long-press the message or double-tap for 👍 */}
          <button
            type="button"
            aria-label="React to message"
            onClick={(e) => { e.stopPropagation(); toggleReactionPicker(); }}
            className={`${isOwn ? 'order-first' : ''} hidden md:flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-serene-neutral-400 shadow-sm border border-serene-neutral-100 opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:text-serene-blue-600 transition-opacity`}
          >
            <Smile className="h-4 w-4" />
          </button>
        </div>
      </ContextMenuTrigger>
      
      <ContextMenuContent className="w-48">
        <ContextMenuItem onClick={toggleReactionPicker}>
            <Smile className="mr-2 h-4 w-4" /> Add Reaction
        </ContextMenuItem>
        <ContextMenuItem>
           <Reply className="mr-2 h-4 w-4" /> Reply
        </ContextMenuItem>
        <ContextMenuItem onClick={() => navigator.clipboard.writeText(message.content || '')}>
           <Copy className="mr-2 h-4 w-4" /> Copy Text
        </ContextMenuItem>
        {onDelete && (
          <ContextMenuItem onClick={() => onDelete(message)} className="text-red-600 focus:text-red-600 focus:bg-red-50">
             <Trash2 className="mr-2 h-4 w-4" /> Delete message
          </ContextMenuItem>
        )}
      </ContextMenuContent>
    </ContextMenu>
  );
}
