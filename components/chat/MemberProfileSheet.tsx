'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BadgeCheck, Loader2, MessageCircle, Moon, ShieldCheck } from 'lucide-react';
import { format } from 'date-fns';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getMemberProfile, startDirectChat, type MemberProfileCard } from '@/app/actions/chat-social';
import { useToast } from '@/hooks/use-toast';

interface MemberProfileSheetProps {
  userId: string | null;
  chatId?: string;
  currentUserId?: string | null;
  onClose: () => void;
}

const TYPE_LABEL: Record<string, string> = {
  professional: 'Professional',
  ngo: 'NGO',
  survivor: 'Survivor',
  admin: 'Sauti Salama team',
};

/** Tap someone's photo or name in a chat to see who they are. No contact details are shown. */
export function MemberProfileSheet({ userId, chatId, currentUserId, onClose }: MemberProfileSheetProps) {
  const [card, setCard] = useState<MemberProfileCard | null | undefined>(undefined);
  const [opening, setOpening] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    if (!userId) return;
    setCard(undefined);
    getMemberProfile(userId, chatId)
      .then(setCard)
      .catch(() => setCard(null));
  }, [userId, chatId]);

  const message = async () => {
    if (!card) return;
    setOpening(true);
    try {
      const id = await startDirectChat(card.id);
      onClose();
      router.push(`/dashboard/chat?id=${id}`);
    } catch (e) {
      toast({ title: 'Could not open the chat', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setOpening(false);
    }
  };

  return (
    <Sheet open={!!userId} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto bg-[#f0f2f5] p-0 sm:max-w-md">
        <SheetHeader className="border-b border-[#d1d7db] p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <SheetTitle>Contact info</SheetTitle>
        </SheetHeader>

        {card === undefined && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-serene-neutral-400" />
          </div>
        )}

        {card === null && <p className="p-8 text-center text-sm text-serene-neutral-500">Details are not available for this person.</p>}

        {card && (
          <>
            <div className="flex flex-col items-center bg-white p-6 shadow-sm">
              <Avatar className="h-28 w-28 ring-4 ring-white shadow-md">
                <AvatarImage src={card.avatarUrl ?? undefined} />
                <AvatarFallback className="bg-gradient-to-br from-serene-blue-100 to-serene-blue-50 text-3xl font-bold text-serene-blue-600">
                  {card.name.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <h2 className="mt-3 flex items-center gap-1.5 text-xl font-bold text-serene-neutral-900">
                {card.name}
                {card.isVerified && <BadgeCheck className="h-5 w-5 text-sauti-teal" aria-label="Verified" />}
              </h2>
              {card.title && <p className="text-sm text-serene-neutral-600">{card.title}</p>}
              <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                {card.userType && <Badge variant="secondary">{TYPE_LABEL[card.userType] ?? card.userType.replace(/_/g, ' ')}</Badge>}
                {card.groupRole && card.groupRole !== 'member' && (
                  <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">
                    <ShieldCheck className="mr-1 h-3 w-3" />
                    {card.groupRole === 'admin' ? 'Group admin' : 'Moderator'}
                  </Badge>
                )}
                {card.outOfOffice && (
                  <Badge variant="outline" className="border-amber-200 text-amber-700">
                    <Moon className="mr-1 h-3 w-3" /> Out of office
                  </Badge>
                )}
              </div>
              {card.id !== currentUserId && (
                <Button onClick={message} disabled={opening} className="mt-4 gap-2 rounded-full">
                  {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />}
                  Message
                </Button>
              )}
            </div>

            {card.bio && (
              <div className="mt-2 bg-white p-4 shadow-sm">
                <h3 className="mb-1 text-xs font-bold uppercase tracking-wider text-serene-neutral-400">About</h3>
                <p className="whitespace-pre-line text-sm text-serene-neutral-800">{card.bio}</p>
              </div>
            )}

            {card.services.length > 0 && (
              <div className="mt-2 bg-white p-4 shadow-sm">
                <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-serene-neutral-400">Verified services</h3>
                <ul className="space-y-2">
                  {card.services.map((s, i) => (
                    <li key={i} className="rounded-xl border border-serene-neutral-100 p-3">
                      <p className="text-sm font-semibold text-serene-neutral-900">{s.name}</p>
                      {s.types && <p className="text-xs capitalize text-serene-neutral-500">{s.types}</p>}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {card.memberSince && (
              <p className="p-4 text-center text-xs text-serene-neutral-400">On Sauti Salama since {format(new Date(card.memberSince), 'MMMM yyyy')}</p>
            )}
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
