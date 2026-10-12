/**
 * An endless supply of designs. A concept (mood, palette, type) is combined with a layout and a piece of
 * copy, so a few dozen ingredients make thousands of different, coherent templates. Everything it makes is
 * ordinary layers, so every result is editable in the same way as a hand drawn template.
 */
import type { DesignTemplate, Layer, SizeId } from './design-templates';

export interface Concept {
  id: string;
  name: string;
  mood: string;
  tags: string[];
  /** background, background two (optional), ink, accent, accent two, soft */
  bg: string;
  bg2?: string;
  ink: string;
  accent: string;
  accent2: string;
  soft: string;
  head: string;
  body: string;
  motif: 'circles' | 'arch' | 'bars' | 'frame' | 'blob' | 'grid';
}

export const CONCEPTS: Concept[] = [
  { id: 'calm-sea', name: 'Calm sea', mood: 'Calm', tags: ['calm', 'trust', 'cool'], bg: '#E6F4F6', ink: '#06303A', accent: '#068297', accent2: '#7FD3E0', soft: '#FFFFFF', head: 'DM Serif Display', body: 'Inter', motif: 'circles' },
  { id: 'sunrise', name: 'Sunrise', mood: 'Hopeful', tags: ['warm', 'hope', 'bright'], bg: '#FFF1DB', bg2: '#FFD9A8', ink: '#4A1D0A', accent: '#EA580C', accent2: '#FACC15', soft: '#FFFFFF', head: 'Fraunces', body: 'DM Sans', motif: 'arch' },
  { id: 'night-violet', name: 'Night violet', mood: 'Bold', tags: ['night', 'bold', 'dark'], bg: '#160B2E', bg2: '#2A1257', ink: '#FFFFFF', accent: '#B48CFF', accent2: '#00C4CC', soft: '#3A1D73', head: 'Space Grotesk', body: 'Inter', motif: 'circles' },
  { id: 'paper-ink', name: 'Paper and ink', mood: 'Editorial', tags: ['editorial', 'minimal', 'light'], bg: '#FAF7F2', ink: '#16130F', accent: '#C2410C', accent2: '#16130F', soft: '#FFFFFF', head: 'Playfair Display', body: 'Lora', motif: 'frame' },
  { id: 'savannah', name: 'Savannah', mood: 'Earthy', tags: ['earthy', 'warm', 'natural'], bg: '#F3E7D3', ink: '#3B2A17', accent: '#B45309', accent2: '#4D7C0F', soft: '#FFF8EB', head: 'Fraunces', body: 'Work Sans', motif: 'blob' },
  { id: 'fresh-mint', name: 'Fresh mint', mood: 'Fresh', tags: ['fresh', 'health', 'light'], bg: '#E8FBF1', ink: '#06402B', accent: '#10B981', accent2: '#FDE047', soft: '#FFFFFF', head: 'Outfit', body: 'Inter', motif: 'bars' },
  { id: 'rose-pop', name: 'Rose pop', mood: 'Playful', tags: ['playful', 'bright', 'youth'], bg: '#FF5C8A', ink: '#FFFFFF', accent: '#FFDE59', accent2: '#0E1318', soft: '#FFB3C8', head: 'Righteous', body: 'Poppins', motif: 'circles' },
  { id: 'mono-bold', name: 'Mono bold', mood: 'Strong', tags: ['strong', 'minimal', 'dark'], bg: '#0E1318', ink: '#FFFFFF', accent: '#FFDE59', accent2: '#FFFFFF', soft: '#1B232B', head: 'Anton', body: 'Inter', motif: 'bars' },
  { id: 'lavender', name: 'Lavender', mood: 'Gentle', tags: ['gentle', 'soft', 'care'], bg: '#F1E8FD', ink: '#2E1065', accent: '#7D2AE8', accent2: '#F0ABFC', soft: '#FFFFFF', head: 'Playfair Display', body: 'DM Sans', motif: 'arch' },
  { id: 'kente', name: 'Kente', mood: 'Heritage', tags: ['heritage', 'bold', 'colourful'], bg: '#1F1300', ink: '#FFF4D6', accent: '#F59E0B', accent2: '#DC2626', soft: '#3A2606', head: 'Bebas Neue', body: 'Montserrat', motif: 'bars' },
  { id: 'ocean-deep', name: 'Ocean deep', mood: 'Serious', tags: ['serious', 'trust', 'formal'], bg: '#0B2A4A', bg2: '#12466F', ink: '#FFFFFF', accent: '#38BDF8', accent2: '#FDE68A', soft: '#12466F', head: 'Merriweather', body: 'Inter', motif: 'frame' },
  { id: 'citrus', name: 'Citrus', mood: 'Energetic', tags: ['energetic', 'bright', 'youth'], bg: '#FDE047', ink: '#1C1917', accent: '#EA580C', accent2: '#0E1318', soft: '#FEF9C3', head: 'Archivo Black', body: 'Work Sans', motif: 'blob' },
  { id: 'blush', name: 'Blush letter', mood: 'Warm', tags: ['warm', 'letter', 'soft'], bg: '#FFE4EA', ink: '#4C0519', accent: '#E11D48', accent2: '#FB7185', soft: '#FFF5F7', head: 'Dancing Script', body: 'Lora', motif: 'frame' },
  { id: 'forest', name: 'Forest', mood: 'Grounded', tags: ['natural', 'grounded', 'dark'], bg: '#0F2A1D', ink: '#ECFDF5', accent: '#86EFAC', accent2: '#FDE68A', soft: '#164430', head: 'Fraunces', body: 'DM Sans', motif: 'arch' },
  { id: 'cobalt', name: 'Cobalt', mood: 'Clear', tags: ['clear', 'tech', 'bright'], bg: '#1D4ED8', ink: '#FFFFFF', accent: '#FDE047', accent2: '#BFDBFE', soft: '#2F5FE0', head: 'Space Grotesk', body: 'Inter', motif: 'grid' },
  { id: 'clay', name: 'Clay', mood: 'Handmade', tags: ['handmade', 'earthy', 'warm'], bg: '#E8D5C4', ink: '#3A2418', accent: '#9A3412', accent2: '#A16207', soft: '#F6EADD', head: 'Caveat', body: 'Nunito', motif: 'blob' },
  { id: 'slate', name: 'Slate', mood: 'Neutral', tags: ['neutral', 'formal', 'minimal'], bg: '#F1F5F9', ink: '#0F172A', accent: '#334155', accent2: '#0EA5E9', soft: '#FFFFFF', head: 'Montserrat', body: 'Inter', motif: 'grid' },
  { id: 'teal-signal', name: 'Sauti teal', mood: 'On brand', tags: ['brand', 'trust', 'clean'], bg: '#068297', ink: '#FFFFFF', accent: '#FFDE59', accent2: '#0E1318', soft: '#0A97AE', head: 'Poppins', body: 'Inter', motif: 'circles' },
];

export const MOODS = ['All', ...Array.from(new Set(CONCEPTS.map((c) => c.mood)))];

interface Copy { category: DesignTemplate['category']; kicker: string; head: string; body: string; cta: string; stat?: string }

const COPY: Copy[] = [
  { category: 'Awareness', kicker: 'KNOW YOUR RIGHTS', head: 'You deserve to feel safe', body: 'Free, confidential support is one message away.', cta: 'Message us' },
  { category: 'Awareness', kicker: 'DID YOU KNOW', head: 'Silence protects the wrong people', body: 'Speaking up is the first step to being heard.', cta: 'Learn more', stat: '1 in 3' },
  { category: 'Awareness', kicker: 'EVERY DAY', head: 'Believe survivors', body: 'Listening without judgement changes lives.', cta: 'How to help' },
  { category: 'Fundraising', kicker: 'GIVE TODAY', head: 'Keep a safe line open', body: 'KES 1,000 pays for one counselling session.', cta: 'Donate', stat: 'KES 1,000' },
  { category: 'Fundraising', kicker: 'THANK YOU', head: 'Because of you', body: '86 survivors found support this month.', cta: 'See the impact', stat: '86' },
  { category: 'Events', kicker: 'YOU ARE INVITED', head: 'Community safety workshop', body: 'Saturday 12 December, 10:00 am, Kibera Community Hall.', cta: 'Reserve a seat' },
  { category: 'Events', kicker: 'JOIN US', head: '16 days of activism', body: 'Daily conversations, stories and actions.', cta: 'Join in', stat: '16' },
  { category: 'Announcements', kicker: 'WE ARE HIRING', head: 'Programme Officer', body: 'Nairobi, full time. Apply by 30 November.', cta: 'Apply now' },
  { category: 'Announcements', kicker: 'NEW', head: 'Our helpline is open 24 hours', body: 'Call or message any time, day or night.', cta: 'Save the number' },
  { category: 'Quotes', kicker: 'IN HER WORDS', head: 'I did not know where to turn until someone answered.', body: 'A community member, shared with permission', cta: '' },
  { category: 'Quotes', kicker: 'REMEMBER', head: 'Healing is not a straight line, and that is okay.', body: 'A reminder from Sauti Salama', cta: '' },
  { category: 'Awareness', kicker: 'FIVE SIGNS', head: 'Know the signs of control', body: 'Isolation, money control, constant checking, threats, fear.', cta: 'Read more', stat: '5' },
];

type Maker = (c: Concept, k: Copy, size: SizeId) => { layers: Layer[]; bg: string; bg2?: string };

const wide = (s: SizeId) => s === 'linkedin' || s === 'facebook' || s === 'x';
const tall = (s: SizeId) => s === 'story' || s === 'tiktok' || s === 'poster';

const motif = (c: Concept, size: SizeId): Layer[] => {
  const w = wide(size);
  switch (c.motif) {
    case 'circles': return [{ t: 'circle', x: w ? 0.7 : 0.55, y: w ? -0.25 : -0.12, d: w ? 0.5 : 0.7, fill: c.accent }, { t: 'circle', x: w ? 0.85 : 0.8, y: w ? 0.6 : 0.78, d: w ? 0.22 : 0.3, fill: c.accent2 }];
    case 'arch': return [{ t: 'rect', x: w ? 0.68 : 0.58, y: w ? 0.12 : 0.04, w: w ? 0.24 : 0.34, h: w ? 0.76 : 0.3, fill: c.accent, r: 0.5 }];
    case 'bars': return [{ t: 'rect', x: 0, y: 0, w: w ? 0.03 : 1, h: w ? 1 : 0.025, fill: c.accent }, { t: 'rect', x: 0, y: w ? 0 : 0.975, w: w ? 0.012 : 1, h: w ? 1 : 0.025, fill: c.accent2 }];
    case 'frame': return [{ t: 'rect', x: 0.04, y: 0.05, w: 0.92, h: 0.9, fill: 'transparent', r: 0.02 }, { t: 'line', x: 0.08, y: 0.1, w: 0.14, color: c.accent, th: 0.008 }];
    case 'blob': return [{ t: 'circle', x: w ? 0.62 : 0.5, y: w ? 0.3 : 0.62, d: w ? 0.5 : 0.8, fill: c.accent }, { t: 'circle', x: w ? 0.8 : 0.1, y: w ? -0.1 : -0.18, d: w ? 0.24 : 0.4, fill: c.accent2 }];
    default: return [{ t: 'rect', x: 0.08, y: 0.08, w: 0.14, h: 0.14, fill: c.accent }, { t: 'rect', x: 0.24, y: 0.08, w: 0.07, h: 0.14, fill: c.accent2 }];
  }
};

const MAKERS: Maker[] = [
  // headline left, motif behind
  (c, k, s) => {
    const w = wide(s);
    return { bg: c.bg, bg2: c.bg2, layers: [
      ...motif(c, s),
      { t: 'text', x: 0.08, y: w ? 0.14 : 0.12, w: 0.6, text: k.kicker, size: w ? 0.065 : 0.032, color: c.accent, bold: true, spacing: 250, font: c.body },
      { t: 'text', x: 0.08, y: w ? 0.3 : 0.3, w: w ? 0.58 : 0.8, text: k.head, size: w ? 0.12 : tall(s) ? 0.06 : 0.085, color: c.ink, bold: true, lh: 1.08, font: c.head },
      { t: 'text', x: 0.08, y: w ? 0.74 : tall(s) ? 0.7 : 0.72, w: w ? 0.55 : 0.8, text: k.body, size: w ? 0.055 : 0.034, color: c.ink, lh: 1.3, font: c.body },
    ] };
  },
  // big number
  (c, k, s) => {
    const w = wide(s);
    return { bg: c.bg, bg2: c.bg2, layers: [
      ...motif(c, s),
      { t: 'text', x: 0.08, y: w ? 0.08 : 0.14, w: 0.84, text: k.stat ?? k.head.split(' ')[0], size: w ? 0.36 : 0.24, color: c.accent, bold: true, font: c.head },
      { t: 'text', x: 0.08, y: w ? 0.62 : 0.56, w: w ? 0.6 : 0.84, text: k.head, size: w ? 0.075 : 0.055, color: c.ink, bold: true, lh: 1.1, font: c.head },
      { t: 'text', x: 0.08, y: w ? 0.84 : 0.86, w: 0.7, text: k.body, size: w ? 0.04 : 0.03, color: c.ink, font: c.body },
    ] };
  },
  // centred statement
  (c, k, s) => {
    const tallish = tall(s);
    // A centred statement keeps its middle clear: the decoration is only the edge bars, a frame or a grid.
    const edge = c.motif === 'bars' || c.motif === 'frame' || c.motif === 'grid';
    return { bg: c.bg, bg2: c.bg2, layers: [
      ...(edge ? motif(c, s) : [{ t: 'circle' as const, x: -0.12, y: 0.78, d: 0.4, fill: c.accent }, { t: 'circle' as const, x: 0.86, y: -0.1, d: 0.26, fill: c.accent2 }]),
      { t: 'text', x: 0.1, y: tallish ? 0.3 : wide(s) ? 0.2 : 0.3, w: 0.8, text: k.head, size: wide(s) ? 0.14 : tallish ? 0.065 : 0.09, color: c.ink, bold: true, align: 'center', lh: 1.1, font: c.head },
      { t: 'text', x: 0.15, y: tallish ? 0.62 : wide(s) ? 0.66 : 0.66, w: 0.7, text: k.body, size: wide(s) ? 0.06 : 0.036, color: c.ink, align: 'center', lh: 1.3, font: c.body },
      { t: 'text', x: 0.1, y: tallish ? 0.18 : wide(s) ? 0.08 : 0.16, w: 0.8, text: k.kicker, size: wide(s) ? 0.055 : 0.03, color: c.accent, bold: true, spacing: 300, align: 'center', font: c.body },
    ] };
  },
  // photo panel + text card
  (c, k, s) => {
    const w = wide(s);
    return { bg: c.bg, bg2: c.bg2, layers: [
      { t: 'photo', x: w ? 0.52 : 0.08, y: w ? 0 : 0.06, w: w ? 0.48 : 0.84, h: w ? 1 : 0.46, fill: c.accent2, r: w ? 0 : 0.04, scene: 'hills' },
      { t: 'text', x: 0.07, y: w ? 0.16 : 0.58, w: w ? 0.4 : 0.84, text: k.head, size: w ? 0.1 : tall(s) ? 0.045 : 0.06, color: c.ink, bold: true, lh: 1.1, font: c.head },
      { t: 'text', x: 0.07, y: w ? 0.56 : 0.78, w: w ? 0.4 : 0.84, text: k.body, size: w ? 0.05 : 0.03, color: c.ink, lh: 1.3, font: c.body },
      { t: 'rect', x: 0.07, y: w ? 0.78 : 0.9, w: w ? 0.2 : 0.3, h: w ? 0.11 : 0.06, fill: c.accent, r: 0.3 },
      { t: 'text', x: 0.07, y: w ? 0.805 : 0.907, w: w ? 0.2 : 0.3, text: k.cta || 'Read more', size: w ? 0.05 : 0.026, color: c.bg === '#FFFFFF' ? c.ink : '#FFFFFF', bold: true, align: 'center', font: c.body },
    ] };
  },
  // quote on card
  (c, k, s) => ({ bg: c.bg, bg2: c.bg2, layers: [
    ...motif(c, s),
    { t: 'rect', x: 0.07, y: wide(s) ? 0.1 : 0.14, w: 0.86, h: wide(s) ? 0.8 : 0.66, fill: c.soft, r: 0.03 },
    { t: 'text', x: 0.12, y: wide(s) ? 0.12 : 0.17, w: 0.2, text: '“', size: wide(s) ? 0.3 : 0.2, color: c.accent, bold: true, font: c.head },
    { t: 'text', x: 0.12, y: wide(s) ? 0.38 : 0.34, w: 0.76, text: k.head, size: wide(s) ? 0.085 : tall(s) ? 0.042 : 0.058, color: c.ink, bold: true, lh: 1.18, font: c.head },
    { t: 'text', x: 0.12, y: wide(s) ? 0.78 : 0.7, w: 0.76, text: k.body, size: wide(s) ? 0.04 : 0.026, color: c.ink, font: c.body },
  ] }),
  // stripe banner
  (c, k, s) => ({ bg: c.bg, bg2: c.bg2, layers: [
    { t: 'rect', x: 0, y: wide(s) ? 0.34 : 0.4, w: 1, h: wide(s) ? 0.32 : 0.2, fill: c.accent },
    { t: 'text', x: 0.08, y: wide(s) ? 0.1 : 0.18, w: 0.84, text: k.kicker, size: wide(s) ? 0.06 : 0.03, color: c.ink, bold: true, spacing: 250, font: c.body },
    { t: 'text', x: 0.08, y: wide(s) ? 0.4 : 0.44, w: 0.84, text: k.head, size: wide(s) ? 0.12 : 0.058, color: c.bg === c.accent ? c.ink : '#FFFFFF', bold: true, lh: 1.05, font: c.head },
    { t: 'text', x: 0.08, y: wide(s) ? 0.76 : 0.7, w: 0.84, text: k.body, size: wide(s) ? 0.055 : 0.032, color: c.ink, font: c.body },
  ] }),
];

/** A small deterministic random source, so a seed always gives the same design. */
function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const SIZES_FOR: SizeId[] = ['instagram', 'story', 'linkedin', 'facebook', 'x', 'poster', 'tiktok'];

/** Make one template from a seed. Optionally fix the concept, the size or the category. */
export function generateTemplate(seed: number, opts: { concept?: string; size?: SizeId; category?: DesignTemplate['category'] } = {}): DesignTemplate {
  const r = rng(seed * 2654435761);
  const concept = CONCEPTS.find((c) => c.id === opts.concept) ?? CONCEPTS[Math.floor(r() * CONCEPTS.length)];
  const pool = opts.category ? COPY.filter((c) => c.category === opts.category) : COPY;
  const copy = (pool.length ? pool : COPY)[Math.floor(r() * (pool.length || COPY.length))];
  const size = opts.size ?? SIZES_FOR[Math.floor(r() * SIZES_FOR.length)];
  const makeIdx = Math.floor(r() * MAKERS.length);
  const made = MAKERS[makeIdx](concept, copy, size);
  return {
    id: `gen-${seed}-${concept.id}-${size}`,
    name: `${concept.name} ${copy.category === 'Quotes' ? 'quote' : copy.kicker.toLowerCase().replace(/\b\w/g, (m) => m.toUpperCase())}`,
    category: copy.category,
    size,
    bg: made.bg,
    bg2: made.bg2,
    layers: made.layers,
  };
}

/** Rebuild the same template from its id, so a link to a generated design always works. */
export function templateFromId(id: string): DesignTemplate | null {
  const m = /^gen-(\d+)-([a-z-]+)-([a-z]+)$/.exec(id);
  if (!m) return null;
  const t = generateTemplate(Number(m[1]), { concept: m[2], size: m[3] as SizeId });
  return { ...t, id };
}

/** A concept as a design: the mood on a page with the type and colours ready to adapt. */
export function conceptTemplate(conceptId: string, size: SizeId = 'instagram', variant = 0): DesignTemplate {
  const c = CONCEPTS.find((x) => x.id === conceptId) ?? CONCEPTS[0];
  const copy = COPY[variant % COPY.length];
  const made = MAKERS[variant % MAKERS.length](c, copy, size);
  return { id: `concept-${c.id}-${size}-${variant}`, name: c.name, category: copy.category, size, bg: made.bg, bg2: made.bg2, layers: made.layers };
}
