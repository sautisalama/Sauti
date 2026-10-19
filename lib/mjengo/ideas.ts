import { addDays, format } from 'date-fns';
import type { Channel } from './channels';
import { suggestTimes } from './best-times';
import { holidaysKE } from './holidays-ke';
import type { ChannelEngagement, EngagedPost } from './engagement-core';

/**
 * What to post and when, from signals that are free and need no account of anyone else's:
 *  - what people in Kenya are searching right now (Google Trends daily feed),
 *  - the questions people type about a topic (Google search suggestions, the way AnswerThePublic works),
 *  - words that go with the topic (Datamuse) for hashtags,
 *  - the organisation's own history (likes and comments by hour and weekday, hashtags that did well), read through the
 *    accounts already connected for posting,
 *  - the calendar: public holidays and awareness days coming up.
 * X does not give trends or analytics without a paid API, so for X the search signals and the typical windows are used.
 */

export interface Trend { title: string; traffic: string | null; about: string | null; fits: boolean | null }
export interface Occasion { date: string; label: string; days: number }
export interface TimePlan { basis: 'yours' | 'typical'; slots: { iso?: string; label: string }[]; why: string }
export interface Ideas {
  topic: string;
  trends: Trend[];
  questions: string[];
  related: string[];
  occasions: Occasion[];
  hashtags: Partial<Record<Channel, { tag: string; why: string }[]>>;
  times: Partial<Record<Channel, TimePlan>>;
  /** Topics read from the organisation's own best posts, to start from. */
  ownTopics: string[];
  notes: string[];
}

/** How many hashtags each network rewards; more than this reads as spam and is penalised in reach. */
export const HASHTAG_LIMIT: Record<Channel, number> = { instagram: 5, linkedin: 3, x: 2, facebook: 2, tiktok: 4, website: 0 };

const memo = new Map<string, { at: number; v: unknown }>();
async function cached<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ttlMs) return hit.v as T;
  const v = await load();
  memo.set(key, { at: Date.now(), v });
  if (memo.size > 200) memo.delete(memo.keys().next().value as string);
  return v;
}

const get = (url: string) => fetch(url, { signal: AbortSignal.timeout(7_000), headers: { 'User-Agent': 'Mozilla/5.0 (compatible; SautiSuite/1.0)' }, cache: 'no-store' });
const decode = (s: string) => s.replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').trim();

/** What is being searched for most in Kenya today. */
export async function googleTrends(geo = 'KE'): Promise<{ title: string; traffic: string | null; about: string | null }[]> {
  return cached(`trends:${geo}`, 3 * 3600_000, async () => {
    try {
      const res = await get(`https://trends.google.com/trending/rss?geo=${geo}`);
      if (!res.ok) return [];
      const xml = await res.text();
      return [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 20).map((m) => {
        const b = m[1];
        const pick = (tag: string) => { const r = b.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`)); return r ? decode(r[1]) : null; };
        return { title: pick('title') ?? '', traffic: pick('ht:approx_traffic'), about: pick('ht:news_item_title') };
      }).filter((t) => t.title);
    } catch { return []; }
  });
}

/** The questions and searches people make about a topic. */
export async function searchQuestions(topic: string): Promise<string[]> {
  const t = topic.trim().toLowerCase();
  if (!t) return [];
  return cached(`q:${t}`, 6 * 3600_000, async () => {
    const prefixes = [`how to ${t}`, `how do I ${t}`, `why ${t}`, `what is ${t}`, `can ${t}`, `should ${t}`, `where to ${t}`, `${t} for`];
    const out = new Set<string>();
    await Promise.all(prefixes.map(async (q) => {
      try {
        const res = await get(`https://suggestqueries.google.com/complete/search?client=firefox&hl=en&gl=ke&q=${encodeURIComponent(q)}`);
        if (!res.ok) return;
        const j = (await res.json()) as [string, string[]];
        for (const s of j[1] ?? []) if (s.length > t.length + 4) out.add(s);
      } catch { /* one source missing is fine */ }
    }));
    const words = t.split(/\s+/).filter((w) => w.length > 3);
    return [...out].filter((s) => !words.length || words.some((w) => s.toLowerCase().includes(w))).filter((s) => /^(how|why|what|can|should|where|when|is|are|do|does)\b/i.test(s) || s.includes('?')).slice(0, 14);
  });
}

/** Words that go with the topic, for hashtags. */
export async function relatedWords(topic: string): Promise<string[]> {
  const t = topic.trim().toLowerCase();
  if (!t) return [];
  return cached(`rel:${t}`, 24 * 3600_000, async () => {
    try {
      const res = await get(`https://api.datamuse.com/words?ml=${encodeURIComponent(t)}&max=24`);
      if (!res.ok) return [];
      const j = (await res.json()) as { word: string }[];
      return j.map((x) => x.word).filter((w) => /^[a-z]{4,18}$/.test(w)).slice(0, 12);
    } catch { return []; }
  });
}

const camel = (s: string) => s.split(/[^A-Za-z0-9]+/).filter(Boolean).map((w) => w[0].toUpperCase() + w.slice(1).toLowerCase()).join('');

/** Awareness days that matter to a human rights and safety organisation, month and day. */
const DAYS: [number, number, string][] = [
  [1, 24, 'International Day of Education'], [2, 4, 'World Cancer Day'], [3, 8, "International Women's Day"], [4, 7, 'World Health Day'], [5, 3, 'World Press Freedom Day'],
  [5, 15, 'International Day of Families'], [5, 25, 'Africa Day'], [6, 5, 'World Environment Day'], [6, 12, 'World Day Against Child Labour'], [6, 16, 'Day of the African Child'],
  [6, 20, 'World Refugee Day'], [8, 12, 'International Youth Day'], [8, 19, 'World Humanitarian Day'], [9, 5, 'International Day of Charity'], [9, 10, 'World Suicide Prevention Day'],
  [9, 21, 'International Day of Peace'], [10, 5, "World Teachers' Day"], [10, 10, 'World Mental Health Day'], [10, 11, 'International Day of the Girl Child'], [10, 16, 'World Food Day'],
  [11, 19, "International Men's Day"], [11, 25, 'International Day for the Elimination of Violence against Women (start of 16 Days of Activism)'], [12, 1, 'World AIDS Day'], [12, 3, 'International Day of Persons with Disabilities'],
  [12, 5, 'International Volunteer Day'], [12, 10, 'Human Rights Day (end of 16 Days of Activism)'],
];

export function upcomingOccasions(from = new Date(), horizon = 28): Occasion[] {
  const out: Occasion[] = [];
  for (let i = 0; i <= horizon; i++) {
    const d = addDays(from, i);
    const key = format(d, 'yyyy-MM-dd');
    const hol = holidaysKE(d.getFullYear()).get(key);
    if (hol) out.push({ date: key, label: `${hol} (public holiday in Kenya)`, days: i });
    for (const [m, day, label] of DAYS) if (d.getMonth() + 1 === m && d.getDate() === day) out.push({ date: key, label, days: i });
  }
  return out;
}

const EAT = (iso: string) => new Date(new Date(iso).getTime() + 3 * 3600_000);
const DAY = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];
const hourLabel = (h: number) => `${h % 12 || 12}${h < 12 ? 'am' : 'pm'}`;

/** When this account's own posts drew the most response, needing enough posts to mean something. */
export function ownTimes(ch: ChannelEngagement): TimePlan | null {
  const posts = ch.posts.filter((p) => p.at);
  if (posts.length < 8) return null;
  const score = (p: EngagedPost) => p.likes + p.comments * 3 + (p.shares ?? 0) * 4;
  const cells = new Map<string, { n: number; sum: number; day: number; hour: number }>();
  for (const p of posts) {
    const e = EAT(p.at);
    const day = e.getUTCDay();
    const hour = Math.floor(e.getUTCHours() / 3) * 3; // three-hour bands: twenty posts are too few for single hours
    const k = `${day}-${hour}`;
    const c = cells.get(k) ?? { n: 0, sum: 0, day, hour };
    c.n++; c.sum += score(p);
    cells.set(k, c);
  }
  const best = [...cells.values()].sort((a, b) => b.sum / b.n - a.sum / a.n || b.n - a.n).slice(0, 3);
  if (!best.length || best[0].sum === 0) return null;
  return {
    basis: 'yours',
    slots: best.map((c) => ({ label: `${DAY[c.day]} ${hourLabel(c.hour)} to ${hourLabel(c.hour + 3)}` })),
    why: `From your last ${posts.length} posts on ${ch.channel === 'instagram' ? 'Instagram' : 'Facebook'}: these hours drew the most likes, comments and shares.`,
  };
}

/** Hashtags that went with this account's best posts, best first. */
export function ownTags(chs: ChannelEngagement[]): { tag: string; avg: number; uses: number }[] {
  const by = new Map<string, { sum: number; n: number }>();
  for (const ch of chs) for (const p of ch.posts) {
    const s = p.likes + p.comments * 3 + (p.shares ?? 0) * 4;
    for (const t of p.tags) { const c = by.get(t) ?? { sum: 0, n: 0 }; c.sum += s; c.n++; by.set(t, c); }
  }
  return [...by.entries()].map(([tag, v]) => ({ tag, avg: v.sum / v.n, uses: v.n })).sort((a, b) => b.avg - a.avg).slice(0, 12);
}

/** Choose hashtags for each network: what worked before, the topic, its acronym, related words, then what is trending. */
export function pickHashtags(topic: string, related: string[], trends: Trend[], own: { tag: string; avg: number; uses: number }[], channels: Channel[]): Ideas['hashtags'] {
  const out: Ideas['hashtags'] = {};
  const words = topic.trim().split(/\s+/).filter(Boolean);
  const pool: { tag: string; why: string }[] = [];
  const add = (tag: string, why: string) => { const t = tag.startsWith('#') ? tag : `#${tag}`; if (t.length > 2 && t.length <= 30 && !pool.some((p) => p.tag.toLowerCase() === t.toLowerCase())) pool.push({ tag: t, why }); };
  for (const o of own.filter((o) => o.uses >= 2).slice(0, 3)) add(o.tag, `Used ${o.uses} times on your posts, averaging the most response`);
  if (words.length) add(camel(topic), 'Your topic as one tag');
  if (words.length >= 3) add(words.map((w) => w[0]).join('').toUpperCase(), 'The short form people search');
  for (const r of related.slice(0, 6)) add(r, 'A word people use with this topic');
  for (const t of trends.filter((x) => x.fits !== false).slice(0, 3)) if (t.title.split(/\s+/).length <= 3) add(camel(t.title), 'Trending in Kenya today');
  add('Kenya', 'Reaches people in Kenya');
  for (const ch of channels) {
    const limit = HASHTAG_LIMIT[ch];
    if (limit) out[ch] = pool.slice(0, limit);
  }
  return out;
}

export function timesFor(channels: Channel[], engagement: ChannelEngagement[]): Ideas['times'] {
  const out: Ideas['times'] = {};
  for (const ch of channels) {
    const mine = engagement.find((e) => e.channel === ch);
    const own = mine ? ownTimes(mine) : null;
    if (own) { out[ch] = own; continue; }
    const typical = suggestTimes([ch], [], new Date(), 3);
    out[ch] = { basis: 'typical', slots: typical.map((t) => ({ iso: t.iso, label: t.label })), why: typical[0]?.why ?? 'Typical for this network in Nairobi.' };
  }
  return out;
}
