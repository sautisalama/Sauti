'use server';

import { guard } from '@/lib/action-result';
import { requireAdminActor } from '@/lib/access/super-admin';
import { askAi } from '@/lib/mjengo/ai';
import { fetchHtml, pageText } from '@/lib/mjengo/safe-fetch';

/** What could be read from a fund, call or programme page. Only what the page says is present. */
export interface FundDetails {
  title?: string;
  organisation?: string;
  description?: string;
  amount?: number;
  currency?: 'USD' | 'KES' | 'EUR' | 'GBP';
  deadline?: string;
  sectors?: string[];
  themes?: string[];
  sdgs?: number[];
  regions?: string[];
  eligibility?: string;
  sourceSite?: string;
}

const list = (v: unknown, max = 12): string[] => (Array.isArray(v) ? [...new Set(v.map((x) => String(x).trim().replace(/\s+/g, ' ').slice(0, 60)).filter(Boolean))].slice(0, max) : []);

async function extract_(raw: string): Promise<FundDetails> {
  await requireAdminActor();
  const text = String(raw ?? '').trim();
  if (!text) throw new Error('Paste a link first.');
  const { url, html } = await fetchHtml(/^https?:\/\//i.test(text) ? text : `https://${text}`);
  const body = pageText(html).slice(0, 14_000);
  if (body.length < 80) throw new Error('That page has too little text to read.');
  const host = new URL(url).hostname.replace(/^www\./, '');

  const answer = await askAi(
    `You read a funding call, grant, fellowship or consultancy page and extract facts for a grants tracker. Reply with ONE JSON object using only these keys, and include a key ONLY when the page clearly states it (never guess, never invent): {"title": string, "organisation": string (the funder or host), "description": string (what it funds or offers, under 450 characters, plain sentences), "amount": number (largest single award or total, digits only), "currency": "USD"|"KES"|"EUR"|"GBP", "deadline": "YYYY-MM-DD", "sectors": string[] (broad fields such as Health, Education, Justice, Gender, Climate; at most 6), "themes": string[] (specific focus areas the page names; at most 8), "sdgs": number[] (UN Sustainable Development Goals 1 to 17 the page names or clearly covers), "regions": string[] (countries or regions it is open to), "eligibility": string (who can apply, under 350 characters)}.`,
    `Page address: ${url}\n\nPage text:\n${body}`,
    900,
    { json: true, temperature: 0.1 },
  );
  let j: Record<string, unknown> = {};
  try { j = JSON.parse(answer) as Record<string, unknown>; } catch {
    const m = /\{[\s\S]*\}/.exec(answer);
    if (m) { try { j = JSON.parse(m[0]) as Record<string, unknown>; } catch { /* nothing readable */ } }
  }
  const out: FundDetails = { sourceSite: host };
  const str = (v: unknown, n: number) => { const t = typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, n) : ''; return t || undefined; };
  const title = str(j.title, 160); if (title) out.title = title;
  const org = str(j.organisation, 120); if (org) out.organisation = org;
  const desc = str(j.description, 600); if (desc) out.description = desc;
  const amt = Number(j.amount); if (Number.isFinite(amt) && amt > 0) out.amount = Math.round(amt);
  if (typeof j.currency === 'string' && ['USD', 'KES', 'EUR', 'GBP'].includes(j.currency)) out.currency = j.currency as FundDetails['currency'];
  if (typeof j.deadline === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(j.deadline)) out.deadline = j.deadline;
  const sectors = list(j.sectors, 6); if (sectors.length) out.sectors = sectors;
  const themes = list(j.themes, 8); if (themes.length) out.themes = themes;
  const sdgs = (Array.isArray(j.sdgs) ? j.sdgs : []).map((n) => Math.round(Number(n))).filter((n) => n >= 1 && n <= 17);
  if (sdgs.length) out.sdgs = [...new Set(sdgs)].sort((a, b) => a - b);
  const regions = list(j.regions, 8); if (regions.length) out.regions = regions;
  const el = str(j.eligibility, 450); if (el) out.eligibility = el;
  return out;
}

export const extractFundDetails = guard(extract_);
