export type Channel = 'linkedin' | 'x' | 'facebook' | 'instagram' | 'tiktok' | 'website';

export const CHANNELS: Channel[] = ['website', 'linkedin', 'x', 'facebook', 'instagram', 'tiktok'];

/** Channels that need a connected account (the website is ours). */
export const NEEDS_ACCOUNT: Channel[] = ['linkedin', 'x', 'facebook', 'instagram', 'tiktok'];

export const CHANNEL_INFO: Record<Channel, { label: string; limit: number; needsImage: boolean; color: string; composeUrl: (text: string) => string }> = {
  linkedin: { label: 'LinkedIn', limit: 3000, needsImage: false, color: '#0a66c2', composeUrl: () => 'https://www.linkedin.com/feed/' },
  x: { label: 'X', limit: 280, needsImage: false, color: '#111827', composeUrl: (t) => `https://x.com/intent/post?text=${encodeURIComponent(t)}` },
  facebook: { label: 'Facebook', limit: 63206, needsImage: false, color: '#1877f2', composeUrl: () => 'https://www.facebook.com/' },
  instagram: { label: 'Instagram', limit: 2200, needsImage: true, color: '#c13584', composeUrl: () => 'https://www.instagram.com/' },
  tiktok: { label: 'TikTok', limit: 2200, needsImage: true, color: '#111827', composeUrl: () => 'https://www.tiktok.com/upload' },
  website: { label: 'Website', limit: 10000, needsImage: false, color: '#068297', composeUrl: () => '/dashboard/admin/blogs' },
};

export interface Variant { body?: string; hashtags?: string[] }

/** What goes out on one channel: its own wording or the shared text, hashtags, and the link with tracking. */
export function textFor(post: { body: string; variants: Partial<Record<Channel, Variant>>; link_url: string | null; title: string | null }, channel: Channel): string {
  const v = post.variants?.[channel];
  let text = (v?.body?.trim() || post.body).trim();
  const tags = (v?.hashtags ?? []).map((t) => t.trim().replace(/^#*/, '#').replace(/\s+/g, '')).filter((t) => t.length > 1);
  if (tags.length) text += `\n\n${tags.join(' ')}`;
  if (post.link_url) text += `\n\n${withUtm(post.link_url, channel, post.title)}`;
  return text;
}

export function withUtm(url: string, channel: Channel, campaign: string | null): string {
  try {
    const u = new URL(url);
    if (!u.searchParams.has('utm_source')) u.searchParams.set('utm_source', channel);
    if (!u.searchParams.has('utm_medium')) u.searchParams.set('utm_medium', 'social');
    if (!u.searchParams.has('utm_campaign') && campaign) u.searchParams.set('utm_campaign', campaign.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40));
    return u.toString();
  } catch {
    return url;
  }
}


/** What each network wants from a picture, so a post is checked before it goes out. Ratios are width / height. */
export const ASPECT: Record<Channel, { recommended: string; size: [number, number]; min: number; max: number; designSize: string }> = {
  linkedin: { recommended: '1.91:1 (1200 x 627) or square', size: [1200, 627], min: 0.4, max: 2.4, designSize: 'linkedin' },
  x: { recommended: '16:9 (1600 x 900)', size: [1600, 900], min: 0.5, max: 2.0, designSize: 'x' },
  facebook: { recommended: '1.91:1 (1200 x 630) or square', size: [1200, 630], min: 0.5, max: 2.0, designSize: 'facebook' },
  instagram: { recommended: 'square (1080 x 1080) or 4:5 (1080 x 1350)', size: [1080, 1350], min: 0.8, max: 1.91, designSize: 'instagram' },
  tiktok: { recommended: '9:16 (1080 x 1920)', size: [1080, 1920], min: 0.5, max: 0.8, designSize: 'story' },
  website: { recommended: '16:9 (1600 x 900)', size: [1600, 900], min: 0.5, max: 2.5, designSize: 'x' },
};

/** A plain sentence when the picture's shape will not suit the network, or null when it will. */
export function aspectProblem(channel: Channel, w: number, h: number): string | null {
  if (!w || !h) return null;
  const r = w / h;
  const a = ASPECT[channel];
  if (r < a.min) return `Too tall for ${CHANNEL_INFO[channel].label}. Use ${a.recommended}.`;
  if (r > a.max) return `Too wide for ${CHANNEL_INFO[channel].label}. Use ${a.recommended}.`;
  if (channel === 'tiktok' && r > 0.7) return `TikTok photos look best at ${a.recommended}; this one will have bars.`;
  return null;
}
