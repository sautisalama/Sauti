'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { format } from 'date-fns';
import {
  Camera, Check, Copy, Download, QrCode, Share2, RefreshCw, FileText, Link as LinkIcon, Loader2, LogOut, MoreVertical, Pencil, Search, ShieldCheck, ShieldOff, UserMinus, UserPlus, Users, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { getChatMedia } from '@/app/actions/chat-media';
import { searchUsers } from '@/app/actions/chat';
import { findUserBySautiId } from '@/app/actions/chat-social';
import { resetInviteCode } from '@/app/actions/community-invite';
import { QrShare } from './QrShare';
import {
  addMembers, getCommunityDetails, leaveCommunity, removeMember, setMemberRole, updateCommunity,
  type CommunityDetails,
} from '@/app/actions/community-admin';
import { Chat, Message, transformMessage } from '@/types/chat';
import { createClient } from '@/utils/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ChatMediaDrawerProps {
  chatId: string;
  isOpen: boolean;
  onClose: () => void;
  chat?: Chat;
  currentUserId?: string | null;
  onOpenProfile?: (userId: string) => void;
  /** Called after the viewer leaves a group so the chat can close. */
  onLeft?: () => void;
}

/** Contact / group info: members and admin tools for communities, plus shared media, docs and links. */
export function ChatMediaDrawer({ chatId, isOpen, onClose, chat, currentUserId, onOpenProfile, onLeft }: ChatMediaDrawerProps) {
  const { toast } = useToast();
  const isGroup = chat?.type === 'community' || !!chat?.metadata?.is_community;

  const [activeTab, setActiveTab] = useState<'media' | 'docs' | 'links'>('media');
  const [items, setItems] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const [group, setGroup] = useState<CommunityDetails | null>(null);
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState('');
  const [draftDesc, setDraftDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const loadGroup = useCallback(async () => {
    if (!isGroup) return;
    setGroup(await getCommunityDetails(chatId).catch(() => null));
  }, [chatId, isGroup]);

  useEffect(() => {
    if (isOpen) loadGroup();
  }, [isOpen, loadGroup]);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    getChatMedia(chatId, activeTab)
      .then((data) => setItems((data || []).map(transformMessage)))
      .finally(() => setLoading(false));
  }, [isOpen, activeTab, chatId]);

  const canManage = group?.myRole === 'admin' || group?.myRole === 'moderator';
  const isAdmin = group?.myRole === 'admin';

  const run = async (label: string, fn: () => Promise<unknown>) => {
    try {
      await fn();
      await loadGroup();
    } catch (e) {
      toast({ title: label, description: e instanceof Error ? e.message : 'Please try again.', variant: 'destructive' });
    }
  };

  const saveDetails = async () => {
    if (!group) return;
    setSaving(true);
    try {
      await updateCommunity(group.communityId, { name: draftName, description: draftDesc });
      setEditing(false);
      await loadGroup();
    } catch (e) {
      toast({ title: 'Could not save', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const changePhoto = async (file: File) => {
    if (!group || !file.type.startsWith('image/')) return;
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: 'Choose a smaller photo', description: 'Up to 5 MB.', variant: 'destructive' });
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Please sign in again.');
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${user.id}/community-${group.communityId}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('profile-images').upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from('profile-images').getPublicUrl(path);
      await updateCommunity(group.communityId, { avatarUrl: data.publicUrl });
      await loadGroup();
    } catch (e) {
      toast({ title: 'Could not change the photo', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    } finally {
      setUploading(false);
    }
  };

  const inviteLink = group?.inviteCode && typeof window !== 'undefined' ? `${window.location.origin}/join/${group.inviteCode}` : null;
  const copyInvite = async () => {
    if (!inviteLink) return;
    try {
      await navigator.clipboard.writeText(inviteLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast({ title: 'Could not copy', description: inviteLink });
    }
  };
  // The description travels with the ID and link, so a forwarded invite says what the group is for.
  const shareInvite = async () => {
    if (!group || !inviteLink) return;
    const text = [`Join "${group.name}" on Sauti Salama`, group.description?.trim(), `Group ID: ${group.inviteCode}`, inviteLink].filter(Boolean).join('\n\n');
    if (navigator.share) {
      try {
        await navigator.share({ title: group.name, text });
        return;
      } catch {
        /* cancelled */
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Invite copied', description: 'Paste it into any chat or message.' });
    } catch {
      toast({ title: 'Could not share', variant: 'destructive' });
    }
  };
  const resetInvite = async () => {
    if (!group || !window.confirm('Reset the group link? The old link and QR code will stop working.')) return;
    await run('Could not reset the link', () => resetInviteCode(group.communityId));
  };

  const leave = async () => {
    if (!group || !window.confirm(`Leave "${group.name}"?`)) return;
    try {
      await leaveCommunity(group.communityId);
      onClose();
      onLeft?.();
    } catch (e) {
      toast({ title: 'Could not leave', description: e instanceof Error ? e.message : undefined, variant: 'destructive' });
    }
  };

  const meta = chat?.metadata;
  const other = chat?.participants?.find((p) => p.user_id !== currentUserId);
  const title = isGroup ? group?.name || meta?.name || 'Group' : meta?.name || `${other?.user?.first_name ?? ''} ${other?.user?.last_name ?? ''}`.trim() || 'Contact';
  const photo = isGroup ? group?.avatarUrl || meta?.image_url : meta?.image_url || other?.user?.avatar_url;

  return (
    <Sheet open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="flex w-full flex-col gap-0 overflow-y-auto bg-[#f0f2f5] p-0 sm:max-w-[480px]">
        <SheetHeader className="border-b border-[#d1d7db] bg-[#f0f2f5] p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <SheetTitle>{isGroup ? 'Group info' : 'Contact info'}</SheetTitle>
        </SheetHeader>

        {/* Identity */}
        <div className="flex flex-col items-center bg-white p-6 shadow-sm">
          <div className="relative">
            <Avatar className="h-28 w-28 ring-4 ring-white shadow-md">
              <AvatarImage src={photo || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-serene-blue-100 to-serene-blue-50 text-3xl font-bold text-serene-blue-600">
                {title.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {isGroup && canManage && (
              <>
                <button
                  type="button"
                  onClick={() => fileInput.current?.click()}
                  disabled={uploading}
                  aria-label="Change group photo"
                  className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full bg-purple-600 text-white shadow-lg ring-2 ring-white"
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
                </button>
                <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={(e) => e.target.files?.[0] && changePhoto(e.target.files[0])} />
              </>
            )}
          </div>

          {editing ? (
            <div className="mt-4 w-full space-y-2">
              <Input value={draftName} onChange={(e) => setDraftName(e.target.value)} maxLength={80} aria-label="Group name" />
              <Textarea value={draftDesc} onChange={(e) => setDraftDesc(e.target.value)} maxLength={500} rows={3} placeholder="Add a group description" aria-label="Group description" />
              <div className="flex justify-end gap-2">
                <Button size="sm" variant="ghost" onClick={() => setEditing(false)} disabled={saving}>Cancel</Button>
                <Button size="sm" onClick={saveDetails} disabled={saving || draftName.trim().length < 2} className="gap-1.5">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} Save
                </Button>
              </div>
            </div>
          ) : (
            <>
              <h2 className="mt-3 text-xl font-bold text-serene-neutral-900">{title}</h2>
              {isGroup && group && (
                <p className="text-sm text-serene-neutral-500">
                  Group · {group.members.length} member{group.members.length === 1 ? '' : 's'}
                </p>
              )}
              {isGroup && group?.description && <p className="mt-2 whitespace-pre-line text-center text-sm text-serene-neutral-700">{group.description}</p>}
              {isGroup && canManage && group && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="mt-2 gap-1.5 text-purple-700"
                  onClick={() => {
                    setDraftName(group.name);
                    setDraftDesc(group.description ?? '');
                    setEditing(true);
                  }}
                >
                  <Pencil className="h-3.5 w-3.5" /> Edit name and description
                </Button>
              )}
              {!isGroup && other && onOpenProfile && (
                <Button size="sm" variant="outline" className="mt-3 rounded-full" onClick={() => onOpenProfile(other.user_id)}>
                  View full details
                </Button>
              )}
            </>
          )}
        </div>

        {/* Invite: group ID, link and QR travel together with the description */}
        {isGroup && group?.inviteCode && (
          <div className="mt-2 bg-white p-4 shadow-sm">
            <h3 className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-serene-neutral-400">Invite to this group</h3>
            <div className="flex flex-wrap items-center gap-2">
              <code className="select-all rounded-xl bg-purple-50 px-3 py-2 font-mono text-sm font-bold tracking-wider text-purple-800">{group.inviteCode}</code>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={copyInvite}>
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? 'Copied' : 'Copy link'}
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={shareInvite}>
                <Share2 className="h-4 w-4" /> Share
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowQr((v) => !v)}>
                <QrCode className="h-4 w-4" /> {showQr ? 'Hide QR' : 'QR code'}
              </Button>
              {isAdmin && (
                <Button size="sm" variant="ghost" className="gap-1.5 text-serene-neutral-500" onClick={resetInvite}>
                  <RefreshCw className="h-4 w-4" /> Reset link
                </Button>
              )}
            </div>
            {showQr && inviteLink && (
              <div className="mt-3 flex justify-center">
                <QrShare value={inviteLink} caption={`Scan to join "${group.name}". People sign in first, then confirm.`} filename={`group-${group.inviteCode}`} />
              </div>
            )}
          </div>
        )}

        {/* Members */}
        {isGroup && group && (
          <div className="mt-2 bg-white shadow-sm">
            <div className="flex items-center justify-between px-4 pt-3">
              <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-serene-neutral-400">
                <Users className="h-4 w-4" /> {group.members.length} members
              </h3>
              {canManage && (
                <Button size="sm" variant="ghost" className="gap-1.5 text-purple-700" onClick={() => setAdding((v) => !v)}>
                  {adding ? <X className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />} {adding ? 'Close' : 'Add'}
                </Button>
              )}
            </div>

            {adding && (
              <AddMembersPanel
                existing={new Set(group.members.map((m) => m.userId))}
                onAdd={(ids) => run('Could not add', async () => { const r = await addMembers(group.communityId, ids); toast({ title: r.added ? 'Added to the group' : 'Already in the group' }); })}
              />
            )}

            <ul className="divide-y divide-serene-neutral-50 px-2 py-1">
              {group.members.map((m) => (
                <li key={m.userId} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-serene-neutral-50">
                  <button type="button" onClick={() => onOpenProfile?.(m.userId)} className="flex min-w-0 flex-1 items-center gap-3 text-left touch-manipulation">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={m.avatarUrl ?? undefined} />
                      <AvatarFallback className="bg-serene-blue-100 text-sm font-semibold text-serene-blue-600">{m.name.charAt(0).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold text-serene-neutral-900">
                        {m.name}
                        {m.userId === currentUserId ? ' (You)' : ''}
                      </span>
                      <span className="block truncate text-xs capitalize text-serene-neutral-500">{String(m.userType ?? '').replace(/_/g, ' ')}</span>
                    </span>
                  </button>
                  {(m.role !== 'member' || m.isCreator) && (
                    <Badge className="bg-purple-100 text-purple-700 hover:bg-purple-100">{m.isCreator ? 'Creator' : m.role === 'admin' ? 'Admin' : 'Moderator'}</Badge>
                  )}
                  {isAdmin && !m.isCreator && m.userId !== currentUserId && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0" aria-label={`Manage ${m.name}`}>
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {m.role === 'admin' ? (
                          <DropdownMenuItem onClick={() => run('Could not change role', () => setMemberRole(group.communityId, m.userId, 'member'))}>
                            <ShieldOff className="mr-2 h-4 w-4" /> Remove as admin
                          </DropdownMenuItem>
                        ) : (
                          <DropdownMenuItem onClick={() => run('Could not change role', () => setMemberRole(group.communityId, m.userId, 'admin'))}>
                            <ShieldCheck className="mr-2 h-4 w-4" /> Make admin
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-red-600 focus:text-red-600"
                          onClick={() => window.confirm(`Remove ${m.name} from the group?`) && run('Could not remove', () => removeMember(group.communityId, m.userId))}
                        >
                          <UserMinus className="mr-2 h-4 w-4" /> Remove from group
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Shared media, docs and links */}
        <div className="mt-2 flex min-h-[320px] flex-col bg-white shadow-sm">
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)} className="px-4 pt-3">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="media">Media</TabsTrigger>
              <TabsTrigger value="docs">Docs</TabsTrigger>
              <TabsTrigger value="links">Links</TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex-1 p-4">
            {loading ? (
              <div className="py-8 text-center text-gray-500">Loading...</div>
            ) : items.length === 0 ? (
              <div className="py-8 text-center text-gray-400">No {activeTab} shared yet</div>
            ) : (
              <>
                {activeTab === 'media' && (
                  <div className="grid grid-cols-3 gap-2">
                    {items.flatMap((msg) =>
                      ((msg.attachments || []).concat((msg.metadata?.attachment_urls || []).map((url) => ({ url, type: msg.type as never, id: url }))))
                        .filter((a) => a.type === 'image' || a.type === 'video')
                        .map((att, i) => (
                          <a key={`${msg.id}-${i}`} href={att.url} target="_blank" rel="noreferrer" className="relative block aspect-square overflow-hidden rounded bg-gray-100">
                            {att.type === 'image' ? <img src={att.url} alt="shared" className="h-full w-full object-cover" /> : <video src={att.url} className="h-full w-full object-cover" />}
                          </a>
                        ))
                    )}
                  </div>
                )}

                {activeTab === 'docs' && (
                  <div className="flex flex-col gap-2">
                    {items.flatMap((msg) =>
                      ((msg.attachments || []).concat((msg.metadata?.attachment_urls || []).map((url) => ({ url, type: msg.type as never, name: 'Document', id: url }))))
                        .filter((a) => a.type === 'file')
                        .map((att, i) => (
                          <a href={att.url} target="_blank" rel="noreferrer" key={`${msg.id}-${i}`} className="flex items-center gap-3 rounded border p-2 hover:bg-gray-50">
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded bg-red-100 text-red-500">
                              <FileText className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="truncate text-sm font-medium">{att.name || msg.content || 'Document'}</div>
                              <div className="text-xs text-gray-500">{format(new Date(msg.created_at), 'MMM d, yyyy')}</div>
                            </div>
                            <Download className="h-4 w-4 text-gray-500" />
                          </a>
                        ))
                    )}
                  </div>
                )}

                {activeTab === 'links' && (
                  <div className="flex flex-col gap-2">
                    {items.map((msg) => (
                      <a
                        key={msg.id}
                        href={msg.metadata?.link_preview?.url || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="block overflow-hidden rounded-lg border bg-gray-50 transition-colors hover:bg-gray-100"
                      >
                        {msg.metadata?.link_preview?.image && <div className="h-32 w-full bg-cover bg-center" style={{ backgroundImage: `url(${msg.metadata.link_preview.image})` }} />}
                        <div className="p-2">
                          <div className="line-clamp-2 text-sm font-medium text-[#111b21]">{msg.metadata?.link_preview?.title || msg.content}</div>
                          <div className="mt-1 flex items-center text-xs text-gray-500">
                            <LinkIcon className="mr-1 h-3 w-3 shrink-0" />
                            <span className="truncate">{msg.metadata?.link_preview?.url}</span>
                          </div>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {isGroup && group && (
          <div className="mt-2 bg-white p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] shadow-sm">
            <Button variant="ghost" className="w-full justify-start gap-2 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={leave}>
              <LogOut className="h-4 w-4" /> Leave group
            </Button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Find people by name, or by their Sauti ID, and add them to the group. */
function AddMembersPanel({ existing, onAdd }: { existing: Set<string>; onAdd: (ids: string[]) => Promise<void> | void }) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<{ id: string; name: string; avatar: string | null; type: string | null }[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setBusy(true);
      try {
        const looksLikeId = term.replace(/[^A-Za-z0-9]/g, '').length >= 8 && /^(ss-?)?[a-z0-9]{4}-?[a-z0-9]{4}$/i.test(term.replace(/\s/g, ''));
        if (looksLikeId) {
          const hit = await findUserBySautiId(term);
          setResults(hit ? [{ id: hit.id, name: `${hit.first_name ?? ''} ${hit.last_name ?? ''}`.trim(), avatar: hit.avatar_url, type: hit.user_type }] : []);
        } else {
          const hits = await searchUsers(term);
          setResults((hits ?? []).map((h: { id: string; first_name: string | null; last_name: string | null; avatar_url: string | null; user_type: string | null }) => ({ id: h.id, name: `${h.first_name ?? ''} ${h.last_name ?? ''}`.trim(), avatar: h.avatar_url, type: h.user_type })));
        }
      } finally {
        setBusy(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div className="space-y-2 px-4 pb-2 pt-2">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-serene-neutral-400" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Name, or a Sauti ID (SS-XXXX-XXXX)" className="pl-9" autoComplete="off" />
      </div>
      {busy && <p className="text-xs text-serene-neutral-400">Searching...</p>}
      <ul className="max-h-48 space-y-1 overflow-y-auto">
        {results.map((r) => (
          <li key={r.id} className="flex items-center gap-3 rounded-xl p-2">
            <Avatar className="h-9 w-9">
              <AvatarImage src={r.avatar ?? undefined} />
              <AvatarFallback className="bg-serene-blue-100 text-xs font-semibold text-serene-blue-600">{r.name.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium">{r.name}</span>
              <span className="block text-xs capitalize text-serene-neutral-500">{String(r.type ?? '').replace(/_/g, ' ')}</span>
            </span>
            {existing.has(r.id) ? (
              <span className="text-xs text-serene-neutral-400">In group</span>
            ) : (
              <Button size="sm" onClick={async () => { await onAdd([r.id]); setQ(''); }}>
                Add
              </Button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
