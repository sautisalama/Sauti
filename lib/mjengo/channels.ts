export type Channel = 'linkedin' | 'x' | 'facebook' | 'instagram';

export const CHANNELS: Channel[] = ['linkedin', 'x', 'facebook', 'instagram'];

export const CHANNEL_INFO: Record<Channel, { label: string; limit: number; needsImage: boolean; color: string; composeUrl: (text: string) => string }> = {
  linkedin: { label: 'LinkedIn', limit: 3000, needsImage: false, color: '#0a66c2', composeUrl: () => 'https://www.linkedin.com/feed/' },
  x: { label: 'X', limit: 280, needsImage: false, color: '#111827', composeUrl: (t) => `https://x.com/intent/post?text=${encodeURIComponent(t)}` },
  facebook: { label: 'Facebook', limit: 63206, needsImage: false, color: '#1877f2', composeUrl: () => 'https://www.facebook.com/' },
  instagram: { label: 'Instagram', limit: 2200, needsImage: true, color: '#c13584', composeUrl: () => 'https://www.instagram.com/' },
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

