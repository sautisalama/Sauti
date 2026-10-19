'use server';

import { guard } from '@/lib/action-result';
import { requireAdminActor } from '@/lib/access/super-admin';
import { fetchHtml } from '@/lib/mjengo/safe-fetch';
import { instagramPost, isInstagramHost } from '@/lib/mjengo/social-fetch';

export interface LinkPreview {
  url: string;
  title: string | null;
  description: string | null;
  image: string | null;
  organisation: string | null;
  siteName: string | null;
  favicon: string | null;
  deadline: string | null;
}

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#x27;/g, "'").replace(/\s+/g, ' ').trim();

function metaContent(html: string, names: string[]): string | null {
  for (const n of names) {
    const esc = n.replace(/[^a-zA-Z0-9:_-]/g, (c) => `\\${c}`);
    const a = new RegExp(`<meta[^>]+(?:property|name)=["']${esc}["'][^>]*?content=["']([^"']*)["']`, 'i').exec(html);
    const b = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*?(?:property|name)=["']${esc}["']`, 'i').exec(html);
    const v = (a?.[1] ?? b?.[1])?.trim();
    if (v) return decode(v);
  }
  return null;
}

/** Looks for who is behind the page in structured data (hiringOrganization, publisher, author, Organization). */
function orgFromJsonLd(html: string): { organisation: string | null; deadline: string | null } {
  let organisation: string | null = null;
  let deadline: string | null = null;
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  const nameOf = (v: unknown): string | null => {
    if (!v) return null;
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return nameOf(v[0]);
    if (typeof v === 'object' && typeof (v as { name?: unknown }).name === 'string') return (v as { name: string }).name;
    return null;
  };
  const walk = (node: unknown, depth = 0) => {
    if (!node || typeof node !== 'object' || depth > 5) return;
    if (Array.isArray(node)) return node.forEach((n) => walk(n, depth + 1));
    const o = node as Record<string, unknown>;
    organisation ??= nameOf(o.hiringOrganization) ?? nameOf(o.organizer) ?? nameOf(o.funder) ?? nameOf(o.publisher) ?? nameOf(o.provider)
      ?? (o['@type'] === 'Organization' || o['@type'] === 'NGO' ? nameOf(o) : null);
    if (!deadline && typeof (o.validThrough ?? o.endDate) === 'string') deadline = String(o.validThrough ?? o.endDate).slice(0, 10);
    for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v, depth + 1);
  };
  while ((m = re.exec(html))) {
    try { walk(JSON.parse(m[1])); } catch { /* broken JSON-LD */ }
  }
  return { organisation: organisation ? decode(organisation) : null, deadline };
}

async function load(raw: string): Promise<LinkPreview> {
  const { url, html } = await fetchHtml(raw);
  const abs = (v: string | null) => { if (!v) return null; try { return new URL(v, url).toString(); } catch { return null; } };
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const icon = /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["']/i.exec(html)?.[1] ?? null;
  const ld = orgFromJsonLd(html);
  const host = new URL(url).hostname.replace(/^www\./, '');
  const siteName = metaContent(html, ['og:site_name', 'application-name']);
  return {
    url,
    title: metaContent(html, ['og:title', 'twitter:title']) ?? (titleTag ? decode(titleTag) : null),
    description: metaContent(html, ['og:description', 'twitter:description', 'description']),
    image: abs(metaContent(html, ['og:image', 'twitter:image', 'twitter:image:src'])),
    organisation: ld.organisation ?? metaContent(html, ['article:publisher', 'author']) ?? siteName ?? host,
    siteName: siteName ?? host,
    favicon: abs(icon) ?? `${new URL(url).origin}/favicon.ico`,
    deadline: ld.deadline,
  };
}

export const linkPreview = guard(async (raw: string): Promise<LinkPreview> => {
  await requireAdminActor();
  const text = String(raw ?? '').trim();
  if (!text) throw new Error('Paste a link first.');
  const url = /^https?:\/\//i.test(text) ? text : `https://${text}`;
  if (isInstagramHost(url)) {
    // Instagram is never read as a page (it asks for a sign-in); a public post is looked up through the shared adapter.
    const r = await instagramPost(url);
    if (!r.post) throw new Error(r.message);
    return { url: r.post.url, title: `${r.post.author ? `${r.post.author} on Instagram` : 'Instagram'}`, description: r.post.caption?.slice(0, 300) ?? null, image: r.post.image, organisation: r.post.author, siteName: 'Instagram', favicon: null, deadline: null };
  }
  return load(url);
});
