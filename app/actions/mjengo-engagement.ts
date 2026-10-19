'use server';

import { looseAdmin } from '@/lib/loose-db';
import { guard } from '@/lib/action-result';
import { requireModule } from '@/lib/access/permissions';
import { decryptField } from '@/lib/security/crypto';

/**
 * How the organisation's own posts are doing on the networks it has connected, read through the official Graph API with the
 * connection already made for posting (nothing is scraped, and nobody else's account is read). Likes and comments need only
 * the access already given; reach needs Meta's "instagram_manage_insights" permission (it must be approved for the app and added when connecting), so it shows only when that is in place.
 */

export interface EngagedPost { id: string; channel: 'instagram' | 'facebook'; text: string; url: string | null; at: string; likes: number; comments: number; shares?: number; reach?: number }
export interface ChannelEngagement { channel: 'instagram' | 'facebook'; account: string | null; followers?: number; posts: EngagedPost[]; likes: number; comments: number; reach: number | null; note?: string }
export interface Engagement { channels: ChannelEngagement[]; checkedAt: string }

const G = 'https://graph.facebook.com/v21.0';

interface Conn { channel: string; account_id: string | null; account_name: string | null; access_token_enc: string }

async function get<T>(path: string, token: string, params: Record<string, string> = {}): Promise<T | { error: { message?: string } }> {
  const res = await fetch(`${G}/${path}?${new URLSearchParams({ ...params, access_token: token })}`, { signal: AbortSignal.timeout(15_000), cache: 'no-store' });
  return (await res.json().catch(() => ({ error: { message: 'No answer.' } }))) as T | { error: { message?: string } };
}
const failed = (x: unknown): x is { error: { message?: string } } => !!x && typeof x === 'object' && 'error' in x;

async function instagram(c: Conn): Promise<ChannelEngagement> {
  const token = decryptField(c.access_token_enc) ?? '';
  const out: ChannelEngagement = { channel: 'instagram', account: c.account_name, posts: [], likes: 0, comments: 0, reach: null };
  const me = await get<{ followers_count?: number }>(c.account_id ?? '', token, { fields: 'followers_count,username' });
  if (!failed(me)) out.followers = me.followers_count;
  const media = await get<{ data?: { id: string; caption?: string; permalink?: string; timestamp: string; like_count?: number; comments_count?: number }[] }>(`${c.account_id}/media`, token, { fields: 'id,caption,permalink,timestamp,like_count,comments_count', limit: '20' });
  if (failed(media)) { out.note = media.error.message ?? 'Instagram did not answer.'; return out; }
  let reach = 0; let reachKnown = false;
  for (const m of media.data ?? []) {
    const p: EngagedPost = { id: m.id, channel: 'instagram', text: (m.caption ?? '').slice(0, 160), url: m.permalink ?? null, at: m.timestamp, likes: m.like_count ?? 0, comments: m.comments_count ?? 0 };
    out.posts.push(p); out.likes += p.likes; out.comments += p.comments;
  }
  // Reach is only given with the insights permission; ask for the latest few and say so when it is not there yet.
  for (const p of out.posts.slice(0, 6)) {
    const ins = await get<{ data?: { name: string; values?: { value: number }[] }[] }>(`${p.id}/insights`, token, { metric: 'reach' });
    if (failed(ins)) { out.note = 'Reach needs Meta's insights permission, which this connection does not have.'; break; }
    const v = ins.data?.find((d) => d.name === 'reach')?.values?.[0]?.value;
    if (typeof v === 'number') { p.reach = v; reach += v; reachKnown = true; }
  }
  out.reach = reachKnown ? reach : null;
  return out;
}

async function facebook(c: Conn): Promise<ChannelEngagement> {
  const token = decryptField(c.access_token_enc) ?? '';
  const out: ChannelEngagement = { channel: 'facebook', account: c.account_name, posts: [], likes: 0, comments: 0, reach: null };
  const page = await get<{ followers_count?: number; fan_count?: number }>(c.account_id ?? '', token, { fields: 'followers_count,fan_count' });
  if (!failed(page)) out.followers = page.followers_count ?? page.fan_count;
  const posts = await get<{ data?: { id: string; message?: string; permalink_url?: string; created_time: string; reactions?: { summary?: { total_count?: number } }; comments?: { summary?: { total_count?: number } }; shares?: { count?: number } }[] }>(`${c.account_id}/posts`, token, { fields: 'id,message,permalink_url,created_time,reactions.summary(true).limit(0),comments.summary(true).limit(0),shares', limit: '20' });
  if (failed(posts)) { out.note = posts.error.message ?? 'Facebook did not answer.'; return out; }
  for (const m of posts.data ?? []) {
    const p: EngagedPost = { id: m.id, channel: 'facebook', text: (m.message ?? '').slice(0, 160), url: m.permalink_url ?? null, at: m.created_time, likes: m.reactions?.summary?.total_count ?? 0, comments: m.comments?.summary?.total_count ?? 0, shares: m.shares?.count ?? 0 };
    out.posts.push(p); out.likes += p.likes; out.comments += p.comments;
  }
  return out;
}

async function engagement_(): Promise<Engagement> {
  await requireModule('design');
  const { data } = await looseAdmin().from('mjengo_channel_connections').select('channel, account_id, account_name, access_token_enc').in('channel', ['instagram', 'facebook']);
  const conns = (data ?? []) as Conn[];
  const channels = await Promise.all(conns.map((c) => (c.channel === 'instagram' ? instagram(c) : facebook(c)).catch((): ChannelEngagement => ({ channel: c.channel as 'instagram' | 'facebook', account: c.account_name, posts: [], likes: 0, comments: 0, reach: null, note: 'Could not read this account just now.' }))));
  return { channels, checkedAt: new Date().toISOString() };
}

export const getEngagement = guard(engagement_);
