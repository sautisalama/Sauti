'use client';

import { Message } from '@/types/chat';
import { format } from 'date-fns';
import { CheckCheck, Reply, Trash2, Copy, FileText } from 'lucide-react';
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
}

export function MessageBubble({ message, isOwn, showTail = true }: MessageBubbleProps) {
  const time = format(new Date(message.created_at), 'HH:mm');
  const status = 'read'; 

  // Link Preview Card with favicon
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

  return (
    <ContextMenu>
      <ContextMenuTrigger>
        <div className={`flex mb-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
          <div 
            className={`
              relative max-w-[75%] px-3 py-2 rounded-2xl text-[15px] leading-relaxed shadow-sm
              ${isOwn 
                ? 'bg-serene-blue-600 text-white rounded-br-none' 
                : 'bg-white text-serene-neutral-900 border border-serene-neutral-100 rounded-bl-none'
              }
            `}
          >
            {/* Tail removed for cleaner modern look */}

            <div className="px-1.5 pt-0.5">
               {/* Media Attachment - Support both new attachments column and legacy metadata */}
               {(message.attachments || []).concat(
                  (message.metadata?.attachment_urls || []).map(url => ({ url, type: message.type as any }))
               ).map((attachment, i) => (
                   <div key={i} className="mb-2 rounded-lg overflow-hidden max-w-sm relative group">
                       {attachment.type === 'image' && (
                          <div className="relative">
                            <img src={attachment.url} alt="Shared" className="w-full h-auto max-h-[300px] object-cover rounded-lg" />
                             {/* Gradient overlay for text readability if we add caption later */}
                          </div>
                       )}
                       {attachment.type === 'video' && <video src={attachment.url} controls className="w-full h-auto rounded-lg" />}
                       {attachment.type === 'file' && (
                           <a href={attachment.url} target="_blank" rel="noreferrer" className="flex items-center gap-3 p-3 bg-serene-neutral-100 rounded-lg border border-serene-neutral-200 hover:bg-serene-neutral-200 transition-colors">
                               <div className="bg-white p-2 rounded-full text-sauti-teal">
                                 <FileText className="h-5 w-5" />
                               </div>
                               <div className="flex-1 min-w-0">
                                 <p className="font-medium text-sm text-serene-neutral-900 truncate">{attachment.name || 'Document'}</p>
                                 {attachment.size && <p className="text-xs text-serene-neutral-500">{(attachment.size / 1024 / 1024).toFixed(2)} MB</p>}
                               </div>
                           </a>
                       )}
                   </div>
               ))}

                {/* Text Content */}
                {message.type !== 'image' && (
                  <span className={`break-words whitespace-pre-wrap ${isOwn ? 'text-white' : 'text-serene-neutral-900'}`}>{message.content}</span>
                )}

               {/* Link Preview */}
               {message.metadata?.link_preview && (
                 <LinkCard preview={message.metadata.link_preview} />
               )}
            </div>

            {/* Metadata (Time + Ticks) */}
            <div className={`flex justify-end gap-1 items-end mt-1 min-h-[15px] select-none text-[10px] opacity-80 ${isOwn ? 'text-blue-100' : 'text-serene-neutral-400'}`}>
               <span className="mr-0.5 font-medium">{time}</span>
               {isOwn && (
                 <span>
                   <CheckCheck className="h-3 w-3" />
                 </span>
               )}
            </div>
          </div>
        </div>
      </ContextMenuTrigger>
      
      <ContextMenuContent>
        <ContextMenuItem>
           <Reply className="mr-2 h-4 w-4" /> Reply
        </ContextMenuItem>
        <ContextMenuItem>
           <Copy className="mr-2 h-4 w-4" /> Copy
        </ContextMenuItem>
        <ContextMenuItem className="text-red-500 focus:text-red-500">
           <Trash2 className="mr-2 h-4 w-4" /> Delete
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  );
}
