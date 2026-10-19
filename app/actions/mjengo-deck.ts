'use server';

import { guard } from '@/lib/action-result';
import { requireModule } from '@/lib/access/permissions';
import { looseAdmin } from '@/lib/loose-db';
import { askAi } from '@/lib/mjengo/ai';
import { loadBrandRow } from '@/lib/mjengo/brand';
import { BLANK_SPEC, LAYOUT_NAMES, type LayoutKind, type LayoutSpec } from '@/lib/deck/model';

const KINDS = Object.keys(LAYOUT_NAMES) as LayoutKind[];
const s = (v: unknown, n: number) => (typeof v === 'string' ? v.trim().slice(0, n) : '');
const arr = (v: unknown, n: number, len: number) => (Array.isArray(v) ? v.slice(0, n).map((x) => s(x, len)).filter(Boolean) : []);

/** One picture for a few words: Unsplash when it is switched on, otherwise Openverse (open licences, no key). */
async function photoFor(query: string): Promise<string | null> {
  const q = query.trim().slice(0, 80);
  if (!q) return null;
  try {
    const key = process.env.UNSPLASH_ACCESS_KEY;
    if (key) {
      const res = await fetch(`https://api.unsplash.com/search/photos?${new URLSearchParams({ query: q, per_page: '1', orientation: 'landscape' })}`, { headers: { Authorization: `Client-ID ${key}` }, signal: AbortSignal.timeout(8000) });
      if (res.ok) { const j = (await res.json()) as { results?: { urls?: { regular?: string } }[] }; const u = j.results?.[0]?.urls?.regular; if (u) return u; }
    }
    const res = await fetch(`https://api.openverse.org/v1/images/?${new URLSearchParams({ q, page_size: '3', license_type: 'commercial', extension: 'jpg' })}`, { headers: { 'User-Agent': 'SautiSalama/1.0' }, signal: AbortSignal.timeout(8000) });
    if (res.ok) { const j = (await res.json()) as { results?: { url?: string }[] }; return j.results?.find((r) => r.url?.startsWith('https://'))?.url ?? null; }
  } catch { /* a slide without a picture is fine */ }
  return null;
}

export interface GeneratedDeck { title: string; slides: LayoutSpec[] }

/**
 * A deck outline from a few words: an opening, one idea per slide drawn from a fixed set of layouts, and a close.
 * Only words are generated; the look comes from the theme, so every result is consistent. Pictures are found for
 * the layouts that carry one.
 */
async function generate_(prompt: string, count: number, audience: string): Promise<GeneratedDeck> {
  await requireModule('design');
  const topic = prompt.trim().slice(0, 1500);
  if (topic.length < 6) throw new Error('Say what the presentation is about.');
  const n = Math.max(4, Math.min(16, Math.round(count) || 8));
  const brand = await loadBrandRow().catch(() => null);
  const system = `You design presentations for ${brand?.name ?? 'a Kenyan non-profit'}${brand?.tagline ? ` (${brand.tagline})` : ''}. Write clear, specific, honest slides. Never invent statistics, quotes, names or results: where a real number is needed, write a placeholder like "[number]" for the team to fill in. Keep survivors anonymous. Short lines: titles under 8 words, bullets under 14 words.
Return JSON only: {"title":"...","slides":[{"kind":"...", ...}]} with exactly ${n} slides. The first is kind "title", the last kind "closing". Choose each slide's kind from this fixed set and use only that kind's fields:
- title: title, subtitle
- section: title, subtitle
- bullets: title, bullets (3 to 5)
- two: title, columns [{heading, bullets (2 to 4)} x2]
- imageRight / imageLeft: title, bullets (2 to 4), imageQuery (3 to 5 words describing a photo that really exists, no people's names)
- quote: quote, by
- stats: title, stats [{n, label} x3 or 4]
- steps: title, steps [{heading, text} x3 to 5]
- photo: title, imageQuery
- closing: title, subtitle
Every slide may have notes: one or two sentences the presenter can say. Vary the kinds; do not repeat one kind more than three times in a row.`;
  const raw = await askAi(system, `Topic and purpose: ${topic}\nAudience: ${audience.trim().slice(0, 200) || 'general'}\nSlides: ${n}`, 3800, { json: true, temperature: 0.6 });
  let j: { title?: string; slides?: Record<string, unknown>[] };
  try { j = JSON.parse(raw); } catch { throw new Error('The AI answer could not be read. Try again.'); }
  const list = (j.slides ?? []).slice(0, 18);
  if (list.length < 2) throw new Error('The AI did not return a presentation. Try again with more detail.');
  const slides: LayoutSpec[] = await Promise.all(list.map(async (x): Promise<LayoutSpec> => {
    const kind = (KINDS.includes(x.kind as LayoutKind) ? x.kind : 'bullets') as LayoutKind;
    const base = BLANK_SPEC[kind];
    const spec: LayoutSpec = { kind, notes: s(x.notes, 400) };
    spec.title = s(x.title, 90) || (kind === 'quote' ? undefined : base.title);
    if (x.subtitle !== undefined) spec.subtitle = s(x.subtitle, 160);
    if (kind === 'bullets' || kind === 'imageRight' || kind === 'imageLeft') spec.bullets = arr(x.bullets, 5, 140);
    if (kind === 'two') spec.columns = (Array.isArray(x.columns) ? x.columns : []).slice(0, 2).map((c: Record<string, unknown>) => ({ heading: s(c.heading, 40), bullets: arr(c.bullets, 4, 120) }));
    if (kind === 'quote') { spec.quote = s(x.quote, 220); spec.by = s(x.by, 80); }
    if (kind === 'stats') spec.stats = (Array.isArray(x.stats) ? x.stats : []).slice(0, 4).map((c: Record<string, unknown>) => ({ n: s(c.n, 12), label: s(c.label, 50) }));
    if (kind === 'steps') spec.steps = (Array.isArray(x.steps) ? x.steps : []).slice(0, 5).map((c: Record<string, unknown>) => ({ heading: s(c.heading, 30), text: s(c.text, 90) }));
    if (kind === 'imageRight' || kind === 'imageLeft' || kind === 'photo') {
      const q = s(x.imageQuery, 80);
      const u = q ? await photoFor(q) : null;
      if (u) { spec.image = u; spec.imageAlt = q; }
    }
    return spec;
  }));
  return { title: s(j.title, 100) || 'Presentation', slides };
}

/** Fresh links for pictures kept in the library, since stored links expire. */
async function assetUrls_(ids: string[]): Promise<Record<string, string>> {
  await requireModule('design');
  const clean = ids.filter((i) => /^[0-9a-f-]{36}$/i.test(i)).slice(0, 60);
  if (!clean.length) return {};
  const db = looseAdmin();
  const { data } = await db.from('mjengo_assets').select('id, path').in('id', clean);
  const out: Record<string, string> = {};
  for (const r of (data ?? []) as { id: string; path: string }[]) {
    const { data: signed } = await db.storage.from('mjengo-docs').createSignedUrl(r.path, 3600 * 12);
    if (signed?.signedUrl) out[r.id] = signed.signedUrl;
  }
  return out;
}

export const generateDeck = guard(generate_);
export const deckAssetUrls = guard(assetUrls_);
