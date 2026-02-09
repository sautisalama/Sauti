'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Search, MessageCircle, Loader2, Sparkles } from 'lucide-react';
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

  const handleClose = () => {
    setQuery('');
    setResults([]);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-3xl p-0 overflow-hidden bg-serene-neutral-50">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-serene-blue-100 flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-serene-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-serene-neutral-900">New Message</DialogTitle>
              <DialogDescription className="text-sm text-serene-neutral-500">
                Search for someone to start a conversation
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-6 pt-4 space-y-4">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-serene-neutral-400" />
            <Input
              placeholder="Search by name or email..."
              className="pl-11 h-12 bg-white border-serene-neutral-200 rounded-xl focus-visible:ring-serene-blue-200"
              value={query}
              onChange={(e) => handleSearch(e.target.value)}
              autoFocus
            />
          </div>

          {/* Results */}
          <div className="max-h-[280px] overflow-y-auto space-y-2">
            {loading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-serene-blue-500" />
              </div>
            )}

            {!loading && results.length === 0 && query.length > 2 && (
              <div className="text-center py-8">
                <div className="h-12 w-12 bg-serene-neutral-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Search className="h-5 w-5 text-serene-neutral-400" />
                </div>
                <p className="text-sm text-serene-neutral-500">No users found for "{query}"</p>
              </div>
            )}

            {results.map(user => (
              <button
                key={user.id}
                onClick={() => startChat(user.id)}
                disabled={creating}
                className="w-full flex items-center gap-3 p-3 bg-white hover:bg-serene-blue-50 rounded-xl transition-all duration-200 text-left border border-serene-neutral-100 hover:border-serene-blue-200 hover:shadow-sm group"
              >
                <Avatar className="h-11 w-11 border-2 border-white shadow-sm">
                  <AvatarImage src={user.avatar_url} />
                  <AvatarFallback className="bg-serene-blue-100 text-serene-blue-600 font-semibold">
                    {user.first_name?.[0]}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-serene-neutral-900 group-hover:text-serene-blue-900 truncate">
                    {user.first_name} {user.last_name}
                  </div>
                  <div className="text-xs text-serene-neutral-500 capitalize">{user.user_type}</div>
                </div>
                <div className="h-8 w-8 rounded-full bg-serene-neutral-50 group-hover:bg-serene-blue-100 flex items-center justify-center transition-colors">
                  <MessageCircle className="h-4 w-4 text-serene-neutral-400 group-hover:text-serene-blue-600" />
                </div>
              </button>
            ))}
          </div>


        </div>
      </DialogContent>
    </Dialog>
  );
}
