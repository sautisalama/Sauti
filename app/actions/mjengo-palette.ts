'use server';

import { guard } from '@/lib/action-result';
import { requireAdminActor } from '@/lib/access/super-admin';
import { askAi } from '@/lib/mjengo/ai';

/** Colours that fit a description, an organisation's brand guideline text, or a mood. Always hex codes. */
async function paletteFromText_(text: string): Promise<string[]> {
  await requireAdminActor();
  const t = text.trim().slice(0, 6000);
  if (t.length < 3) throw new Error('Describe the look, or paste the brand guidelines.');
  const raw = await askAi(
    'You are a brand designer. From the text, choose between 4 and 8 colours as hex codes. If the text is an official brand guideline, use exactly the colours it names, primary first. Otherwise choose a harmonious palette that suits the description. Answer with a JSON object {"colours": ["#RRGGBB", ...]} and nothing else.',
    t,
    300,
    { json: true, temperature: 0.3 }
  );
  try {
    const j = JSON.parse(raw) as { colours?: string[] };
    const out = (j.colours ?? []).map((c) => String(c).trim().toUpperCase()).filter((c) => /^#[0-9A-F]{6}$/.test(c));
    if (out.length) return [...new Set(out)].slice(0, 8);
  } catch { /* fall through */ }
  throw new Error('Could not work out colours from that. Try describing the mood in a sentence.');
}

export const paletteFromText = guard(paletteFromText_);
