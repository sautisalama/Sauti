import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

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

/** Only public web addresses: nothing on a private network, no passwords in the address. */
export async function assertPublic(raw: string): Promise<URL> {
  const u = new URL(raw);
  if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error('Only web links can be read.');
  if (u.username || u.password) throw new Error('Links with a password are not fetched.');
  const host = u.hostname.replace(/^\[|\]$/g, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal') || host.endsWith('.local')) throw new Error('That address is private.');
  const addrs = isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => privateIp(a.address))) throw new Error('That address is private.');
  return u;
}

/** The HTML of a public page (redirects followed, each hop checked), capped in size. */
export async function fetchHtml(raw: string): Promise<{ url: string; html: string }> {
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
    return { url, html: new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks)) };
  }
  throw new Error('That link redirects too many times.');
}

/** The readable text of a page: scripts, styles and tags removed, spacing tidied. */
export function pageText(html: string): string {
  return html
    .replace(/<(script|style|noscript|svg|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#0?39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

const MAX_PDF = 20_000_000;

/** A page or a PDF at a public address: HTML comes back as text, a PDF as bytes (up to 20 MB). Each redirect is checked. */
export async function fetchPageOrPdf(raw: string): Promise<{ kind: 'html'; url: string; html: string } | { kind: 'pdf'; url: string; bytes: Uint8Array }> {
  let url = (await assertPublic(raw)).toString();
  for (let hop = 0; hop < 5; hop++) {
    const res = await fetch(url, {
      redirect: 'manual',
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; SautiSalamaPreview/1.0; +https://sautisalama.org)', accept: 'text/html,application/pdf;q=0.9,*/*;q=0.5', 'accept-language': 'en' },
      signal: AbortSignal.timeout(30_000),
    });
    if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
      url = (await assertPublic(new URL(res.headers.get('location')!, url).toString())).toString();
      continue;
    }
    if (!res.ok) throw new Error('That link did not open (' + res.status + ').');
    const type = res.headers.get('content-type') ?? '';
    const isPdf = /pdf/i.test(type) || (/octet-stream/i.test(type) && /\.pdf(\?|#|$)/i.test(url));
    if (!isPdf && !/html|xml/i.test(type)) throw new Error('That link is neither a web page nor a PDF.');
    const reader = res.body?.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    const cap = isPdf ? MAX_PDF : MAX_BYTES;
    while (reader) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      total += value.byteLength;
      chunks.push(value);
      if (total > cap) { await reader.cancel(); if (isPdf) throw new Error('That PDF is larger than 20 MB.'); break; }
    }
    const all = Buffer.concat(chunks);
    return isPdf ? { kind: 'pdf', url, bytes: new Uint8Array(all) } : { kind: 'html', url, html: new TextDecoder('utf-8', { fatal: false }).decode(all) };
  }
  throw new Error('That link redirects too many times.');
}

/** Links to PDFs on a page that look like the funder's guidelines, call text or application form (at most three). */
export function guidelinePdfLinks(html: string, baseUrl: string): { url: string; label: string }[] {
  const out: { url: string; label: string }[] = [];
  for (const m of html.matchAll(/<a\b[^>]*href\s*=\s*["']([^"'#]+\.pdf(?:\?[^"']*)?)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let url: string;
    try { url = new URL(m[1].replace(/&amp;/g, '&'), baseUrl).toString(); } catch { continue; }
    const label = m[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 100);
    if (/guideline|call for|call-for|application|apply|rfp|rfa|terms of reference|instruction|criteria|eligib|requirement|template|handbook|prospectus/i.test(`${label} ${url}`) && !out.some((o) => o.url === url)) out.push({ url, label });
    if (out.length >= 3) break;
  }
  return out;
}
