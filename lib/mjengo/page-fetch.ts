import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

/**
 * Fetch a public web page safely and read what a link preview reads: title, description, picture, site name,
 * the organisation named in structured data, its links and its text. Server-only. Users choose these links,
 * so private networks are never contacted.
 */

export interface PageMeta {
  finalUrl: string;
  status: number;
  title: string | null;
  description: string | null;
  image: string | null;
  siteName: string | null;
  favicon: string | null;
  organisation: string | null;
  deadline: string | null;
  jsonLd: unknown[];
  links: string[];
  /** The same links with the words they are written on ("Apply here", "Official website"). */
  anchors: { href: string; text: string }[];
  text: string;
}

const MAX_BYTES = 1_500_000;
const MAX_TEXT = 12_000;
const TIMEOUT_MS = 10_000;

export const SOCIAL_HOSTS = /(^|\.)(instagram\.com|tiktok\.com|x\.com|twitter\.com|facebook\.com|fb\.com|fb\.watch|linkedin\.com|lnkd\.in|youtube\.com|youtu\.be|t\.me|threads\.net|pinterest\.com|reddit\.com|wa\.me|whatsapp\.com)$/i;
/** Link shorteners and "link in bio" pages: they point somewhere else and are followed or read for links. */
export const HUB_HOSTS = /(^|\.)(bit\.ly|t\.co|tinyurl\.com|buff\.ly|ow\.ly|goo\.gl|is\.gd|cutt\.ly|rebrand\.ly|shorturl\.at|linktr\.ee|lnk\.bio|beacons\.ai|bio\.link|campsite\.bio|taplink\.cc|linkin\.bio|stan\.store|carrd\.co|l1nk\.dev|linkpop\.com|hoo\.be|link\.bio|bio\.site|heylink\.me|solo\.to|snipfeed\.co|tap\.bio|lnk\.to|ig\.me)$/i;
/** Sites that repost other people's opportunities. */
export const AGGREGATOR_HOSTS = /(opportunitydesk|opportunitiesforafricans|opportunitiesforyouth|afterschoolafrica|scholarshipsads|scholars4dev|fundsforngos|fundsforngo|youthop|devex\.com|scholarshipportal|opportunitiescorners|mastersportal|scholarshiproar|globalgrants|grantforward|grants\.gov\.ke\/aggregat|opportunitiespal|fundsforyouth|ngojobsinafrica|scholarshipcorner|youthcorner)/i;
const BOT_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
const UA = 'Mozilla/5.0 (compatible; SautiSalamaVerify/1.0; +https://sautisalama.org)';

export const hostOf = (u: string | null | undefined): string | null => {
  if (!u) return null;
  try {
    return new URL(/^https?:/i.test(u) ? u : `https://${u}`).hostname.replace(/^(www|m|mobile)\./, '').toLowerCase();
  } catch {
    return null;
  }
};

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

export async function assertPublicUrl(raw: string): Promise<URL> {
  const u = new URL(raw);
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Only web links can be read.');
  if (u.username || u.password) throw new Error('Links with a password are not read.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) throw new Error('That address is private.');
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => privateIp(a.address))) throw new Error('That address is private.');
  return u;
}

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;|&apos;|&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();

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

function nameOf(v: unknown): string | null {
  if (!v) return null;
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return nameOf(v[0]);
  if (typeof v === 'object' && typeof (v as { name?: unknown }).name === 'string') return (v as { name: string }).name;
  return null;
}

function fromJsonLd(html: string): { jsonLd: unknown[]; organisation: string | null; deadline: string | null } {
  const jsonLd: unknown[] = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    try {
      const v = JSON.parse(m[1]);
      jsonLd.push(...(Array.isArray(v) ? v : [v]));
    } catch { /* broken JSON-LD */ }
  }
  let organisation: string | null = null;
  let deadline: string | null = null;
  const walk = (node: unknown, depth = 0) => {
    if (!node || typeof node !== 'object' || depth > 5) return;
    if (Array.isArray(node)) { node.forEach((n) => walk(n, depth + 1)); return; }
    const o = node as Record<string, unknown>;
    const type = String(o['@type'] ?? '');
    organisation ??= nameOf(o.hiringOrganization) ?? nameOf(o.organizer) ?? nameOf(o.funder) ?? nameOf(o.provider) ?? nameOf(o.publisher)
      ?? (/Organization|NGO|Corporation|EducationalOrganization|GovernmentOrganization/.test(type) ? nameOf(o) : null);
    if (!deadline && typeof (o.validThrough ?? o.applicationDeadline) === 'string') deadline = String(o.validThrough ?? o.applicationDeadline).slice(0, 10);
    for (const v of Object.values(o)) if (v && typeof v === 'object') walk(v, depth + 1);
  };
  walk(jsonLd);
  return { jsonLd, organisation: organisation ? decode(organisation) : null, deadline };
}

export function readHtml(html: string, baseUrl: string): Omit<PageMeta, 'finalUrl' | 'status'> {
  const abs = (v: string | null) => { if (!v) return null; try { return new URL(v, baseUrl).toString(); } catch { return null; } };
  const titleTag = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1];
  const icon = /<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]*href=["']([^"']+)["']/i.exec(html)?.[1] ?? null;
  const ld = fromJsonLd(html);

  const links: string[] = [];
  const seen = new Set<string>();
  const lre = /<a\s[^>]*?href=["']([^"'#][^"']*)["']/gi;
  let m: RegExpExecArray | null;
  while ((m = lre.exec(html)) && links.length < 200) {
    const h = abs(decode(m[1]));
    if (h && /^https?:/i.test(h) && !seen.has(h)) { seen.add(h); links.push(h); }
  }

  const anchors: { href: string; text: string }[] = [];
  const are = /<a\s[^>]*?href=["']([^"'#][^"']*)["'][^>]*>([\s\S]*?)<\/a>/gi;
  let am: RegExpExecArray | null;
  while ((am = are.exec(html)) && anchors.length < 300) {
    const h = abs(decode(am[1]));
    if (h && /^https?:/i.test(h)) anchors.push({ href: h, text: decode(am[2].replace(/<[^>]+>/g, ' ')).slice(0, 120) });
  }

  const text = decode(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<(nav|footer|header|form|svg|iframe)[\s\S]*?<\/\1>/gi, ' ')
      .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6]|tr)>/gi, '\n').replace(/<[^>]+>/g, ' '),
  ).slice(0, MAX_TEXT);

  return {
    title: metaContent(html, ['og:title', 'twitter:title']) ?? (titleTag ? decode(titleTag) : null),
    description: metaContent(html, ['og:description', 'twitter:description', 'description']),
    image: abs(metaContent(html, ['og:image', 'twitter:image', 'twitter:image:src'])),
    siteName: metaContent(html, ['og:site_name', 'application-name']),
    favicon: abs(icon) ?? (hostOf(baseUrl) ? `https://${new URL(baseUrl).host}/favicon.ico` : null),
    organisation: ld.organisation,
    deadline: ld.deadline,
    jsonLd: ld.jsonLd,
    links,
    anchors,
    text,
  };
}

export async function fetchPage(raw: string): Promise<PageMeta> {
  let url = (await assertPublicUrl(raw)).toString();
  for (let hop = 0; hop < 6; hop++) {
    const social = SOCIAL_HOSTS.test(new URL(url).hostname);
    const res = await fetch(url, {
      redirect: 'manual',
      headers: { 'user-agent': social ? BOT_UA : UA, accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.5', 'accept-language': 'en' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = (await assertPublicUrl(new URL(res.headers.get('location')!, url).toString())).toString();
      continue;
    }
    const type = res.headers.get('content-type') ?? '';
    let html = '';
    if (/html|xml|text\/plain/i.test(type) && res.body) {
      const reader = res.body.getReader();
      const chunks: Uint8Array[] = [];
      let total = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done || !value) break;
        total += value.byteLength;
        chunks.push(value);
        if (total > MAX_BYTES) { await reader.cancel(); break; }
      }
      html = new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks));
    }
    return { finalUrl: url, status: res.status, ...readHtml(html, url) };
  }
  throw new Error('That link redirects too many times.');
}
