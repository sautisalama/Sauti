import { looseAdmin } from '@/lib/loose-db';
import { may, permissionsFor, type ModuleKey } from '@/lib/access/permissions';
import { atLeast, levelFor, loadIndex, oversightFor } from '@/lib/vault/access';
import { ENTITY_HREF, entitiesFor, type EntityKind } from '@/lib/mjengo/entity-view';
import { embed, toVector } from '@/lib/mjengo/embeddings';
import { fileLink } from '@/lib/mjengo/links';
import { SEARCH_TYPE_LABEL, type SearchFilters, type SearchHit, type SearchPerson, type SearchResult, type SearchType } from '@/lib/mjengo/search-shared';

export type { SearchFilters, SearchHit, SearchResult, SearchType } from '@/lib/mjengo/search-shared';
export { SEARCH_TYPE_LABEL };

interface Asker { id: string; email: string }
interface Meta { title: string; link: string | null; tags: string[]; people: string[] }
type Key = `${SearchType}:${string}`;
const ENTITY_TYPES: EntityKind[] = ['grant', 'opportunity', 'project', 'fellowship'];
const MODULE: Record<SearchType, ModuleKey> = { file: 'files', meeting: 'meet', todo: 'todos', event: 'calendar', grant: 'grants', opportunity: 'opportunities', project: 'projects', fellowship: 'fellowships' };

/**
 * For a set of candidate things: which of them this person may see, with their tags and the team members they
 * belong to. This is the one gate every search and "similar" result passes through.
 */
async function metaFor(asker: Asker, wanted: Map<Key, { type: SearchType; id: string }>): Promise<Map<Key, Meta>> {
  const out = new Map<Key, Meta>();
  if (!wanted.size) return out;
  const perms = await permissionsFor(asker.id, asker.email);
  const db = looseAdmin();
  const ids = (t: SearchType) => [...wanted.values()].filter((w) => w.type === t).map((w) => w.id);
  const allowed = (t: SearchType) => may(perms, MODULE[t]) && ids(t).length > 0;
  const tasks: Promise<void>[] = [];

  if (allowed('file')) tasks.push((async () => {
    const [ix, oversight] = await Promise.all([loadIndex(), oversightFor(asker.email)]);
    for (const id of ids('file')) {
      const f = ix.files.get(id);
      if (!f || !atLeast(levelFor(ix, asker.id, 'file', id, oversight), 'view')) continue;
      const people = [f.owner_id, ...ix.perms.filter((p) => p.resource_type === 'file' && p.resource_id === id).map((p) => p.user_id)];
      out.set(`file:${id}`, { title: f.name, link: fileLink(f.name, id), tags: f.tags ?? [], people });
    }
  })());

  if (allowed('meeting')) tasks.push((async () => {
    const { data } = await db.from('mjengo_meetings').select('code, title, created_by, participants, tags').in('code', ids('meeting'));
    for (const m of (data ?? []) as { code: string; title: string | null; created_by: string | null; participants: string[] | null; tags: string[] | null }[]) {
      out.set(`meeting:${m.code}`, { title: m.title || 'Call', link: `/dashboard/mjengo/meetings?code=${m.code}`, tags: m.tags ?? [], people: [...(m.created_by ? [m.created_by] : []), ...(m.participants ?? [])] });
    }
  })());

  const entities = ENTITY_TYPES.some((k) => allowed(k)) ? entitiesFor(asker, ENTITY_TYPES.filter((k) => allowed(k))) : Promise.resolve([]);
  tasks.push((async () => {
    for (const e of await entities) {
      if (!wanted.has(`${e.kind}:${e.id}`)) continue;
      const r = e.row;
      out.set(`${e.kind}:${e.id}`, { title: e.title, link: ENTITY_HREF[e.kind], tags: (r.tags as string[] | null) ?? [], people: [r.owner_id, r.lead_id, r.created_by].filter((x): x is string => typeof x === 'string') });
    }
  })());

  if (allowed('todo')) tasks.push((async () => {
    const { data } = await db.from('mjengo_todos').select('id, title, assignee_ids, created_by, tags, entity_type, entity_id').in('id', ids('todo'));
    const visible = new Set((await entities).map((e) => `${e.kind}:${e.id}`));
    for (const t of (data ?? []) as { id: string; title: string; assignee_ids: string[] | null; created_by: string | null; tags: string[] | null; entity_type: string | null; entity_id: string | null }[]) {
      // A to-do on a private record is private with it.
      if (t.entity_type && !visible.has(`${t.entity_type}:${t.entity_id}`)) continue;
      out.set(`todo:${t.id}`, { title: t.title, link: '/dashboard/mjengo/todos', tags: t.tags ?? [], people: [...(t.assignee_ids ?? []), ...(t.created_by ? [t.created_by] : [])] });
    }
  })());

  if (allowed('event')) tasks.push((async () => {
    const { data } = await db.from('mjengo_events').select('id, title, created_by, tags').in('id', ids('event'));
    for (const e of (data ?? []) as { id: string; title: string; created_by: string | null; tags: string[] | null }[]) {
      out.set(`event:${e.id}`, { title: e.title, link: '/dashboard/mjengo/calendar', tags: e.tags ?? [], people: e.created_by ? [e.created_by] : [] });
    }
  })());

  await Promise.all(tasks);
  return out;
}

async function namesOf(ids: string[]): Promise<Map<string, string>> {
  const uniq = [...new Set(ids)];
  if (!uniq.length) return new Map();
  const { data } = await looseAdmin().from('profiles').select('id, first_name, last_name, email').in('id', uniq);
  return new Map(((data ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string | null }[]).map((p) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Someone']));
}

/** A window of the passage around where the fragment sits, or the start of it. */
export function snippetOf(content: string, frag: string | null, width = 150): { text: string; hit: string | null } {
  const flat = content.replace(/\s+/g, ' ').trim();
  if (frag) {
    const at = flat.toLowerCase().indexOf(frag.toLowerCase());
    if (at >= 0) {
      const from = Math.max(0, at - width);
      const to = Math.min(flat.length, at + frag.length + width);
      return { text: `${from > 0 ? '…' : ''}${flat.slice(from, to)}${to < flat.length ? '…' : ''}`, hit: flat.slice(at, at + frag.length) };
    }
  }
  return { text: flat.length > width * 2 ? `${flat.slice(0, width * 2)}…` : flat, hit: null };
}

interface Row { source_type: SearchType; source_id: string; title: string; content: string; link: string | null; sim: number; lex?: boolean }

/** Semantic hits are kept when they are close to the best one and above a floor, so a search never fills with noise. */
const FLOOR = 0.42;

/**
 * Search everything the person may see: by what a question is about (meaning vectors) and by any fragment of text
 * (a phrase from the middle of a document finds the document). Results can be narrowed by kind, by tag, and by team
 * member. Anything the person may not open never appears, whatever it says.
 */
export async function searchWorkspace(asker: Asker, query: string, filters: SearchFilters = {}, limit = 15): Promise<SearchResult> {
  const q = query.trim().slice(0, 300);
  if (q.length < 2) return { hits: [], lexicalOnly: false, pending: 0 };
  const db = looseAdmin();
  let vec: string | null = null;
  try { vec = toVector((await embed([q]))[0]); } catch { vec = null; }
  const narrow = !!(filters.types?.length || filters.tags?.length || filters.member);
  const { data, error } = await db.rpc('mjengo_search', { q: vec, frag: q.length >= 3 ? q : '', n: narrow ? 160 : 80 });
  if (error) throw new Error('Search is not available right now.');
  const rows = (data ?? []) as (Row & { lex: boolean })[];

  const best = new Map<Key, { type: SearchType; id: string; sim: number; lex: boolean; row: Row; lexRow: Row | null }>();
  for (const r of rows) {
    const k: Key = `${r.source_type}:${r.source_id}`;
    const cur = best.get(k) ?? { type: r.source_type, id: r.source_id, sim: 0, lex: false, row: r, lexRow: null };
    if (r.lex) { cur.lex = true; cur.lexRow = cur.lexRow ?? r; } else if (r.sim > cur.sim) { cur.sim = r.sim; cur.row = r; }
    best.set(k, cur);
  }
  const top = Math.max(0, ...[...best.values()].map((b) => b.sim));
  const kept = new Map([...best.entries()].filter(([, b]) => b.lex || (b.sim >= FLOOR && b.sim >= top - 0.2)));
  const meta = await metaFor(asker, new Map([...kept.entries()].map(([k, b]): [Key, { type: SearchType; id: string }] => [k, { type: b.type, id: b.id }])));

  const people = new Set(meta.values()).size ? [...meta.values()].flatMap((m) => m.people) : [];
  const names = await namesOf(people);
  const words = q.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
  const hits: SearchHit[] = [];
  for (const [k, b] of kept) {
    const m = meta.get(k);
    if (!m) continue;
    if (filters.types?.length && !filters.types.includes(b.type)) continue;
    if (filters.tags?.length && !filters.tags.some((t) => m.tags.includes(t))) continue;
    if (filters.member && !m.people.includes(filters.member)) continue;
    const src = b.lexRow ?? b.row;
    const sn = snippetOf(src.content, b.lexRow ? q : null);
    const titleHit = words.length > 0 && words.every((w) => m.title.toLowerCase().includes(w));
    hits.push({
      type: b.type, id: b.id, title: m.title, link: m.link, snippet: sn.text, hit: sn.hit, tags: m.tags,
      people: [...new Set(m.people)].slice(0, 4).map((id): SearchPerson => ({ id, name: names.get(id) ?? 'Someone' })),
      score: b.sim + (b.lex ? 0.4 : 0) + (titleHit ? 0.15 : 0),
      via: b.lex && b.sim >= FLOOR ? 'both' : b.lex ? 'text' : 'meaning',
    });
  }
  hits.sort((a, b) => b.score - a.score);
  return { hits: hits.slice(0, limit), lexicalOnly: vec === null, pending: 0 };
}

/**
 * Things that read like this one: documents like this document, calls about what this call was about. Seen only if
 * the person may see the thing they started from and each thing found.
 */
export async function similarSources(asker: Asker, type: SearchType, id: string, filters: SearchFilters = {}, limit = 8): Promise<SearchHit[]> {
  const seedKey: Key = `${type}:${id}`;
  const seed = await metaFor(asker, new Map<Key, { type: SearchType; id: string }>([[seedKey, { type, id }]]));
  if (!seed.has(seedKey)) throw new Error('That does not exist, or you cannot open it.');
  const { data, error } = await looseAdmin().rpc('mjengo_similar', { st: type, sid: id, n: 120 });
  if (error) throw new Error('Similar things are not available right now.');
  const best = new Map<Key, { type: SearchType; id: string; sim: number; content: string }>();
  for (const r of (data ?? []) as { source_type: SearchType; source_id: string; content: string; sim: number }[]) {
    const k: Key = `${r.source_type}:${r.source_id}`;
    const cur = best.get(k);
    if (!cur || r.sim > cur.sim) best.set(k, { type: r.source_type, id: r.source_id, sim: r.sim, content: r.content });
  }
  const top = Math.max(0, ...[...best.values()].map((b) => b.sim));
  const kept = new Map([...best.entries()].filter(([, b]) => b.sim >= 0.5 && b.sim >= top - 0.15));
  const meta = await metaFor(asker, new Map([...kept.entries()].map(([k, b]): [Key, { type: SearchType; id: string }] => [k, { type: b.type, id: b.id }])));
  const names = await namesOf([...meta.values()].flatMap((m) => m.people));
  const hits: SearchHit[] = [];
  for (const [k, b] of kept) {
    const m = meta.get(k);
    if (!m) continue;
    if (filters.types?.length && !filters.types.includes(b.type)) continue;
    if (filters.tags?.length && !filters.tags.some((t) => m.tags.includes(t))) continue;
    if (filters.member && !m.people.includes(filters.member)) continue;
    hits.push({ type: b.type, id: b.id, title: m.title, link: m.link, snippet: snippetOf(b.content, null).text, hit: null, tags: m.tags, people: [...new Set(m.people)].slice(0, 4).map((pid) => ({ id: pid, name: names.get(pid) ?? 'Someone' })), score: b.sim, via: 'meaning' });
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, limit);
}
