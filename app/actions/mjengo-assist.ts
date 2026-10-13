'use server';

import PptxGenJS from 'pptxgenjs';
import { guard } from '@/lib/action-result';
import { requireAdminActor } from '@/lib/access/super-admin';
import { requireModule } from '@/lib/access/permissions';
import { askAi } from '@/lib/mjengo/ai';
import { fixPptx } from '@/lib/mjengo/pptx-fix';

const parse = <T,>(raw: string): T => {
  try {
    return JSON.parse(raw) as T;
  } catch {
    const m = /\{[\s\S]*\}/.exec(raw);
    if (!m) throw new Error('The AI answer could not be read. Please try again.');
    return JSON.parse(m[0]) as T;
  }
};

/* ------------------------------------------------------------------ Sheets */

/** A block of cells for a spreadsheet, from a plain request. Values only (text, numbers or formulas starting with =). */
async function table_(prompt: string, context: string): Promise<{ rows: (string | number)[][]; note: string }> {
  await requireModule('assistant');
  const ask = prompt.trim().slice(0, 1200);
  if (ask.length < 4) throw new Error('Say what you want in the sheet.');
  const raw = await askAi(
    'You fill spreadsheets for a small non-profit team. Reply with one JSON object {"rows": [[cell, ...], ...], "note": string}. The first row holds column headings. Cells are strings or numbers; a formula is a string starting with "=" that refers to cells as if the table starts at A1. At most 60 rows and 12 columns. "note" is one short sentence saying what you made. Do not invent real people or private data.',
    `What is already on the sheet (first rows, tab separated):\n${context.slice(0, 3000) || '(empty)'}\n\nRequest: ${ask}`,
    2000,
    { json: true, temperature: 0.3 }
  );
  const j = parse<{ rows?: unknown; note?: string }>(raw);
  const rows = (Array.isArray(j.rows) ? j.rows : []).slice(0, 60).map((r) => (Array.isArray(r) ? r.slice(0, 12).map((c) => (typeof c === 'number' ? c : String(c ?? ''))) : [String(r)]));
  if (!rows.length) throw new Error('Nothing came back. Try asking differently.');
  return { rows, note: j.note ?? 'Done.' };
}

export interface FormulaHelp { formula: string; explanation: string; insight: string; alternatives: string[] }

/**
 * A formula for what the person wants, written against the data that is actually on the sheet, with a short
 * note about what that data looks like (blanks, text where numbers are expected, outliers).
 */
async function formula_(request: string, data: string, cell: string): Promise<FormulaHelp> {
  await requireModule('assistant');
  const ask = request.trim().slice(0, 600);
  if (ask.length < 3) throw new Error('Say what you want to work out.');
  const raw = await askAi(
    'You help people write spreadsheet formulas (Excel and Google Sheets syntax). Reply with one JSON object {"formula": string starting with "=", "explanation": string (one or two plain sentences, no jargon), "insight": string (one or two sentences about the data given: blanks, text where numbers should be, odd values, totals worth knowing; say "No issues seen." if none), "alternatives": string[] (up to 2 other formulas)}. Use only cell references that exist in the data shown. Do not invent data.',
    `The formula goes in cell ${cell || 'the active cell'}.\n\nData on the sheet (cell addresses then values, tab separated):\n${data.slice(0, 6000) || '(empty)'}\n\nWhat they want: ${ask}`,
    700,
    { json: true, temperature: 0.2 }
  );
  const j = parse<{ formula?: string; explanation?: string; insight?: string; alternatives?: unknown }>(raw);
  const formula = String(j.formula ?? '').trim();
  if (!formula.startsWith('=')) throw new Error('No formula came back. Try describing it differently.');
  return {
    formula: formula.slice(0, 500),
    explanation: String(j.explanation ?? '').slice(0, 400),
    insight: String(j.insight ?? '').slice(0, 500),
    alternatives: (Array.isArray(j.alternatives) ? j.alternatives : []).map(String).filter((f) => f.startsWith('=')).slice(0, 2),
  };
}

/* ------------------------------------------------------------ Presentations */

export type DeckTheme = 'teal' | 'purple' | 'sunrise' | 'night';
const THEMES: Record<DeckTheme, { bg: string; title: string; text: string; accent: string; band: string }> = {
  teal: { bg: 'FFFFFF', title: '0F3B44', text: '334155', accent: '068297', band: 'E6F4F6' },
  purple: { bg: 'FFFFFF', title: '3B1D78', text: '374151', accent: '7D2AE8', band: 'F1E8FD' },
  sunrise: { bg: 'FFFBF2', title: '7C2D12', text: '44403C', accent: 'EA580C', band: 'FFEDD5' },
  night: { bg: '0E1318', title: 'FFFFFF', text: 'D1D5DB', accent: '00C4CC', band: '1B232B' },
};

interface Slide { title: string; bullets: string[]; notes?: string; image?: number | null }

/** A look worked out from the person's own colours (a logo, photos, the brand): hex without the #. */
export interface DeckLookInput { bg: string; title: string; text: string; accent: string; band: string }
/** A picture the person added: photos are placed on slides that suit them, a logo goes on the cover and corners. */
export interface DeckImageInput { name: string; kind: 'photo' | 'logo'; note?: string; dataUrl: string; width: number; height: number }

const HEX6 = /^[0-9A-Fa-f]{6}$/;
const IMG_URL = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/;

/** A finished .pptx from a topic: a title slide, content slides, and a closing slide. Returned as base64. */
async function deck_(prompt: string, theme: DeckTheme | DeckLookInput, slides: number, imagesIn: DeckImageInput[] = []): Promise<{ name: string; base64: string; outline: { title: string; bullets: string[] }[] }> {
  await requireModule('assistant');
  const topic = prompt.trim().slice(0, 1500);
  if (topic.length < 6) throw new Error('Say what the presentation is about.');
  const n = Math.min(14, Math.max(4, Math.round(slides) || 8));
  const images = (imagesIn ?? []).slice(0, 8).filter((i) => i && IMG_URL.test(i.dataUrl) && i.dataUrl.length < 4_500_000).map((i) => ({ ...i, name: String(i.name ?? 'picture').slice(0, 60), note: String(i.note ?? '').slice(0, 160), width: Math.max(1, Number(i.width) || 1), height: Math.max(1, Number(i.height) || 1) }));
  const photos = images.filter((i) => i.kind === 'photo');
  const logo = images.find((i) => i.kind === 'logo') ?? null;
  const photoList = photos.length ? ` Pictures the presenter supplied (use their index in "image"): ${photos.map((p, i) => `${i}: ${p.name}${p.note ? ` (${p.note})` : ''}`).join('; ')}. For each slide where a picture helps, set "image" to that picture's index (use each picture at most twice, and not on every slide); otherwise null.` : '';
  const ask = () => askAi(
    `You write clear presentations for Sauti Salama, a survivor-led organisation in Kenya working on gender-based violence. Reply with one JSON object {"title": string, "subtitle": string, "slides": [{"title": string, "bullets": string[], "notes": string, "image": number | null}]} with exactly ${n} content slides. Each slide has 3 to 5 short bullets (under 14 words each). "notes" are speaker notes of one or two sentences. Do not include identifying details of survivors. Do not invent statistics: leave a bracketed placeholder like [number] where a figure is needed.${photoList}`,
    topic,
    5000,
    { json: true, temperature: 0.4 }
  );
  // A model now and then returns JSON with a stray quote or a cut-off end: one more try is cheaper than an error.
  let j: { title?: string; subtitle?: string; slides?: Slide[] };
  try { j = parse<typeof j>(await ask()); } catch { j = parse<typeof j>(await ask()); }
  const body = (j.slides ?? []).slice(0, n).filter((s) => s && s.title);
  if (!body.length) throw new Error('No slides came back. Try describing it differently.');
  const custom = typeof theme === 'object' && theme && [theme.bg, theme.title, theme.text, theme.accent, theme.band].every((c) => HEX6.test(String(c)));
  const t = custom ? (theme as DeckLookInput) : THEMES[theme as DeckTheme] ?? THEMES.teal;
  const picOf = (d: { dataUrl: string }) => d.dataUrl.replace(/^data:/, '');

  const p = new PptxGenJS();
  p.layout = 'LAYOUT_WIDE';
  p.author = 'Sauti Salama';
  p.title = j.title ?? 'Presentation';

  p.defineSlideMaster({ title: 'CONTENT', background: { color: t.bg }, objects: [{ rect: { x: 0, y: 0, w: 0.25, h: 7.5, fill: { color: t.accent } } }] });
  p.defineSlideMaster({ title: 'COVER', background: { color: t.bg }, objects: [{ rect: { x: 0, y: 4.9, w: 13.33, h: 2.6, fill: { color: t.band } } }, { rect: { x: 0, y: 4.8, w: 13.33, h: 0.1, fill: { color: t.accent } } }] });

  const cover = p.addSlide({ masterName: 'COVER' });
  cover.addText(j.title ?? 'Presentation', { x: 0.8, y: 1.6, w: photos[0] ? 7.4 : 11.7, h: 1.8, fontFace: 'Calibri', fontSize: photos[0] ? 38 : 44, bold: true, color: t.title, valign: 'bottom' });
  if (j.subtitle) cover.addText(j.subtitle, { x: 0.8, y: 3.5, w: photos[0] ? 7.4 : 11.7, h: 0.9, fontFace: 'Calibri', fontSize: 22, color: t.text });
  cover.addText('Sauti Salama', { x: 0.8, y: 5.6, w: 6, h: 0.6, fontFace: 'Calibri', fontSize: 18, bold: true, color: t.accent });
  if (logo) {
    const lh = 0.9, lw = Math.min(3.2, lh * (logo.width / logo.height));
    cover.addImage({ data: picOf(logo), x: 0.8, y: 0.5, w: lw, h: lh });
  }
  if (photos[0]) cover.addImage({ data: picOf(photos[0]), x: 8.6, y: 0.5, w: 4.2, h: 4.1, sizing: { type: 'cover', w: 4.2, h: 4.1 } });

  body.forEach((s, i) => {
    const sl = p.addSlide({ masterName: 'CONTENT' });
    sl.addText(s.title, { x: 0.7, y: 0.45, w: 12, h: 1.0, fontFace: 'Calibri', fontSize: 32, bold: true, color: t.title, valign: 'middle' });
    const pic = typeof s.image === 'number' && photos[s.image] ? photos[s.image] : null;
    sl.addText(
      (s.bullets ?? []).slice(0, 6).map((b) => ({ text: String(b), options: { bullet: { code: '25CF' }, breakLine: true } })),
      { x: 0.9, y: 1.7, w: pic ? 6.6 : 11.4, h: 4.7, fontFace: 'Calibri', fontSize: pic ? 20 : 22, color: t.text, valign: 'top', paraSpaceAfter: 12 }
    );
    if (pic) sl.addImage({ data: picOf(pic), x: 8.0, y: 1.7, w: 4.6, h: 4.7, sizing: { type: 'cover', w: 4.6, h: 4.7 } });
    if (logo) {
      const lh = 0.5, lw = Math.min(1.8, lh * (logo.width / logo.height));
      sl.addImage({ data: picOf(logo), x: 12.8 - lw, y: 0.3, w: lw, h: lh });
    }
    sl.addText(String(i + 2), { x: 12.3, y: 6.9, w: 0.7, h: 0.4, fontSize: 12, color: t.accent, align: 'right' });
    if (s.notes) sl.addNotes(String(s.notes));
  });

  const end = p.addSlide({ masterName: 'COVER' });
  end.addText('Thank you', { x: 0.8, y: 2.0, w: 11.7, h: 1.6, fontFace: 'Calibri', fontSize: 48, bold: true, color: t.title });
  end.addText('Questions and conversation', { x: 0.8, y: 3.5, w: 11.7, h: 0.8, fontFace: 'Calibri', fontSize: 22, color: t.text });
  if (logo) {
    const lh = 1.0, lw = Math.min(3.4, lh * (logo.width / logo.height));
    end.addImage({ data: picOf(logo), x: 0.8, y: 5.4, w: lw, h: lh });
  }

  const bytes = (await p.write({ outputType: 'uint8array' })) as Uint8Array;
  const base64 = Buffer.from(await fixPptx(bytes)).toString('base64');
  const name = `${(j.title ?? 'Presentation').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'Presentation'}.pptx`;
  return { name, base64, outline: body.map((s) => ({ title: s.title, bullets: s.bullets ?? [] })) };
}

/* --------------------------------------------------------------- Pinterest */

export interface Pin { id: string; title: string; image: string; link: string | null }

/** Design inspiration from Pinterest. Needs PINTEREST_ACCESS_TOKEN (a Pinterest app with the pins:read scope). */
async function pins_(query: string): Promise<Pin[]> {
  await requireModule('assistant');
  const token = process.env.PINTEREST_ACCESS_TOKEN;
  if (!token) throw new Error('Pinterest is not connected on this site yet. Add a Pinterest access token to switch on suggestions.');
  const term = query.trim().slice(0, 100) || 'social media poster design';
  const headers = { Authorization: `Bearer ${token}` };
  let res = await fetch(`https://api.pinterest.com/v5/search/partner/pins?${new URLSearchParams({ term, country_code: 'KE', locale: 'en-US', limit: '24' })}`, { headers, signal: AbortSignal.timeout(20_000) });
  // Without partner search access, fall back to the pins of the connected account.
  if (res.status === 401 || res.status === 403 || res.status === 404) res = await fetch('https://api.pinterest.com/v5/pins?page_size=24', { headers, signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(res.status === 401 ? 'The Pinterest access token was refused.' : 'Pinterest did not answer. Try again in a moment.');
  const j = (await res.json()) as { items?: { id?: string; title?: string; description?: string; link?: string | null; media?: { images?: Record<string, { url?: string }> } }[] };
  return (j.items ?? []).flatMap((p) => {
    const imgs = p.media?.images ?? {};
    const url = imgs['600x']?.url ?? imgs['400x300']?.url ?? imgs['1200x']?.url ?? Object.values(imgs)[0]?.url;
    return p.id && url ? [{ id: p.id, title: (p.title || p.description || 'Pin').slice(0, 80), image: url, link: p.link ?? null }] : [];
  });
}

/** A pin picture as a data address, so it can be placed on the canvas and edited without cross-site limits. */
async function pinImage_(url: string): Promise<string> {
  await requireModule('assistant');
  const u = new URL(url);
  if (!/(^|\.)pinimg\.com$/.test(u.hostname)) throw new Error('That is not a Pinterest picture.');
  const res = await fetch(u, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error('Could not fetch the picture.');
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length > 4_000_000) throw new Error('That picture is too large.');
  return `data:${res.headers.get('content-type') ?? 'image/jpeg'};base64,${buf.toString('base64')}`;
}

export const pinterestSearch = guard(pins_);
export const pinterestImage = guard(pinImage_);
export const aiTable = guard(table_);
export const aiFormula = guard(formula_);
export const makeDeck = guard(deck_);
