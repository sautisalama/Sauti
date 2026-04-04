'use client';

import { Message } from '@/types/chat';
import { MarkdownText } from "@/components/ui/MarkdownText";
import { format } from 'date-fns';
import { Check, CheckCheck, Reply, Trash2, Copy, Smile, Clock, Play, Lock } from 'lucide-react';
import { useState, useMemo } from 'react';
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
}

type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';

export function MessageBubble({ message, isOwn, showTail = true, currentUserId }: MessageBubbleProps) {
  const [showReactions, setShowReactions] = useState(false);
  const [isReacting, setIsReacting] = useState(false);
  
  const time = useMemo(() => {
    try {
      return format(new Date(message.created_at), 'HH:mm');
    } catch {
      return '--:--';
    }
  }, [message.created_at]);

  // Determine message status for tick display
  const messageStatus = useMemo((): MessageStatus => {
    const readBy = (message as any).read_by as Array<{ user_id: string; read_at: string }> | undefined;
    
    // Check if message is read by anyone other than sender
    if (readBy && readBy.length > 0) {
      const readByOthers = readBy.some(r => r.user_id !== message.sender_id);
      if (readByOthers) return 'read';
    }
    
    // If message has an ID, it's at least delivered (saved to DB)
    if (message.id) return 'delivered';
    
    return 'sending';
  }, [message]);

  const handleReaction = async (emoji: string) => {
      if (isReacting) return;
      setIsReacting(true);
      try {
          await addMessageReaction(message.id, emoji);
          setShowReactions(false);
      } catch (e) {
          console.error('Failed to react', e);
      } finally {
          setIsReacting(false);
      }
  };

  const reactionCounts = useMemo(() => {
      if (!message.reactions || typeof message.reactions !== 'object') return {};
      const counts: Record<string, number> = {};
      Object.values(message.reactions as Record<string, string>).forEach(emoji => {
          counts[emoji] = (counts[emoji] || 0) + 1;
      });
      return counts;
  }, [message.reactions]);

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
        return <CheckCheck className="h-3.5 w-3.5 text-blue-300" />;
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

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div className={`flex mb-2 ${isOwn ? 'justify-end' : 'justify-start'} group relative`}>
          
          {/* Reaction Picker Popover - WhatsApp Style */}
          {showReactions && (
              <div className={`absolute bottom-full mb-2 z-50 bg-white shadow-xl rounded-full px-3 py-2 flex gap-0.5 border border-serene-neutral-100 animate-in fade-in zoom-in-95 duration-200 ${isOwn ? 'right-0' : 'left-0'}`}>
                  {['👍', '❤️', '😂', '😮', '😢', '🙏'].map((emoji, idx) => (
                      <button 
                          key={emoji}
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleReaction(emoji); }}
                          disabled={isReacting}
                          className="hover:bg-serene-neutral-100 p-2 rounded-full transition-all text-xl leading-none hover:scale-125 active:scale-95 disabled:opacity-50"
                          style={{ animationDelay: `${idx * 30}ms` }}
                      >
                          {emoji}
                      </button>
                  ))}
              </div>
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
                    <span title={messageStatus === 'read' ? 'Read' : messageStatus === 'delivered' ? 'Delivered' : 'Sent'}>
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
                            className="bg-white border border-serene-neutral-100 shadow-sm rounded-full px-2 py-0.5 text-sm flex items-center gap-1 cursor-pointer hover:bg-serene-blue-50 hover:border-serene-blue-200 transition-all hover:scale-105 active:scale-95 animate-in zoom-in-95"
                            onClick={toggleReactionPicker}
                        >
                            <span className="text-base">{emoji}</span>
                            {count > 1 && <span className="text-serene-neutral-600 font-semibold text-xs">{count}</span>}
                        </div>
                    ))}
                </div>
            )}
          </div>
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
        <ContextMenuItem className="text-red-600 focus:text-red-600 focus:bg-red-50">
           <Trash2 className="mr-2 h-4 w-4" /> Delete Message
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
