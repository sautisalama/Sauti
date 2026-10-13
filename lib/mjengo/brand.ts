import { looseAdmin } from '@/lib/loose-db';

/** The organisation's brand, kept once and used everywhere: documents, forms, design and the assistant. */
export interface Brand {
  name: string;
  tagline: string;
  contact: string;
  address: string;
  /** Hex colours with #, main brand colours first. */
  colours: string[];
  /** Roles chosen from the colours, as hex with #. */
  palette: { primary: string; secondary: string; accent: string; muted: string };
  fonts: { heading: string; body: string };
  /** Logo as a data URL, or a path under the site. */
  logo: string | null;
  letterhead: { align: 'left' | 'center' | 'right'; rule: boolean; logoWidth: number };
  /** How the brand must be used, in plain sentences (letterhead placement, logo clear space, tone, do and don't). */
  rules: string[];
  guidelines: { fileId: string; name: string; readAt: string } | null;
  updatedAt: string | null;
}

export const DEFAULT_BRAND: Brand = {
  name: 'Sauti Salama',
  tagline: 'Breaking the Silence, Building a Brighter Future',
  contact: 'sautisalama.org',
  address: '',
  colours: ['#0F3B44', '#068297', '#7D2AE8', '#FFDE59', '#0E1318'],
  palette: { primary: '#0F3B44', secondary: '#068297', accent: '#068297', muted: '#6B7280' },
  fonts: { heading: 'Poppins', body: 'Inter' },
  logo: '/Logo.png',
  letterhead: { align: 'left', rule: true, logoWidth: 56 },
  rules: [],
  guidelines: null,
  updatedAt: null,
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const hex = (v: unknown, fallback: string) => (typeof v === 'string' && HEX.test(v.trim()) ? v.trim().toUpperCase() : fallback);
const text = (v: unknown, max: number, fallback = '') => (typeof v === 'string' ? v.trim().slice(0, max) : fallback);

/** Make any stored or submitted brand safe to use: colours are hex, text is bounded. */
export function cleanBrand(input: Partial<Brand> | null | undefined, base: Brand = DEFAULT_BRAND): Brand {
  const i = input ?? {};
  const colours = Array.isArray(i.colours) ? [...new Set(i.colours.map((c) => hex(c, '')).filter(Boolean))].slice(0, 24) : base.colours;
  const p = (i.palette ?? {}) as Partial<Brand['palette']>;
  const logo = typeof i.logo === 'string' && (i.logo.startsWith('data:image/') || i.logo.startsWith('/') || /^https:\/\//.test(i.logo)) && i.logo.length < 450_000 ? i.logo : i.logo === null ? null : base.logo;
  const lh = (i.letterhead ?? {}) as Partial<Brand['letterhead']>;
  return {
    name: text(i.name, 80, base.name) || base.name,
    tagline: text(i.tagline, 160, base.tagline),
    contact: text(i.contact, 160, base.contact),
    address: text(i.address, 200, base.address),
    colours: colours.length ? colours : base.colours,
    palette: {
      primary: hex(p.primary, base.palette.primary),
      secondary: hex(p.secondary, base.palette.secondary),
      accent: hex(p.accent, base.palette.accent),
      muted: hex(p.muted, base.palette.muted),
    },
    fonts: { heading: text(i.fonts?.heading, 60, base.fonts.heading) || base.fonts.heading, body: text(i.fonts?.body, 60, base.fonts.body) || base.fonts.body },
    logo,
    letterhead: {
      align: lh.align === 'center' || lh.align === 'right' ? lh.align : lh.align === 'left' ? 'left' : base.letterhead.align,
      rule: typeof lh.rule === 'boolean' ? lh.rule : base.letterhead.rule,
      logoWidth: Math.min(200, Math.max(24, Number(lh.logoWidth) || base.letterhead.logoWidth)),
    },
    rules: Array.isArray(i.rules) ? i.rules.map((r) => text(r, 300)).filter(Boolean).slice(0, 40) : base.rules,
    guidelines: i.guidelines && typeof i.guidelines.fileId === 'string' ? { fileId: i.guidelines.fileId, name: text(i.guidelines.name, 200), readAt: text(i.guidelines.readAt, 40) } : i.guidelines === null ? null : base.guidelines,
    updatedAt: base.updatedAt,
  };
}

export async function loadBrandRow(): Promise<Brand> {
  const { data } = await looseAdmin().from('mjengo_brand').select('data, updated_at').eq('id', 'org').maybeSingle();
  const b = cleanBrand((data?.data ?? {}) as Partial<Brand>);
  return { ...b, updatedAt: (data?.updated_at as string | undefined) ?? null };
}

/** The brand as a few plain lines an AI can follow when it writes or lays out something. */
export function brandAsPrompt(b: Brand): string {
  return [
    `Organisation: ${b.name}${b.tagline ? ` (${b.tagline})` : ''}.`,
    `Colours: ${b.colours.join(', ')}. Primary ${b.palette.primary}, secondary ${b.palette.secondary}, accent ${b.palette.accent}, muted ${b.palette.muted}.`,
    `Fonts: headings ${b.fonts.heading}, body ${b.fonts.body}.`,
    `Letterhead: name, tagline and contact at the top, ${b.letterhead.align} aligned${b.letterhead.rule ? ', with a rule in the accent colour below' : ''}${b.logo ? ', with the logo' : ''}.`,
    ...(b.rules.length ? ['Brand rules:', ...b.rules.map((r) => `- ${r}`)] : []),
  ].join('\n');
}
