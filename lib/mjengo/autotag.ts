import { looseAdmin } from '@/lib/loose-db';
import { askAi } from '@/lib/mjengo/ai';

/** A tag as it is kept: lowercase, words joined with hyphens, no stray punctuation, at most 28 characters. */
export function normaliseTag(t: string): string {
  return t.toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 28).replace(/-+$/, '');
}

export function cleanTags(tags: unknown, max = 8): string[] {
  if (!Array.isArray(tags)) return [];
  return [...new Set(tags.map((t) => (typeof t === 'string' ? normaliseTag(t) : '')).filter((t) => t.length >= 2))].slice(0, max);
}

const TAGGED: { table: string; col?: string }[] = [
  { table: 'vault_files' }, { table: 'mjengo_grants' }, { table: 'mjengo_opportunities' }, { table: 'mjengo_projects' },
  { table: 'mjengo_fellowships' }, { table: 'mjengo_todos' }, { table: 'mjengo_meetings' }, { table: 'mjengo_events' }, { table: 'mjengo_contacts' },
];

/** Every tag in use across the suite with how often, most used first. Tags are one shared vocabulary. */
export async function tagVocabulary(limit = 80): Promise<{ tag: string; count: number }[]> {
  const db = looseAdmin();
  const counts = new Map<string, number>();
  await Promise.all(TAGGED.map(async ({ table }) => {
    const { data } = await db.from(table).select('tags').not('tags', 'eq', '{}').limit(1500);
    for (const r of (data ?? []) as { tags: string[] | null }[]) for (const t of r.tags ?? []) counts.set(t, (counts.get(t) ?? 0) + 1);
  }));
  return [...counts.entries()].map(([tag, count]) => ({ tag, count })).sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag)).slice(0, limit);
}

const FILLER = new Set('about after again also because been before being between both could does each from have into just like make more most much must only other over same should since some such than that their them then there these they this those through very were what when where which while with would your the and for are was not but all can has had her his its our out who why will'.split(' '));

/** Without the AI: the words a text leans on most. */
export function keywordTags(title: string, text: string, max = 4): string[] {
  const words = `${title} ${title} ${text}`.toLowerCase().match(/[a-z][a-z-]{3,}/g) ?? [];
  const n = new Map<string, number>();
  for (const w of words) if (!FILLER.has(w)) n.set(w, (n.get(w) ?? 0) + 1);
  return [...n.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1]).slice(0, max).map(([w]) => normaliseTag(w));
}

/**
 * Tags for a document, call, grant or task: its kind, its subject, the people or places it is about. The suite's own
 * tags are offered first so that the same thing gets the same tag everywhere; new tags are made only when none fit.
 * Names of survivors and other personal details are never used as tags.
 */
export async function autoTag(input: { title: string; text: string; kind: string; vocabulary?: string[]; max?: number }): Promise<string[]> {
  const max = input.max ?? 5;
  const vocab = input.vocabulary ?? (await tagVocabulary(60)).map((v) => v.tag);
  const body = input.text.replace(/\s+/g, ' ').trim().slice(0, 5000);
  if (!body && !input.title.trim()) return [];
  try {
    const raw = await askAi(
      `You tag items in a small non-profit's workspace so they can be found and grouped later. Reply with one JSON object {"tags":[string]} with ${Math.min(3, max)} to ${max} tags. A tag is one to three lowercase words joined by hyphens (for example "grant-application", "legal-aid", "kibera", "budget", "meeting-notes", "harmony-trust"). Cover: what kind of item it is, its subject, and the funder, partner or place it is mostly about. Reuse a tag from the EXISTING TAGS list only when the text is clearly about it (the same funder, place, subject or kind of document), so the same thing is tagged the same way everywhere; never use an existing tag just because it is in the list, and make a new tag when none truly fits. Never use the name of a survivor, a phone number, an email address or any other personal detail as a tag. Use only what the text says.`,
      `Kind of item: ${input.kind}\nTitle: ${input.title}\n\nEXISTING TAGS: ${vocab.join(', ') || '(none yet)'}\n\nText:\n${body}`,
      200,
      { json: true, temperature: 0.1 },
    );
    const tags = cleanTags((JSON.parse(raw) as { tags?: unknown }).tags, max);
    if (tags.length) return tags;
  } catch { /* the words of the text still say something */ }
  return keywordTags(input.title, body, Math.min(max, 4));
}
