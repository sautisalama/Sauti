/**
 * Evidence checks, ported from the PataNext worker: plain code that confirms what a model claims is really in
 * the source. A deadline only counts when the post states it as a closing date, and a link only counts when
 * it appears in the post or on the page.
 */

const MONTHS = [
  ['january', 'jan'], ['february', 'feb'], ['march', 'mar'], ['april', 'apr'], ['may', 'may'], ['june', 'jun'],
  ['july', 'jul'], ['august', 'aug'], ['september', 'sep', 'sept'], ['october', 'oct'], ['november', 'nov'], ['december', 'dec'],
] as const;

const DEADLINE_WORDS =
  /\b(deadline|closes?|closing|close date|last date|last day|apply by|apply before|due|submit(?:ted)? by|submission|applications? (?:close|end|due)|until|no later than|before)\b/i;

export function normalise(s: string): string {
  return s.toLowerCase().replace(/[‘’‚‛]/g, "'").replace(/[“”„]/g, '"').replace(/[‐-―]/g, '-').replace(/\s+/g, ' ').trim();
}
const loose = (s: string) => normalise(s).replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

/** True if the quote appears in the source, ignoring case, spacing and punctuation. */
export function quoteInSource(quote: string | null | undefined, source: string): boolean {
  if (!quote) return false;
  const q = loose(quote);
  if (q.length < 4) return false;
  return loose(source).includes(q);
}

/** True if the text mentions this ISO date in any common written form. */
export function mentionsDate(iso: string, text: string): boolean {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return false;
  const [, y, mm, dd] = m;
  const month = Number(mm);
  const day = Number(dd);
  const t = normalise(text);
  const names = MONTHS[month - 1] ?? [];
  const dayRe = `0?${day}(?:st|nd|rd|th)?`;
  const nameRe = `(?:${names.join('|')})\\b\\.?`;
  const yearRe = `(?:,?\\s*(?:${y}|${y.slice(2)}))`;
  const hasYear = new RegExp(`\\b${y}\\b`).test(t);
  const yearPart = hasYear ? yearRe : '(?!,?\\s*\\d{2,4}\\b)';
  const patterns = [
    `\\b${dayRe}\\s+(?:of\\s+)?${nameRe}${yearPart}`,
    `\\b${nameRe}\\s+${dayRe}${yearPart}`,
    `\\b${y}-${mm}-${dd}\\b`,
    `\\b0?${day}[/.\\-]0?${month}[/.\\-](?:${y}|${y.slice(2)})\\b`,
  ];
  return patterns.some((p) => new RegExp(p, 'i').test(t));
}

export type DeadlineEvidence = 'stated' | 'no_quote' | 'quote_not_in_source' | 'date_not_in_quote' | 'not_a_deadline';

export function checkDeadline(deadline: string | null, quote: string | null, source: string): DeadlineEvidence {
  if (!deadline || !quote) return 'no_quote';
  if (!quoteInSource(quote, source)) return 'quote_not_in_source';
  if (!mentionsDate(deadline, quote)) return 'date_not_in_quote';
  if (!DEADLINE_WORDS.test(quote)) return 'not_a_deadline';
  return 'stated';
}

export const DEADLINE_NOTE: Record<DeadlineEvidence, string> = {
  stated: 'The post gives this as the closing date.',
  no_quote: 'No closing date is written in the post.',
  quote_not_in_source: 'The date the AI read is not in the post, so it was not used.',
  date_not_in_quote: 'The quoted words do not contain that date.',
  not_a_deadline: 'A date is there, but not as a closing date.',
};

export function comparableUrl(u: string): string {
  return u.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/^(www|m)\./, '').replace(/[?#].*$/, '').replace(/\/+$/, '');
}

export type UrlEvidence = 'stated' | 'no_url' | 'not_in_source';

/** Does the link really appear in the post or among the page's links? */
export function checkUrl(url: string | null, source: string, links: string[] = []): UrlEvidence {
  if (!url) return 'no_url';
  const want = comparableUrl(url);
  if (want.length < 4) return 'not_in_source';
  if (links.some((l) => comparableUrl(l) === want)) return 'stated';
  const s = source.toLowerCase().replace(/https?:\/\//g, '').replace(/\bwww\./g, '');
  return s.includes(want) ? 'stated' : 'not_in_source';
}

const STOP = new Set(['the', 'of', 'for', 'and', 'in', 'on', 'a', 'an', 'to', 'at', 'inc', 'ltd', 'org', 'foundation', 'official', 'kenya']);
function tokens(s: string | null | undefined): Set<string> {
  return new Set(loose(s ?? '').split(' ').filter((w) => w.length > 1 && !STOP.has(w)));
}
export function jaccard(a: string | null | undefined, b: string | null | undefined): number {
  const A = tokens(a);
  const B = tokens(b);
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / (A.size + B.size - inter);
}
export function sameIssuer(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const la = loose(a);
  const lb = loose(b);
  return la === lb || la.includes(lb) || lb.includes(la) || jaccard(a, b) >= 0.5;
}

/** Does the organisation's name show up in the website's host (unhcr -> unhcr.org)? */
export function hostMatchesName(host: string | null, name: string | null): boolean {
  if (!host || !name) return false;
  const h = host.replace(/\.[a-z]{2,}(\.[a-z]{2})?$/, '').replace(/[^a-z0-9]/g, '');
  const parts = [...tokens(name)].filter((t) => t.length >= 3);
  if (!parts.length) return false;
  const joined = [...tokens(name)].join('');
  return parts.some((t) => h.includes(t)) || (joined.length >= 4 && (h.includes(joined) || joined.includes(h)));
}
