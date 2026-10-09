'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, MessageCircle, Loader2 } from 'lucide-react';
import { searchUsers } from '@/app/actions/chat';
import { findUserBySautiId, startDirectChat } from '@/app/actions/chat-social';
import { useToast } from '@/components/ui/use-toast';
import { SautiIdCard } from './SautiIdCard';

interface NewChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChatCreated: () => void;
}

type IdResult = { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null; user_type: string | null; is_verified: boolean };

export function NewChatModal({ isOpen, onClose, onChatCreated }: NewChatModalProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [idCode, setIdCode] = useState('');
  const [idResult, setIdResult] = useState<IdResult | null | 'none'>(null);
  const [looking, setLooking] = useState(false);
  const { toast } = useToast();
  const router = useRouter();

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

  const lookupId = async () => {
    setLooking(true);
    setIdResult(null);
    try {
      setIdResult((await findUserBySautiId(idCode)) ?? 'none');
    } catch {
      toast({ title: 'Could not look that ID up', variant: 'destructive' });
    } finally {
      setLooking(false);
    }
  };

  /** Open the existing direct chat with this person (or start one) and go straight to it. */
  const openChatWith = async (userId: string) => {
    setCreating(true);
    try {
      const chatId = await startDirectChat(userId);
      onChatCreated();
      handleClose();
      router.push(`/dashboard/chat?id=${chatId}`);
    } catch (error) {
      toast({
        title: 'Could not start the chat',
        description: error instanceof Error ? error.message : undefined,
        variant: 'destructive',
      });
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setQuery('');
    setResults([]);
    setIdCode('');
    setIdResult(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md rounded-2xl p-0 overflow-hidden bg-serene-neutral-50">
        <DialogHeader className="p-6 pb-0">
          <div className="flex items-center gap-3 mb-1">
            <div className="h-10 w-10 rounded-xl bg-serene-blue-100 flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-serene-blue-600" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold text-serene-neutral-900">New Message</DialogTitle>
              <DialogDescription className="text-sm text-serene-neutral-500">
                Find someone by name, or use their Sauti ID
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <Tabs defaultValue="search" className="px-6 pt-4 pb-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="search">Search</TabsTrigger>
            <TabsTrigger value="id">Sauti ID</TabsTrigger>
            <TabsTrigger value="mine">My ID</TabsTrigger>
          </TabsList>

          <TabsContent value="search" className="space-y-4">
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
                  <p className="mt-1 text-xs text-serene-neutral-400">Have their Sauti ID? Use the Sauti ID tab.</p>
                </div>
              )}

              {results.map((user) => (
                <button
                  key={user.id}
                  onClick={() => openChatWith(user.id)}
                  disabled={creating}
                  className="w-full flex items-center gap-3 p-3 bg-white hover:bg-serene-blue-50 rounded-xl transition-all duration-200 text-left border border-serene-neutral-100 hover:border-serene-blue-200 hover:shadow-sm group"
                >
                  <Avatar className="h-11 w-11 border-2 border-white shadow-sm">
                    <AvatarImage src={user.avatar_url} />
                    <AvatarFallback className="bg-serene-blue-100 text-serene-blue-600 font-semibold">{user.first_name?.[0]}</AvatarFallback>
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
          </TabsContent>

          <TabsContent value="id" className="space-y-3">
            <p className="text-sm text-serene-neutral-600">Enter the Sauti ID someone shared with you.</p>
            <div className="flex gap-2">
              <Input
                placeholder="SS-XXXX-XXXX"
                value={idCode}
                onChange={(e) => {
                  setIdCode(e.target.value.toUpperCase());
                  setIdResult(null);
                }}
                onKeyDown={(e) => e.key === 'Enter' && idCode.trim() && lookupId()}
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                className="h-12 rounded-xl bg-white font-mono tracking-wider"
              />
              <Button onClick={lookupId} disabled={looking || idCode.replace(/[^A-Za-z0-9]/g, '').length < 8} className="h-12 rounded-xl">
                {looking ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Find'}
              </Button>
            </div>
            {idResult === 'none' && <p className="text-sm text-serene-neutral-500">No one has that ID. Check it and try again.</p>}
            {idResult && idResult !== 'none' && (
              <button
                onClick={() => openChatWith(idResult.id)}
                disabled={creating}
                className="flex w-full items-center gap-3 rounded-xl border border-serene-neutral-100 bg-white p-3 text-left hover:border-serene-blue-200 hover:bg-serene-blue-50"
              >
                <Avatar className="h-11 w-11">
                  <AvatarImage src={idResult.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-serene-blue-100 font-semibold text-serene-blue-600">{idResult.first_name?.[0]}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-serene-neutral-900">
                    {idResult.first_name} {idResult.last_name}
                  </div>
                  <div className="text-xs capitalize text-serene-neutral-500">
                    {String(idResult.user_type ?? '').replace(/_/g, ' ')}
                    {idResult.is_verified ? ' · Verified' : ''}
                  </div>
                </div>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-5 w-5 text-serene-blue-600" />}
              </button>
            )}
          </TabsContent>

          <TabsContent value="mine">
            <SautiIdCard />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
