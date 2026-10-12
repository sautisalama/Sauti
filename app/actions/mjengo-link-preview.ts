'use server';

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { guard } from '@/lib/action-result';
import { requireAdminActor } from '@/lib/access/super-admin';

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

const MAX_BYTES = 1_500_000;

function privateIp(ip: string): boolean {
  if (isIP(ip) === 6) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true;
    const m = v.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return m ? privateIp(m[1]) : false;
  }
  const [a = 0, b = 0] = ip.split('.').map(Number);
  return a === 10 || a === 127 || a === 0 || a >= 224 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127);
}

async function assertPublic(raw: string): Promise<URL> {
  const u = new URL(raw);
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Only web links can be previewed.');
  if (u.username || u.password) throw new Error('Links with a password are not fetched.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) throw new Error('That address is private.');
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => privateIp(a.address))) throw new Error('That address is private.');
  return u;
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
  let url = (await assertPublic(raw)).toString();
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(url, {
      redirect: 'manual',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; SautiSalamaPreview/1.0; +https://sautisalama.org)', accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', 'accept-language': 'en' },
      signal: AbortSignal.timeout(10_000),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = (await assertPublic(new URL(res.headers.get('location')!, url).toString())).toString();
      continue;
    }
    if (!res.ok) throw new Error('That page did not open (' + res.status + ').');
    if (!/html|xml/i.test(res.headers.get('content-type') ?? '')) throw new Error('That link is not a web page.');
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (reader) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      total += value.byteLength;
      chunks.push(value);
      if (total > MAX_BYTES) { await reader.cancel(); break; }
    }
    const html = new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks));
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
  throw new Error('That link redirects too many times.');
}

export const linkPreview = guard(async (raw: string): Promise<LinkPreview> => {
  await requireAdminActor();
  const text = String(raw ?? '').trim();
  if (!text) throw new Error('Paste a link first.');
  return load(/^https?:\/\//i.test(text) ? text : `https://${text}`);
});
