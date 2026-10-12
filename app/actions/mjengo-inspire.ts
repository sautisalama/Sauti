'use server';

import { guard } from '@/lib/action-result';
import { requireAdminActor } from '@/lib/access/super-admin';

import { SOURCE_INFO, type InspireSource } from '@/lib/mjengo/inspire-sources';

export interface InspireItem {
  id: string;
  title: string;
  /** Small picture for the grid. */
  thumb: string;
  /** Picture to place on the canvas. */
  full: string;
  credit: string;
  link: string | null;
  /** Unsplash asks for a ping when a picture is used. */
  track?: string;
}

const need = (source: InspireSource) => {
  const env = SOURCE_INFO[source].env;
  const key = env ? process.env[env] : 'none';
  if (!key) throw new Error(`${SOURCE_INFO[source].label} is not connected yet. Add ${env} to the site settings to switch it on.`);
  return key;
};

async function getJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'User-Agent': 'SautiSalama/1.0 (https://sautisalama.org)', Accept: 'application/json', ...(init?.headers ?? {}) }, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(res.status === 401 || res.status === 403 ? (url.includes('openverse') ? 'Openverse did not accept the request. Try again shortly.' : 'That service refused the key.') : res.status === 429 ? 'That service is busy. Try again in a minute.' : 'That service did not answer.');
  return (await res.json()) as T;
}

async function search_(source: InspireSource, query: string, page = 1): Promise<InspireItem[]> {
  await requireAdminActor();
  const q = query.trim().slice(0, 100) || (source === 'iconify' ? 'star' : source === 'giphy' ? 'celebrate' : 'community');
  const key = need(source);
  const pg = Math.max(1, Math.min(20, Math.round(page)));

  if (source === 'unsplash') {
    const j = await getJson<{ results?: { id: string; alt_description?: string | null; description?: string | null; urls: { small: string; regular: string }; user: { name: string }; links: { html: string; download_location: string } }[] }>(
      `https://api.unsplash.com/search/photos?${new URLSearchParams({ query: q, per_page: '24', page: String(pg) })}`, { headers: { Authorization: `Client-ID ${key}` } });
    return (j.results ?? []).map((r) => ({ id: r.id, title: r.alt_description || r.description || 'Photo', thumb: r.urls.small, full: r.urls.regular, credit: `Photo by ${r.user.name} on Unsplash`, link: r.links.html, track: r.links.download_location }));
  }
  if (source === 'pexels') {
    const j = await getJson<{ photos?: { id: number; alt?: string; url: string; photographer: string; src: { medium: string; large: string } }[] }>(
      `https://api.pexels.com/v1/search?${new URLSearchParams({ query: q, per_page: '24', page: String(pg) })}`, { headers: { Authorization: key } });
    return (j.photos ?? []).map((p) => ({ id: String(p.id), title: p.alt || 'Photo', thumb: p.src.medium, full: p.src.large, credit: `Photo by ${p.photographer} on Pexels`, link: p.url }));
  }
  if (source === 'pixabay') {
    const j = await getJson<{ hits?: { id: number; tags: string; webformatURL: string; largeImageURL: string; user: string; pageURL: string }[] }>(
      `https://pixabay.com/api/?${new URLSearchParams({ key, q, per_page: '24', page: String(pg), safesearch: 'true' })}`);
    return (j.hits ?? []).map((h) => ({ id: String(h.id), title: h.tags, thumb: h.webformatURL, full: h.largeImageURL, credit: `Image by ${h.user} on Pixabay`, link: h.pageURL }));
  }
  if (source === 'openverse') {
    const j = await getJson<{ results?: { id: string; title?: string; thumbnail?: string; creator?: string; license?: string; foreign_landing_url?: string }[] }>(
      `https://api.openverse.org/v1/images/?${new URLSearchParams({ q, page_size: '24', page: String(pg), license_type: 'commercial,modification' })}`);
    return (j.results ?? []).filter((r) => r.thumbnail).map((r) => ({ id: r.id, title: r.title || 'Image', thumb: r.thumbnail!, full: r.thumbnail!, credit: `${r.creator ? `By ${r.creator}, ` : ''}licence ${(r.license ?? '').toUpperCase()} (Openverse)`, link: r.foreign_landing_url ?? null }));
  }
  if (source === 'iconify') {
    const j = await getJson<{ icons?: string[] }>(`https://api.iconify.design/search?${new URLSearchParams({ query: q, limit: '48' })}`);
    return (j.icons ?? []).map((name) => {
      const [prefix, icon] = name.split(':');
      const url = `https://api.iconify.design/${prefix}/${icon}.svg`;
      return { id: name, title: icon.replace(/-/g, ' '), thumb: `${url}?height=96`, full: `${url}?height=512`, credit: `Icon set: ${prefix} (Iconify)`, link: `https://icon-sets.iconify.design/${prefix}/${icon}/` };
    });
  }
  // giphy
  const j = await getJson<{ data?: { id: string; title: string; url: string; user?: { display_name?: string }; images: { fixed_width_small?: { url: string }; downsized_medium?: { url: string }; original?: { url: string } } }[] }>(
    `https://api.giphy.com/v1/stickers/search?${new URLSearchParams({ api_key: key, q, limit: '24', offset: String((pg - 1) * 24), rating: 'g' })}`);
  return (j.data ?? []).map((g) => ({ id: g.id, title: g.title || 'Sticker', thumb: g.images.fixed_width_small?.url ?? g.images.original?.url ?? '', full: g.images.downsized_medium?.url ?? g.images.original?.url ?? '', credit: `${g.user?.display_name ? `By ${g.user.display_name} on ` : ''}GIPHY`, link: g.url })).filter((g) => g.thumb && g.full);
}

const IMAGE_HOSTS = [/(^|\.)pinimg\.com$/, /^images\.unsplash\.com$/, /^images\.pexels\.com$/, /(^|\.)pixabay\.com$/, /^api\.openverse\.org$/, /^api\.iconify\.design$/, /(^|\.)giphy\.com$/];

/** A picture from one of the inspiration sources as a data address, so it can sit on the canvas and be exported. */
async function image_(url: string, track?: string): Promise<string> {
  await requireAdminActor();
  const u = new URL(url);
  if (u.protocol !== 'https:' || !IMAGE_HOSTS.some((re) => re.test(u.hostname))) throw new Error('That picture is not from a supported source.');
  const res = await fetch(u, { signal: AbortSignal.timeout(25_000) });
  if (!res.ok) throw new Error('Could not fetch the picture.');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 6_000_000) throw new Error('That picture is too large.');
  if (track && process.env.UNSPLASH_ACCESS_KEY) {
    try {
      const t = new URL(track);
      if (t.hostname === 'api.unsplash.com') void fetch(t, { headers: { Authorization: `Client-ID ${process.env.UNSPLASH_ACCESS_KEY}` } }).catch(() => undefined);
    } catch { /* not a URL */ }
  }
  const type = res.headers.get('content-type')?.split(';')[0] || (u.pathname.endsWith('.svg') ? 'image/svg+xml' : 'image/jpeg');
  return `data:${type};base64,${buf.toString('base64')}`;
}

export interface Palette { name: string; colors: string[] }

/** Colours that go with a base colour (TheColorAPI), a few schemes at once. */
async function palettes_(hex: string): Promise<Palette[]> {
  await requireAdminActor();
  const h = hex.replace('#', '');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) throw new Error('Pick a colour first.');
  const modes: [string, string][] = [['analogic', 'Neighbours'], ['complement', 'Opposites'], ['triad', 'Triad'], ['quad', 'Four corners'], ['monochrome', 'Shades']];
  const out = await Promise.all(modes.map(async ([mode, name]) => {
    const j = await getJson<{ colors?: { hex: { value: string } }[] }>(`https://www.thecolorapi.com/scheme?${new URLSearchParams({ hex: h, mode, count: '5', format: 'json' })}`);
    return { name, colors: (j.colors ?? []).map((c) => c.hex.value) };
  }));
  return out.filter((p) => p.colors.length);
}

export const inspireSearch = guard(search_);
export const inspireImage = guard(image_);
export const colourSchemes = guard(palettes_);
