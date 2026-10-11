'use server';

import { looseAdmin } from '@/lib/loose-db';
import { guard } from '@/lib/action-result';
import { logAudit } from '@/lib/access/audit';
import { requireAdminActor } from '@/lib/access/super-admin';

import { CHANNELS, type Channel, type Variant } from '@/lib/mjengo/channels';
import { availableProviders } from '@/lib/mjengo/channel-oauth';
import { publishPost, type PostForPublish } from '@/lib/mjengo/publishers';

export interface PostRow {
  id: string;
  title: string | null;
  body: string;
  channels: Channel[];
  media: string[];
  scheduled_for: string | null;
  status: 'draft' | 'scheduled' | 'posted' | 'cancelled';
  posted_at: string | null;
  created_by: string | null;
  created_at: string;
  variants: Partial<Record<Channel, Variant>>;
  results: Record<string, { ok: boolean; message: string; at: string; url?: string }>;
  link_url: string | null;
}

export interface PostInput {
  title?: string | null;
  body: string;
  channels: Channel[];
  media?: string[];
  scheduledFor?: string | null;
  status?: PostRow['status'];
  variants?: Partial<Record<Channel, Variant>>;
  linkUrl?: string | null;
}

const COLS = 'id, title, body, channels, media, scheduled_for, status, posted_at, created_by, created_at, variants, results, link_url';

async function listPosts_(): Promise<PostRow[]> {
  await requireAdminActor();
  const { data } = await looseAdmin().from('mjengo_posts').select(COLS).order('scheduled_for', { ascending: true, nullsFirst: false }).limit(1000);
  return (data ?? []) as PostRow[];
}

function normalise(v: PostInput) {
  const body = (v.body ?? '').trim().slice(0, 10000);
  const channels = [...new Set((v.channels ?? []).filter((c) => CHANNELS.includes(c)))];
  let when: string | null = null;
  if (v.scheduledFor) {
    const d = new Date(v.scheduledFor);
    if (Number.isNaN(d.getTime())) throw new Error('That date and time is not valid.');
    when = d.toISOString();
  }
  const status: PostRow['status'] = v.status ?? (when ? 'scheduled' : 'draft');
  if (status === 'scheduled' && !when) throw new Error('Pick a date and time to schedule it.');
  if (status === 'scheduled' && !channels.length) throw new Error('Choose at least one channel.');
  if (status !== 'draft' && !body) throw new Error('Write the post first.');
  if (channels.includes('x') && body.length > 280) throw new Error('X posts are limited to 280 characters.');
  if (channels.includes('instagram') && !(v.media ?? []).length) throw new Error('Instagram posts need an image.');
  const variants: Partial<Record<Channel, Variant>> = {};
  for (const c of channels) {
    const x = v.variants?.[c];
    if (!x) continue;
    const vb = (x.body ?? '').trim().slice(0, 10000);
    const tags = (x.hashtags ?? []).map((t) => t.trim().replace(/^#+/, '')).filter(Boolean).slice(0, 30);
    if (vb || tags.length) variants[c] = { ...(vb ? { body: vb } : {}), ...(tags.length ? { hashtags: tags } : {}) };
  }
  let link: string | null = null;
  if (v.linkUrl?.trim()) {
    try { link = new URL(v.linkUrl.trim()).toString(); } catch { throw new Error('The link is not a valid web address.'); }
  }
  return { title: v.title?.trim().slice(0, 120) || null, body, channels, media: (v.media ?? []).slice(0, 10), scheduled_for: when, status, variants, link_url: link };
}

async function savePost_(id: string | null, v: PostInput): Promise<PostRow> {
  const a = await requireAdminActor();
  const row = normalise(v);
  const db = looseAdmin();
  const q = id
    ? db.from('mjengo_posts').update({ ...row, notified_at: null, updated_at: new Date().toISOString() }).eq('id', id)
    : db.from('mjengo_posts').insert({ ...row, created_by: a.id });
  const { data, error } = await q.select(COLS).single();
  if (error || !data) throw new Error('Could not save the post.');
  await logAudit({ actorId: a.id, actorEmail: a.email, action: id ? 'post.updated' : 'post.created', targetType: 'post', targetId: data.id, targetLabel: data.title ?? data.body.slice(0, 60) });
  return data as PostRow;
}

async function markPosted_(id: string) {
  const a = await requireAdminActor();
  const { data } = await looseAdmin().from('mjengo_posts').update({ status: 'posted', posted_at: new Date().toISOString() }).eq('id', id).select('title, body').maybeSingle();
  if (data) await logAudit({ actorId: a.id, actorEmail: a.email, action: 'post.posted', targetType: 'post', targetId: id, targetLabel: data.title ?? data.body.slice(0, 60) });
}

async function deletePost_(id: string) {
  const a = await requireAdminActor();
  const { data } = await looseAdmin().from('mjengo_posts').delete().eq('id', id).select('title, body').maybeSingle();
  if (data) await logAudit({ actorId: a.id, actorEmail: a.email, action: 'post.deleted', targetType: 'post', targetId: id, targetLabel: data.title ?? data.body.slice(0, 60) });
}

export interface ConnectionRow { id: string; channel: Channel; account_name: string | null; connected_at: string }
export interface ChannelsState { connections: ConnectionRow[]; available: { linkedin: boolean; x: boolean; meta: boolean } }

async function channels_(): Promise<ChannelsState> {
  await requireAdminActor();
  const { data } = await looseAdmin().from('mjengo_channel_connections').select('id, channel, account_name, connected_at').order('connected_at');
  return { connections: (data ?? []) as ConnectionRow[], available: availableProviders() };
}

async function disconnect_(id: string) {
  const a = await requireAdminActor();
  const { data } = await looseAdmin().from('mjengo_channel_connections').delete().eq('id', id).select('channel, account_name').maybeSingle();
  if (data) await logAudit({ actorId: a.id, actorEmail: a.email, action: 'channel.disconnected', targetType: 'channel', targetLabel: `${data.channel} ${data.account_name ?? ''}`.trim() });
}

/** Publish now to every channel that has a connected account; returns what happened per channel. */
async function publishNow_(id: string): Promise<PostRow['results']> {
  const a = await requireAdminActor();
  const { data } = await looseAdmin().from('mjengo_posts').select('id, title, body, channels, media, variants, link_url, results, status').eq('id', id).maybeSingle();
  if (!data) throw new Error('That post no longer exists.');
  if (!data.body?.trim()) throw new Error('Write the post first.');
  const results = await publishPost(data as unknown as PostForPublish);
  await logAudit({ actorId: a.id, actorEmail: a.email, action: 'post.published', targetType: 'post', targetId: id, targetLabel: data.title ?? data.body.slice(0, 60) });
  return results;
}

export const channelsState = guard(channels_);
export const disconnectChannel = guard(disconnect_);
export const publishPostNow = guard(publishNow_);
export const listPosts = guard(listPosts_);
export const savePost = guard(savePost_);
export const markPosted = guard(markPosted_);
export const deletePost = guard(deletePost_);
