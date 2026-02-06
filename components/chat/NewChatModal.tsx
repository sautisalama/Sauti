'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, UserPlus, Loader2 } from 'lucide-react';
import { searchUsers, createChat } from '@/app/actions/chat';
import { useToast } from '@/components/ui/use-toast';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChatCreated: () => void;
}

export function NewChatModal({ isOpen, onClose, onChatCreated }: NewChatModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const { toast } = useToast();

  const handleSearch = async (val: string) => {
    setQuery(val);
    if (val.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const data = await searchUsers(val);
      setResults(data || []);
    } finally {
      setLoading(false);
    }
  };

  const startChat = async (userId: string) => {
    setCreating(true);
    try {
      await createChat([userId], 'dm');
      onChatCreated();
      onClose();
    } catch (error) {
      toast({
         title: "Error",
         description: "Failed to create chat",
         variant: "destructive"
      });
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>New Chat</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-500" />
            <Input
              placeholder="Search name or email..."
              className="pl-8"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
            />
          </div>

          <div className="flex-1 max-h-[300px] overflow-y-auto">
             {loading && <div className="flex justify-center p-4"><Loader2 className="animate-spin" /></div>}
             {!loading && results.length === 0 && query.length > 2 && (
               <div className="text-center text-sm text-gray-500 p-4">No users found.</div>
             )}
             
             {results.map(user => (
               <button
                 key={user.id}
                 onClick={() => startChat(user.id)}
                 disabled={creating}
                 className="w-full flex items-center gap-3 p-2 hover:bg-gray-100 rounded-lg transition-colors text-left"
               >
                 <Avatar>
                   <AvatarImage src={user.avatar_url} />
                   <AvatarFallback>{user.first_name?.[0]}</AvatarFallback>
                 </Avatar>
                 <div className="flex-1">
                   <div className="font-medium text-sm">{user.first_name} {user.last_name}</div>
                   <div className="text-xs text-gray-500 capitalize">{user.user_type}</div>
                 </div>
                 <UserPlus className="h-4 w-4 text-gray-400" />
               </button>
             ))}
          </div>

          {/* Hardcoded Salama AI Option */}
           <button
             className="w-full flex items-center gap-3 p-2 hover:bg-teal-50 rounded-lg transition-colors text-left border border-teal-100"
             onClick={() => {
                // TODO: Implement Salama AI specific chat creation
                toast({ title: "Coming Soon", description: "Salama AI integration is in progress." });
             }}
           >
             <div className="h-10 w-10 rounded-full bg-teal-600 flex items-center justify-center text-white font-bold text-xs">AI</div>
             <div className="flex-1">
               <div className="font-medium text-sm text-teal-900">Chat with Salama AI</div>
               <div className="text-xs text-teal-600">Always here to help</div>
             </div>
           </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
