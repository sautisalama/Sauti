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
const GENERIC_LABEL = new Set(['www', 'careers', 'jobs', 'apply', 'recruit', 'recruitment', 'hr', 'news', 'en', 'org', 'com', 'net', 'edu', 'gov', 'int', 'co', 'ke', 'uk', 'ac', 'io', 'info']);
export function hostMatchesName(host: string | null, name: string | null): boolean {
  if (!host || !name) return false;
  // A short name or its initials can be the whole domain: "UN Secretariat" on careers.un.org, "UNDP" on undp.org.
  const labels = host.toLowerCase().split('.').filter((l) => l && !GENERIC_LABEL.has(l));
  const toks = [...tokens(name)];
  const initials = toks.map((t) => t[0]).join('');
  if (labels.some((l) => l.length >= 2 && (toks.includes(l) || (initials.length >= 3 && l === initials)))) return true;
  const h = host.replace(/\.[a-z]{2,}(\.[a-z]{2})?$/, '').replace(/[^a-z0-9]/g, '');
  const parts = [...tokens(name)].filter((t) => t.length >= 3);
  if (!parts.length) return false;
  const joined = [...tokens(name)].join('');
  return parts.some((t) => h.includes(t)) || (joined.length >= 4 && (h.includes(joined) || joined.includes(h)));
}

/* ------------------------------------------------------------------------------------------------------------------
 * Dates a model wrote are never trusted by themselves. A date said in a call is worked out here from the words that
 * were said (the weekday, "tomorrow", "15 March"); a date in a summary must be one the source really contains.
 * ------------------------------------------------------------------------------------------------------------------ */

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const DAY_MS = 86400_000;
const iso = (d: Date) => d.toISOString().slice(0, 10);

/** Today's date in Nairobi as a UTC midnight, so weekday arithmetic does not slip a day around midnight. */
export function nairobiToday(now = new Date()): Date {
  return new Date(`${now.toLocaleDateString('en-CA', { timeZone: 'Africa/Nairobi' })}T00:00:00Z`);
}

/**
 * The date that a spoken or written phrase means, or null when it names no single day ("soon", "next week", "after the
 * funder replies"). Explicit dates, "today", "tomorrow", a weekday ("by Friday", "next Tuesday") and "end of the month"
 * are understood; a date already in the past is never returned.
 */
export function resolveSaidDate(phrase: string | null | undefined, from = new Date()): string | null {
  if (!phrase) return null;
  const t = normalise(phrase);
  const today = nairobiToday(from);
  const keep = (d: Date | null) => (d && d.getTime() >= today.getTime() ? iso(d) : null);

  const full = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(t);
  if (full) return keep(new Date(`${full[1]}-${full[2]}-${full[3]}T00:00:00Z`));

  const monthIdx = (w: string) => MONTHS.findIndex((m) => (m as readonly string[]).includes(w.replace(/\.$/, '')));
  const mk = (day: number, month: number, year: number | null) => {
    if (month < 0 || day < 1 || day > 31) return null;
    let y = year ?? today.getUTCFullYear();
    let d = new Date(Date.UTC(y, month, day));
    if (d.getUTCMonth() !== month) return null;
    if (!year && d.getTime() < today.getTime()) { y += 1; d = new Date(Date.UTC(y, month, day)); }
    return d;
  };
  const dm = /\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]{3,9})\.?(?:,?\s*(\d{4}))?\b/.exec(t);
  if (dm && monthIdx(dm[2]) >= 0) return keep(mk(Number(dm[1]), monthIdx(dm[2]), dm[3] ? Number(dm[3]) : null));
  const md = /\b([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?:,?\s*(\d{4}))?\b/.exec(t);
  if (md && monthIdx(md[1]) >= 0) return keep(mk(Number(md[2]), monthIdx(md[1]), md[3] ? Number(md[3]) : null));

  if (/\bday after tomorrow\b/.test(t)) return iso(new Date(today.getTime() + 2 * DAY_MS));
  if (/\btomorrow\b/.test(t)) return iso(new Date(today.getTime() + DAY_MS));
  if (/\b(today|tonight|end of (the )?day|close of business|cob|eod)\b/.test(t)) return iso(today);
  if (/\bend of (the )?month\b/.test(t)) return iso(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0)));

  const wd = WEEKDAYS.findIndex((w) => new RegExp(`\\b${w}\\b|\\b${w.slice(0, 3)}\\b`).test(t));
  if (wd >= 0) {
    // "Friday" is the next one (today counts); "next Friday" is the one after that when this week's is still ahead.
    let ahead = (wd - today.getUTCDay() + 7) % 7;
    if (/\bnext\b/.test(t)) ahead += 7;
    return iso(new Date(today.getTime() + ahead * DAY_MS));
  }
  if (/\bend of (the )?week\b/.test(t)) {
    const ahead = (5 - today.getUTCDay() + 7) % 7;
    return iso(new Date(today.getTime() + ahead * DAY_MS));
  }
  return null;
}

/** Every day-and-month written in a text, as "MM-DD" (the year is often left out, so it is not compared). */
function monthDays(text: string): Set<string> {
  const t = normalise(text);
  const out = new Set<string>();
  const pad = (n: number) => String(n).padStart(2, '0');
  const idx = (w: string) => MONTHS.findIndex((m) => (m as readonly string[]).includes(w.replace(/\.$/, '')));
  for (const m of t.matchAll(/\b\d{4}-(\d{2})-(\d{2})\b/g)) out.add(`${m[1]}-${m[2]}`);
  for (const m of t.matchAll(/\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]{3,9})\b/g)) { const i = idx(m[2]); if (i >= 0) out.add(`${pad(i + 1)}-${pad(Number(m[1]))}`); }
  for (const m of t.matchAll(/\b([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b/g)) { const i = idx(m[1]); if (i >= 0) out.add(`${pad(i + 1)}-${pad(Number(m[2]))}`); }
  return out;
}

/**
 * Lines of a model's answer that state a date the source does not contain are removed. A summary may restate and
 * reorder dates; it may not make one up. Returns the text and how many lines were left out.
 */
export function dropUnsupportedDateLines(answer: string, source: string): { text: string; dropped: number } {
  const known = monthDays(source);
  let dropped = 0;
  const kept = answer.split('\n').filter((line) => {
    const bad = [...monthDays(line)].some((md) => !known.has(md));
    if (bad) dropped += 1;
    return !bad;
  });
  return { text: kept.join('\n').replace(/\n{3,}/g, '\n\n').trim(), dropped };
}
