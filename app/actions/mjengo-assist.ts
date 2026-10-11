'use server';

import PptxGenJS from 'pptxgenjs';
import { guard } from '@/lib/action-result';
import { requireAdminActor } from '@/lib/access/super-admin';
import { askAi } from '@/lib/mjengo/ai';

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
  await requireAdminActor();
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

/* ------------------------------------------------------------ Presentations */

export type DeckTheme = 'teal' | 'purple' | 'sunrise' | 'night';
const THEMES: Record<DeckTheme, { bg: string; title: string; text: string; accent: string; band: string }> = {
  teal: { bg: 'FFFFFF', title: '0F3B44', text: '334155', accent: '068297', band: 'E6F4F6' },
  purple: { bg: 'FFFFFF', title: '3B1D78', text: '374151', accent: '7D2AE8', band: 'F1E8FD' },
  sunrise: { bg: 'FFFBF2', title: '7C2D12', text: '44403C', accent: 'EA580C', band: 'FFEDD5' },
  night: { bg: '0E1318', title: 'FFFFFF', text: 'D1D5DB', accent: '00C4CC', band: '1B232B' },
};

interface Slide { title: string; bullets: string[]; notes?: string }

/** A finished .pptx from a topic: a title slide, content slides, and a closing slide. Returned as base64. */
async function deck_(prompt: string, theme: DeckTheme, slides: number): Promise<{ name: string; base64: string; outline: { title: string; bullets: string[] }[] }> {
  await requireAdminActor();
  const topic = prompt.trim().slice(0, 1500);
  if (topic.length < 6) throw new Error('Say what the presentation is about.');
  const n = Math.min(14, Math.max(4, Math.round(slides) || 8));
  const raw = await askAi(
    `You write clear presentations for Sauti Salama, a survivor-led organisation in Kenya working on gender-based violence. Reply with one JSON object {"title": string, "subtitle": string, "slides": [{"title": string, "bullets": string[], "notes": string}]} with exactly ${n} content slides. Each slide has 3 to 5 short bullets (under 14 words each). "notes" are speaker notes of one or two sentences. Do not include identifying details of survivors. Do not invent statistics: leave a bracketed placeholder like [number] where a figure is needed.`,
    topic,
    3500,
    { json: true, temperature: 0.5 }
  );
  const j = parse<{ title?: string; subtitle?: string; slides?: Slide[] }>(raw);
  const body = (j.slides ?? []).slice(0, n).filter((s) => s && s.title);
  if (!body.length) throw new Error('No slides came back. Try describing it differently.');
  const t = THEMES[theme] ?? THEMES.teal;

  const p = new PptxGenJS();
  p.layout = 'LAYOUT_WIDE';
  p.author = 'Sauti Salama';
  p.title = j.title ?? 'Presentation';

  p.defineSlideMaster({ title: 'CONTENT', background: { color: t.bg }, objects: [{ rect: { x: 0, y: 0, w: 0.25, h: 7.5, fill: { color: t.accent } } }] });
  p.defineSlideMaster({ title: 'COVER', background: { color: t.bg }, objects: [{ rect: { x: 0, y: 4.9, w: 13.33, h: 2.6, fill: { color: t.band } } }, { rect: { x: 0, y: 4.8, w: 13.33, h: 0.1, fill: { color: t.accent } } }] });

  const cover = p.addSlide({ masterName: 'COVER' });
  cover.addText(j.title ?? 'Presentation', { x: 0.8, y: 1.6, w: 11.7, h: 1.8, fontFace: 'Calibri', fontSize: 44, bold: true, color: t.title, valign: 'bottom' });
  if (j.subtitle) cover.addText(j.subtitle, { x: 0.8, y: 3.5, w: 11.7, h: 0.9, fontFace: 'Calibri', fontSize: 22, color: t.text });
  cover.addText('Sauti Salama', { x: 0.8, y: 5.6, w: 6, h: 0.6, fontFace: 'Calibri', fontSize: 18, bold: true, color: t.accent });

  body.forEach((s, i) => {
    const sl = p.addSlide({ masterName: 'CONTENT' });
    sl.addText(s.title, { x: 0.7, y: 0.45, w: 12, h: 1.0, fontFace: 'Calibri', fontSize: 32, bold: true, color: t.title, valign: 'middle' });
    sl.addText(
      (s.bullets ?? []).slice(0, 6).map((b) => ({ text: String(b), options: { bullet: { code: '25CF' }, breakLine: true } })),
      { x: 0.9, y: 1.7, w: 11.4, h: 4.7, fontFace: 'Calibri', fontSize: 22, color: t.text, valign: 'top', paraSpaceAfter: 12 }
    );
    sl.addText(String(i + 2), { x: 12.3, y: 6.9, w: 0.7, h: 0.4, fontSize: 12, color: t.accent, align: 'right' });
    if (s.notes) sl.addNotes(String(s.notes));
  });

  const end = p.addSlide({ masterName: 'COVER' });
  end.addText('Thank you', { x: 0.8, y: 2.0, w: 11.7, h: 1.6, fontFace: 'Calibri', fontSize: 48, bold: true, color: t.title });
  end.addText('Questions and conversation', { x: 0.8, y: 3.5, w: 11.7, h: 0.8, fontFace: 'Calibri', fontSize: 22, color: t.text });

  const base64 = (await p.write({ outputType: 'base64' })) as string;
  const name = `${(j.title ?? 'Presentation').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80) || 'Presentation'}.pptx`;
  return { name, base64, outline: body.map((s) => ({ title: s.title, bullets: s.bullets ?? [] })) };
}

export const aiTable = guard(table_);
export const makeDeck = guard(deck_);
