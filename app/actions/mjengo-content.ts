'use server';

import { looseAdmin } from '@/lib/loose-db';
import { guard } from '@/lib/action-result';
import { logAudit } from '@/lib/access/audit';
import { requireAdminActor } from '@/lib/access/super-admin';
import { requireModule } from '@/lib/access/permissions';

import { CHANNELS, CHANNEL_INFO, type Channel, type Variant } from '@/lib/mjengo/channels';
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
  await requireModule('design');
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
  if (channels.includes('tiktok') && !(v.media ?? []).length) throw new Error('TikTok posts need an image.');
  const variants: Partial<Record<Channel, Variant>> = {};
  for (const c of channels) {
    const x = v.variants?.[c];
    if (!x) continue;
    const vb = (x.body ?? '').trim().slice(0, 10000);
    const tags = (x.hashtags ?? []).map((t) => t.trim().replace(/^#+/, '')).filter(Boolean).slice(0, 30);
    const mentions = (x.mentions ?? []).map((m) => m.trim().replace(/^@+/, '')).filter((m) => /^[A-Za-z0-9._-]{1,60}$/.test(m)).slice(0, 20);
    if (vb || tags.length || mentions.length) variants[c] = { ...(vb ? { body: vb } : {}), ...(tags.length ? { hashtags: tags } : {}), ...(mentions.length ? { mentions } : {}) };
  }
  let link: string | null = null;
  if (v.linkUrl?.trim()) {
    try { link = new URL(v.linkUrl.trim()).toString(); } catch { throw new Error('The link is not a valid web address.'); }
  }
  return { title: v.title?.trim().slice(0, 120) || null, body, channels, media: (v.media ?? []).slice(0, 10), scheduled_for: when, status, variants, link_url: link };
}

async function savePost_(id: string | null, v: PostInput): Promise<PostRow> {
  const a = await requireModule('design', 'write');
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
  const a = await requireModule('design', 'write');
  const { data } = await looseAdmin().from('mjengo_posts').update({ status: 'posted', posted_at: new Date().toISOString() }).eq('id', id).select('title, body').maybeSingle();
  if (data) await logAudit({ actorId: a.id, actorEmail: a.email, action: 'post.posted', targetType: 'post', targetId: id, targetLabel: data.title ?? data.body.slice(0, 60) });
}

async function deletePost_(id: string) {
  const a = await requireModule('design', 'owner');
  const { data } = await looseAdmin().from('mjengo_posts').delete().eq('id', id).select('title, body').maybeSingle();
  if (data) await logAudit({ actorId: a.id, actorEmail: a.email, action: 'post.deleted', targetType: 'post', targetId: id, targetLabel: data.title ?? data.body.slice(0, 60) });
}

export interface ConnectionRow { id: string; channel: Channel; account_name: string | null; connected_at: string }
export interface ChannelsState { connections: ConnectionRow[]; available: { linkedin: boolean; x: boolean; meta: boolean; tiktok: boolean } }

async function channels_(): Promise<ChannelsState> {
  await requireModule('design');
  const { data } = await looseAdmin().from('mjengo_channel_connections').select('id, channel, account_name, connected_at').order('connected_at');
  return { connections: (data ?? []) as ConnectionRow[], available: availableProviders() };
}

async function disconnect_(id: string) {
  const a = await requireModule('design', 'owner');
  const { data } = await looseAdmin().from('mjengo_channel_connections').delete().eq('id', id).select('channel, account_name').maybeSingle();
  if (data) await logAudit({ actorId: a.id, actorEmail: a.email, action: 'channel.disconnected', targetType: 'channel', targetLabel: `${data.channel} ${data.account_name ?? ''}`.trim() });
}

/** Publish now to every channel that has a connected account; returns what happened per channel. */
async function publishNow_(id: string): Promise<PostRow['results']> {
  const a = await requireModule('design', 'write');
  const { data } = await looseAdmin().from('mjengo_posts').select('id, title, body, channels, media, variants, link_url, results, status, created_by').eq('id', id).maybeSingle();
  if (!data) throw new Error('That post no longer exists.');
  if (!data.body?.trim()) throw new Error('Write the post first.');
  const results = await publishPost(data as unknown as PostForPublish);
  await logAudit({ actorId: a.id, actorEmail: a.email, action: 'post.published', targetType: 'post', targetId: id, targetLabel: data.title ?? data.body.slice(0, 60) });
  return results;
}

/** A caption for a post, written for the chosen networks. Plain text, no dashes, ready to edit. */
async function caption_(about: string, channels: Channel[]): Promise<string> {
  await requireModule('design');
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('AI is not set up on this site yet.');
  const where = channels.length ? channels.join(', ') : 'social media';
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: AbortSignal.timeout(30_000),
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'X-Title': 'Sauti Salama Content' },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL ?? 'qwen/qwen3.7-flash',
      reasoning: { enabled: false },
      temperature: 0.7,
      max_tokens: 400,
      messages: [
        { role: 'system', content: 'You write short, warm, plain posts for Sauti Salama, a survivor-led organisation in Kenya working on gender-based violence. Never include identifying details of survivors. Write like a person. Never use em dashes or en dashes. Reply with only the post text, with two or three relevant hashtags at the end.' },
        { role: 'user', content: `Write a post for ${where} about: ${about.slice(0, 1500)}` },
      ],
    }),
  });
  if (!res.ok) throw new Error('The AI service is unavailable right now.');
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return (j.choices?.[0]?.message?.content ?? '').replace(/\s*[\u2013\u2014]\s*/g, ', ').trim();
}

export interface SocialTag { id: string; channel: Channel; kind: 'mention' | 'hashtag'; value: string; label: string | null; auto: boolean }

async function tags_(): Promise<SocialTag[]> {
  await requireModule('design');
  const { data } = await looseAdmin().from('mjengo_social_tags').select('id, channel, kind, value, label, auto').order('kind').order('value');
  return (data ?? []) as SocialTag[];
}

async function saveTag_(v: { channel: Channel; kind: 'mention' | 'hashtag'; value: string; label?: string | null; auto?: boolean }, id?: string | null): Promise<SocialTag> {
  const a = await requireModule('design', 'write');
  if (!CHANNELS.includes(v.channel)) throw new Error('Unknown network.');
  const value = v.value.trim().replace(/^[#@]+/, '').replace(/\s+/g, '');
  if (!/^[A-Za-z0-9._-]{1,60}$/.test(value)) throw new Error('Use letters, numbers, dots, dashes or underscores.');
  const row = { channel: v.channel, kind: v.kind === 'hashtag' ? 'hashtag' : 'mention', value, label: v.label?.trim().slice(0, 60) || null, auto: !!v.auto };
  const db = looseAdmin();
  const q = id ? db.from('mjengo_social_tags').update(row).eq('id', id) : db.from('mjengo_social_tags').upsert({ ...row, created_by: a.id }, { onConflict: 'channel,kind,value' });
  const { data, error } = await q.select('id, channel, kind, value, label, auto').single();
  if (error || !data) throw new Error('Could not save that.');
  return data as SocialTag;
}

async function deleteTag_(id: string) {
  await requireModule('design', 'owner');
  await looseAdmin().from('mjengo_social_tags').delete().eq('id', id);
}

/** Rewrite the shared text in the voice and shape of one network, keeping the facts. */
async function adapt_(text: string, channel: Channel): Promise<string> {
  await requireModule('design', 'write');
  const info = CHANNEL_INFO[channel];
  const { askAi } = await import('@/lib/mjengo/ai');
  const rules: Record<Channel, string> = {
    linkedin: 'Professional but human. A hook in the first line, short paragraphs, a closing line that invites a reply. No hashtags (they are added separately).',
    x: `One tight post under 260 characters. Direct, no filler. No hashtags.`,
    facebook: 'Warm and conversational, a question at the end. No hashtags.',
    instagram: 'Caption for a picture post: friendly, a short first line that stands alone, line breaks, a call to action. Do not include a link. No hashtags.',
    tiktok: 'A short caption of one or two lines, energetic and simple. No hashtags.',
    website: 'A clear short article intro with a headline on the first line.',
  };
  const out = await askAi(
    `You adapt posts for ${info.label}. ${rules[channel]} Keep every fact, name and date exactly. Never add details about survivors. Reply with only the text.`,
    text.slice(0, 4000),
    600,
    { temperature: 0.6 }
  );
  return out.slice(0, info.limit);
}

export const suggestCaption = guard(caption_);
export const listSocialTags = guard(tags_);
export const saveSocialTag = guard(saveTag_);
export const deleteSocialTag = guard(deleteTag_);
export const adaptForChannel = guard(adapt_);
export const channelsState = guard(channels_);
export const disconnectChannel = guard(disconnect_);
export const publishPostNow = guard(publishNow_);
export const listPosts = guard(listPosts_);
export const savePost = guard(savePost_);
export const markPosted = guard(markPosted_);
export const deletePost = guard(deletePost_);
