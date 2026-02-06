'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Image as ImageIcon, FileText, Link as LinkIcon, Download, ExternalLink } from 'lucide-react';
import { getChatMedia } from '@/app/actions/chat-media';
import { Message } from '@/types/chat';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';

interface ChatMediaDrawerProps {
  chatId: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ChatMediaDrawer({ chatId, isOpen, onClose }: ChatMediaDrawerProps) {
  const [activeTab, setActiveTab] = useState<'media' | 'docs' | 'links'>('media');
  const [items, setItems] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadItems();
    }
  }, [isOpen, activeTab, chatId]);

  const loadItems = async () => {
    setLoading(true);
    try {
      const data = await getChatMedia(chatId, activeTab);
      setItems(data as Message[]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[400px] sm:w-[540px] flex flex-col p-0 bg-[#f0f2f5]">
        <SheetHeader className="p-4 bg-[#f0f2f5] border-b border-[#d1d7db]">
          <SheetTitle>Contact Info</SheetTitle>
        </SheetHeader>
        
        <div className="flex-1 overflow-hidden flex flex-col">
            <div className="bg-white p-4 mb-2 shadow-sm flex flex-col items-center">
                <div className="h-24 w-24 rounded-full bg-gray-200 mb-2" />
                <h2 className="text-xl font-normal">Details</h2>
            </div>

            <div className="flex-1 bg-white shadow-sm flex flex-col min-h-0">
                 <Tabs defaultValue="media" className="flex-1 flex flex-col" onValueChange={(v) => setActiveTab(v as any)}>
                    <div className="px-4 pt-2">
                        <TabsList className="w-full grid grid-cols-3">
                            <TabsTrigger value="media">Media</TabsTrigger>
                            <TabsTrigger value="docs">Docs</TabsTrigger>
                            <TabsTrigger value="links">Links</TabsTrigger>
                        </TabsList>
                    </div>
                    
                    <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                        {loading ? (
                            <div className="text-center py-8 text-gray-500">Loading...</div>
                        ) : items.length === 0 ? (
                            <div className="text-center py-8 text-gray-400">No {activeTab} shared yet</div>
                        ) : (
                            <div className="grid grid-cols-3 gap-2">
                                {activeTab === 'media' && items.map(msg => (
                                    <div key={msg.id} className="aspect-square bg-gray-100 rounded overflow-hidden relative group">
                                         {/* Placeholder for actual image rendering */}
                                         {msg.metadata?.attachment_urls?.[0] ? (
                                              <img src={msg.metadata.attachment_urls[0]} alt="shared" className="w-full h-full object-cover" />
                                         ) : (
                                              <div className="w-full h-full flex items-center justify-center text-gray-400">
                                                  <ImageIcon className="h-6 w-6" />
                                              </div>
                                         )}
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'docs' && !loading && (
                            <div className="flex flex-col gap-2">
                                {items.map(msg => (
                                    <div key={msg.id} className="flex items-center gap-3 p-2 hover:bg-gray-50 rounded border">
                                        <div className="h-10 w-10 bg-red-100 rounded flex items-center justify-center text-red-500">
                                            <FileText className="h-5 w-5" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-medium text-sm truncate">{msg.content || 'Document'}</div>
                                            <div className="text-xs text-gray-500">{format(new Date(msg.created_at), 'MMM d, yyyy')}</div>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-8 w-8">
                                            <Download className="h-4 w-4" />
                                        </Button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {activeTab === 'links' && !loading && (
                             <div className="flex flex-col gap-2">
                                 {items.map(msg => (
                                     <a 
                                       key={msg.id} 
                                       href={msg.metadata?.link_preview?.url || '#'} 
                                       target="_blank" 
                                       rel="noreferrer"
                                       className="block bg-gray-50 rounded-lg overflow-hidden border hover:bg-gray-100 transition-colors"
                                     >
                                         {msg.metadata?.link_preview?.image && (
                                             <div className="h-32 w-full bg-cover bg-center" style={{ backgroundImage: `url(${msg.metadata.link_preview.image})` }} />
                                         )}
                                         <div className="p-2">
                                             <div className="font-medium text-sm text-[#111b21] line-clamp-2">
                                                 {msg.metadata?.link_preview?.title || msg.content}
                                             </div>
                                             <div className="text-xs text-gray-500 flex items-center mt-1">
                                                 <LinkIcon className="h-3 w-3 mr-1" />
                                                 <span className="truncate">{msg.metadata?.link_preview?.url}</span>
                                             </div>
                                         </div>
                                     </a>
                                 ))}
                             </div>
                        )}
                    </div>
                 </Tabs>
            </div>
        </div>

      </SheetContent>
    </Sheet>
  );
}
