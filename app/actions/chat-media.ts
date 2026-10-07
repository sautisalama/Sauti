'use server';

import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { createClient } from '@/utils/supabase/server';
import { isPrivateAddress } from '@/lib/net/ssrf';

const MAX_BYTES = 512 * 1024;
const TIMEOUT_MS = 4000;
const MAX_REDIRECTS = 3;

/** Resolve the host and refuse anything that points inside our network. */
async function assertPublicHttpUrl(raw: string): Promise<URL> {
  const url = new URL(raw);
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('Unsupported protocol');
  if (url.username || url.password) throw new Error('Credentials in URL are not allowed');
  const host = url.hostname.replace(/^\[|\]$/g, '');
  const addresses = isIP(host) ? [host] : (await lookup(host, { all: true })).map((a) => a.address);
  if (!addresses.length || addresses.some(isPrivateAddress)) throw new Error('Blocked address');
  return url;
}

const decode = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/**
 * Link preview for chat. This runs on our server on behalf of a user, so it is
 * locked down: signed-in users only, public hosts only (redirects re-checked),
 * short timeout and a hard cap on how much is read.
 */
export async function fetchLinkMetadata(rawUrl: string) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  try {
    let url = await assertPublicHttpUrl(rawUrl);
    let response: Response | null = null;
    for (let i = 0; i <= MAX_REDIRECTS; i++) {
      response = await fetch(url, {
        redirect: 'manual',
        signal: AbortSignal.timeout(TIMEOUT_MS),
        headers: { 'User-Agent': 'SautiSalamaLinkPreview/1.0', Accept: 'text/html' },
      });
      const loc = response.headers.get('location');
      if (response.status >= 300 && response.status < 400 && loc) {
        url = await assertPublicHttpUrl(new URL(loc, url).toString());
        continue;
      }
      break;
    }
    if (!response || !response.ok) return null;
    if (!(response.headers.get('content-type') ?? '').includes('text/html')) return null;

    // Read at most MAX_BYTES.
    const reader = response.body?.getReader();
    if (!reader) return null;
    const chunks: Uint8Array[] = [];
    let received = 0;
    while (received < MAX_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(value);
      received += value.length;
    }
    reader.cancel().catch(() => undefined);
    const html = Buffer.concat(chunks).toString('utf8');

    const getMeta = (prop: string) => {
      const re = new RegExp(`<meta[^>]+(?:property|name)=["']${prop}["'][^>]*content=["']([^"']*)["']`, 'i');
      const reRev = new RegExp(`<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${prop}["']`, 'i');
      const m = html.match(re) || html.match(reRev);
      return m ? decode(m[1]).trim() : undefined;
    };

    const title = getMeta('og:title') || getMeta('twitter:title') || decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] ?? '').trim();
    const description = getMeta('og:description') || getMeta('twitter:description') || getMeta('description');
    let image = getMeta('og:image') || getMeta('twitter:image');
    if (image) {
      try {
        const abs = new URL(image, url);
        image = abs.protocol === 'https:' || abs.protocol === 'http:' ? abs.toString() : undefined;
      } catch {
        image = undefined;
      }
    }

    return {
      title: (title || url.hostname).slice(0, 200),
      description: description?.slice(0, 300),
      image,
      url: url.toString(),
    };
  } catch (e) {
    console.error('Link preview failed:', e instanceof Error ? e.message : e);
    return null;
  }
}

export async function getChatMedia(chatId: string, type: 'media' | 'docs' | 'links') {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  let query = supabase
    .from('messages')
    .select('*')
    .eq('chat_id', chatId)
    .order('created_at', { ascending: false });

  if (type === 'media') {
    query = query.in('type', ['image', 'video']);
  } else if (type === 'docs') {
    query = query.eq('type', 'file');
  } else if (type === 'links') {
    // @> is the "contains" operator for JSONB (GIN-indexed)
    query = query.not('metadata->link_preview', 'is', 'null');
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}
