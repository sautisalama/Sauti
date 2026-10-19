import { createHash } from 'node:crypto';
import { looseAdmin } from '@/lib/loose-db';
import { assertPublic } from '@/lib/mjengo/safe-fetch';

/**
 * Instagram posts for link previews, without logging in and without pretending to be anyone's crawler.
 * One public post address in, a few plain fields out (who posted, the caption, a picture, when, what kind).
 * Nothing else is asked for or kept: no comments, no profiles, no counts. Order: Meta's own oEmbed when the app is set
 * up, then a cloud provider when a token is set, otherwise nothing (and people are told how to add it by hand).
 *
 * Switches (environment): SOCIAL_PROVIDER=off turns every lookup off at once; META_APP_ID and META_APP_SECRET enable
 * oEmbed; APIFY_TOKEN enables the provider (SOCIAL_ACTOR picks the actor, default apify/instagram-scraper);
 * SOCIAL_DAILY_CAP limits paid lookups per day (default 60).
 */
export interface SocialPost { url: string; author: string | null; caption: string | null; image: string | null; takenAt: string | null; kind: 'post' | 'reel' | 'video' | 'carousel'; source: 'oembed' | 'apify'; /** Accounts @mentioned in the caption. */ mentions: string[]; /** Accounts tagged in the picture or as collaborators. */ tagged: string[] }
/** What a profile gives a preview: who it is and where its bio links to. Nothing about its followers or posts. */
export interface SocialProfile { handle: string; name: string | null; bio: string | null; websites: string[]; verified: boolean; business: boolean; private: boolean }
export type SocialStatus = 'ok' | 'off' | 'unsupported' | 'capped' | 'blocked' | 'failed';
export interface SocialResult { status: SocialStatus; post: SocialPost | null; message: string }

const POST = /^\/(?:[A-Za-z0-9_.]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]{5,})\/?/;
const IMAGE_HOST = /(^|\.)(cdninstagram\.com|fbcdn\.net)$/i;
const DAY = 86400_000;

export const isInstagramHost = (raw: string): boolean => { try { return /(^|\.)instagram\.com$/i.test(new URL(raw).hostname); } catch { return false; } };

/** The one public post or reel a link points at, in its plain form. Profiles, stories, hashtags and search pages are not posts. */
export function instagramPostUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    if (!/(^|\.)instagram\.com$/i.test(u.hostname)) return null;
    const m = POST.exec(u.pathname);
    if (!m) return null;
    return `https://www.instagram.com/${m[1] === 'reels' ? 'reel' : m[1]}/${m[2]}/`;
  } catch { return null; }
}

export const hashOf = (url: string) => createHash('sha1').update(url).digest('hex');

const enabled = () => (process.env.SOCIAL_PROVIDER ?? 'auto').toLowerCase() !== 'off';
const hasOembed = () => !!(process.env.META_APP_ID && process.env.META_APP_SECRET);
const hasApify = () => !!process.env.APIFY_TOKEN;
export const socialConfigured = () => enabled() && (hasOembed() || hasApify());

const trim = (v: unknown, n: number): string | null => (typeof v === 'string' && v.trim() ? v.replace(/\s+/g, ' ').trim().slice(0, n) : null);

async function viaOembed(url: string): Promise<SocialPost | null> {
  const token = `${process.env.META_APP_ID}|${process.env.META_APP_SECRET}`;
  const res = await fetch(`https://graph.facebook.com/v21.0/instagram_oembed?${new URLSearchParams({ url, omitscript: 'true', fields: 'author_name,thumbnail_url,title' })}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10_000) });
  if (!res.ok) return null;
  const j = (await res.json()) as { author_name?: string; thumbnail_url?: string; title?: string };
  if (!j.author_name && !j.title && !j.thumbnail_url) return null;
  return { url, author: trim(j.author_name, 60), caption: trim(j.title, 1200), image: trim(j.thumbnail_url, 800), takenAt: null, kind: url.includes('/reel/') ? 'reel' : 'post', source: 'oembed', mentions: [], tagged: [] };
}

const HANDLE = /^[A-Za-z0-9._]{1,30}$/;
const handles = (v: unknown): string[] => (Array.isArray(v) ? [...new Set(v.filter((x): x is string => typeof x === 'string' && HANDLE.test(x)))].slice(0, 8) : []);

/** One run of the provider's actor, returning its items. */
async function apifyItems(input: Record<string, unknown>): Promise<Record<string, unknown>[]> {
  const actor = (process.env.SOCIAL_ACTOR ?? 'apify/instagram-scraper').replace('/', '~');
  const res = await fetch(`https://api.apify.com/v2/acts/${actor}/run-sync-get-dataset-items?timeout=60&memory=512`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.APIFY_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(70_000),
  });
  if (!res.ok) throw new Error(`provider ${res.status}`);
  const items = (await res.json()) as Record<string, unknown>[];
  return Array.isArray(items) ? items : [];
}

async function viaApify(url: string): Promise<{ post: SocialPost | null; blocked: boolean }> {
  // One post only, and none of its comments or its author's profile.
  const items = await apifyItems({ directUrls: [url], resultsType: 'posts', resultsLimit: 1, addParentData: false });
  const it = items[0];
  if (!it || it.error || it.errorDescription) return { post: null, blocked: true };
  const type = String(it.type ?? '').toLowerCase();
  const images = Array.isArray(it.images) ? (it.images as unknown[]) : [];
  return {
    blocked: false,
    post: {
      url, source: 'apify',
      author: trim(it.ownerUsername, 60) ?? trim(it.ownerFullName, 60),
      caption: trim(it.caption, 1200),
      image: trim(it.displayUrl, 800) ?? trim(images[0], 800),
      takenAt: typeof it.timestamp === 'string' ? it.timestamp.slice(0, 25) : null,
      kind: it.productType === 'clips' || url.includes('/reel/') ? 'reel' : type === 'video' ? 'video' : type === 'sidecar' ? 'carousel' : 'post',
      mentions: handles(it.mentions),
      tagged: handles(it.taggedUsers),
    },
  };
}

/** Keep the picture ourselves: Instagram's picture addresses stop working after a few days. Only Instagram's own picture hosts are fetched. */
async function keepImage(hash: string, image: string | null): Promise<string | null> {
  if (!image) return null;
  try {
    const u = await assertPublic(image);
    if (u.protocol !== 'https:' || !IMAGE_HOST.test(u.hostname)) return null;
    const res = await fetch(u, { signal: AbortSignal.timeout(10_000), redirect: 'error' });
    const type = res.headers.get('content-type') ?? '';
    if (!res.ok || !/^image\/(jpeg|png|webp)/i.test(type)) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > 3_000_000) return null;
    const { error } = await looseAdmin().storage.from('mjengo-docs').upload(`social/${hash}`, bytes, { contentType: type, upsert: true });
    return error ? null : `/api/social-image/${hash}`;
  } catch { return null; }
}

/**
 * Look up one public Instagram post for a preview. Cached for 30 days; capped per day so a cost can never run away.
 * Returns why when it could not (off, not a post, over the cap, private or removed, provider trouble).
 */
export async function instagramPost(raw: string): Promise<SocialResult> {
  const url = instagramPostUrl(raw);
  if (!url) return { status: 'unsupported', post: null, message: 'Only links to a single public post or reel can be previewed.' };
  if (!socialConfigured()) return { status: 'off', post: null, message: 'Instagram previews are not switched on.' };
  const db = looseAdmin();
  const hash = hashOf(url);
  const { data: hit } = await db.from('mjengo_social_cache').select('data, fetched_at').eq('url_hash', hash).maybeSingle();
  if (hit && Date.now() - new Date(hit.fetched_at).getTime() < 30 * DAY) {
    const d = hit.data as { blocked?: boolean; post?: SocialPost };
    return d.post ? { status: 'ok', post: d.post, message: '' } : { status: 'blocked', post: null, message: 'That post is private, removed or not public.' };
  }
  const cap = Math.max(1, Number(process.env.SOCIAL_DAILY_CAP) || 60);
  const { count } = await db.from('mjengo_social_cache').select('*', { count: 'exact', head: true }).gt('fetched_at', new Date(Date.now() - DAY).toISOString());
  if ((count ?? 0) >= cap) return { status: 'capped', post: null, message: 'Today\'s limit for Instagram lookups has been reached. Paste the caption instead.' };

  let post: SocialPost | null = null;
  let blocked = false;
  try {
    if (hasOembed()) post = await viaOembed(url).catch(() => null);
    if (!post && hasApify()) { const r = await viaApify(url); post = r.post; blocked = r.blocked; }
  } catch { return { status: 'failed', post: null, message: 'The lookup did not work just now. Try again, or paste the caption.' }; }
  if (post) post = { ...post, image: await keepImage(hash, post.image) };
  await db.from('mjengo_social_cache').upsert({ url_hash: hash, url, provider: post?.source ?? 'apify', data: post ? { post } : { blocked: true }, fetched_at: new Date().toISOString() }, { onConflict: 'url_hash' });
  return post ? { status: 'ok', post, message: '' } : { status: 'blocked', post: null, message: blocked ? 'That post is private, removed or not public.' : 'Nothing could be read from that link.' };
}

/** What a preview shows for a post. */
export const previewOf = (p: SocialPost) => ({
  title: `${p.author ? `${p.author} on Instagram` : 'Instagram'}${p.kind === 'reel' ? ' (reel)' : ''}`,
  description: p.caption?.slice(0, 300) ?? undefined,
  image: p.image ?? undefined,
  url: p.url,
});

const urls = (...v: unknown[]): string[] => [...new Set(v.flatMap((x) => (Array.isArray(x) ? x : [x])).map((x) => (typeof x === 'string' ? x : x && typeof x === 'object' && typeof (x as { url?: unknown }).url === 'string' ? (x as { url: string }).url : '')).filter((u) => /^https?:\/\//i.test(u)).map((u) => u.slice(0, 300)))].slice(0, 4);

/**
 * A public profile's name, bio and the link in its bio: where an organisation's own website is usually found. Cached for
 * 30 days and counted against the same daily cap. Returns null when it is off, private, missing or over the cap.
 */
export async function instagramProfile(handle: string): Promise<SocialProfile | null> {
  const h = handle.replace(/^@/, '');
  if (!HANDLE.test(h) || !hasApify() || !enabled()) return null;
  const url = `https://www.instagram.com/${h}/`;
  const db = looseAdmin();
  const hash = hashOf(url);
  const { data: hit } = await db.from('mjengo_social_cache').select('data, fetched_at').eq('url_hash', hash).maybeSingle();
  if (hit && Date.now() - new Date(hit.fetched_at).getTime() < 30 * DAY) return (hit.data as { profile?: SocialProfile }).profile ?? null;
  const cap = Math.max(1, Number(process.env.SOCIAL_DAILY_CAP) || 60);
  const { count } = await db.from('mjengo_social_cache').select('*', { count: 'exact', head: true }).gt('fetched_at', new Date(Date.now() - DAY).toISOString());
  if ((count ?? 0) >= cap) return null;
  let profile: SocialProfile | null = null;
  try {
    const it = (await apifyItems({ directUrls: [url], resultsType: 'details', resultsLimit: 1, addParentData: false }))[0];
    if (it && !it.error && !it.errorDescription) {
      profile = {
        handle: trim(it.username, 30) ?? h, name: trim(it.fullName, 100), bio: trim(it.biography, 400),
        websites: urls(it.externalUrls, it.externalUrl), verified: !!it.verified, business: !!it.isBusinessAccount, private: !!it.private,
      };
    }
  } catch { return null; }
  await db.from('mjengo_social_cache').upsert({ url_hash: hash, url, provider: 'apify', data: profile ? { profile } : { blocked: true }, fetched_at: new Date().toISOString() }, { onConflict: 'url_hash' });
  return profile;
}
