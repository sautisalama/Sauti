import { createHash } from 'node:crypto';
import { looseAdmin } from '@/lib/loose-db';
import { embed, toVector } from '@/lib/mjengo/embeddings';
import { extractText } from '@/lib/mjengo/files-text';
import { autoTag, tagVocabulary } from '@/lib/mjengo/autotag';
import { fileLink } from '@/lib/mjengo/links';
import { ENTITY_HREF, ENTITY_LABEL_FIELD, ENTITY_TABLE, type EntityKind } from '@/lib/mjengo/entity-view';

export type SourceType = 'file' | 'meeting' | 'todo' | 'event' | EntityKind;
export const SOURCE_TYPES: SourceType[] = ['file', 'meeting', 'todo', 'event', 'grant', 'opportunity', 'project', 'fellowship'];

/** The text of a document cut into passages that overlap a little, so a sentence at a seam is still found whole. */
export function chunkText(text: string, size = 900, overlap = 150): string[] {
  const clean = text.replace(/\r/g, '').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
  if (!clean) return [];
  if (clean.length <= size) return [clean];
  const out: string[] = [];
  let i = 0;
  while (i < clean.length) {
    let end = Math.min(clean.length, i + size);
    if (end < clean.length) {
      // end at a paragraph or sentence break when there is one near the end of the window
      const win = clean.slice(i + Math.floor(size * 0.6), end);
      const cut = Math.max(win.lastIndexOf('\n'), win.lastIndexOf('. '), win.lastIndexOf('? '), win.lastIndexOf('! '));
      if (cut > 0) end = i + Math.floor(size * 0.6) + cut + 1;
    }
    out.push(clean.slice(i, end).trim());
    if (end >= clean.length) break;
    i = Math.max(end - overlap, i + 1);
  }
  return out.filter(Boolean);
}

const sha = (s: string) => createHash('sha1').update(s).digest('hex');

interface Doc { type: SourceType; id: string; title: string; text: string; link: string; stamp: string; tags: string[]; tagTable: string | null; tagKey: string; tagMatch: string }

/** What each kind of thing is cheaply stamped by, so only what changed is read in full. */
async function stamps(): Promise<Map<string, { type: SourceType; id: string; title: string; stamp: string }>> {
  const db = looseAdmin();
  const out = new Map<string, { type: SourceType; id: string; title: string; stamp: string }>();
  const put = (type: SourceType, id: string, title: string, stamp: string) => out.set(`${type}:${id}`, { type, id, title, stamp: sha(`${type}|${id}|${title}|${stamp}`) });
  const [files, meets, todos, events, ...ents] = await Promise.all([
    db.from('vault_files').select('id, name, size, updated_at'),
    db.from('mjengo_meetings').select('code, title, notes, ended_at, notes_shared_at, created_at').order('created_at', { ascending: false }).limit(400),
    db.from('mjengo_todos').select('id, title, updated_at'),
    db.from('mjengo_events').select('id, title, description, starts_at'),
    ...(['grant', 'opportunity', 'project', 'fellowship'] as EntityKind[]).map((k) => db.from(ENTITY_TABLE[k]).select(`id, ${ENTITY_LABEL_FIELD[k]}, updated_at`)),
  ]);
  for (const f of (files.data ?? []) as { id: string; name: string; size: number; updated_at: string }[]) put('file', f.id, f.name, `${f.size}|${f.updated_at}`);
  for (const m of (meets.data ?? []) as { code: string; title: string | null; notes: string | null; ended_at: string | null; notes_shared_at: string | null }[]) put('meeting', m.code, m.title || 'Call', `${m.ended_at}|${m.notes_shared_at}|${(m.notes ?? '').length}`);
  for (const t of (todos.data ?? []) as { id: string; title: string; updated_at: string }[]) put('todo', t.id, t.title, t.updated_at);
  for (const e of (events.data ?? []) as { id: string; title: string; description: string | null; starts_at: string }[]) put('event', e.id, e.title, `${e.starts_at}|${(e.description ?? '').length}`);
  (['grant', 'opportunity', 'project', 'fellowship'] as EntityKind[]).forEach((k, i) => {
    for (const r of (ents[i].data ?? []) as unknown as Record<string, unknown>[]) put(k, String(r.id), String(r[ENTITY_LABEL_FIELD[k]] ?? ''), String(r.updated_at ?? ''));
  });
  return out;
}

/** Read one thing in full, as the text that gets indexed. Details their owner hides are left out of the index. */
async function readDoc(type: SourceType, id: string): Promise<Doc | null> {
  const db = looseAdmin();
  if (type === 'file') {
    const { data: f } = await db.from('vault_files').select('id, name, storage_path, mime, tags').eq('id', id).maybeSingle();
    if (!f) return null;
    const text = await extractText(f.storage_path, f.name, f.mime, 60_000).catch(() => '');
    return { type, id, title: f.name, text: `${f.name}\n${text}`, link: fileLink(f.name, f.id), stamp: '', tags: f.tags ?? [], tagTable: 'vault_files', tagKey: 'id', tagMatch: f.id };
  }
  if (type === 'meeting') {
    const { data: m } = await db.from('mjengo_meetings').select('code, title, notes, transcript, tags').eq('code', id).maybeSingle();
    if (!m) return null;
    const said = (Array.isArray(m.transcript) ? m.transcript : []).map((l: { name: string; text: string }) => `${l.name}: ${l.text}`).join('\n');
    return { type, id, title: m.title || 'Call', text: `${m.title ?? ''}\n${m.notes ?? ''}\n${said}`, link: `/dashboard/mjengo/meetings?code=${m.code}`, stamp: '', tags: m.tags ?? [], tagTable: 'mjengo_meetings', tagKey: 'code', tagMatch: m.code };
  }
  if (type === 'todo') {
    const { data: t } = await db.from('mjengo_todos').select('id, title, notes, status, due_date, steps, tags').eq('id', id).maybeSingle();
    if (!t) return null;
    const steps = (Array.isArray(t.steps) ? t.steps : []).map((s: { title?: string }) => s.title ?? '').join('. ');
    return { type, id, title: t.title, text: `${t.title}. Status ${t.status}${t.due_date ? `, due ${t.due_date}` : ''}. ${t.notes ?? ''} ${steps}`, link: '/dashboard/mjengo/todos', stamp: '', tags: t.tags ?? [], tagTable: 'mjengo_todos', tagKey: 'id', tagMatch: t.id };
  }
  if (type === 'event') {
    const { data: e } = await db.from('mjengo_events').select('id, title, description, location, starts_at, tags').eq('id', id).maybeSingle();
    if (!e) return null;
    return { type, id, title: e.title, text: `${e.title} on ${String(e.starts_at).slice(0, 16).replace('T', ' ')}${e.location ? ` at ${e.location}` : ''}. ${e.description ?? ''}`, link: '/dashboard/mjengo/calendar', stamp: '', tags: e.tags ?? [], tagTable: 'mjengo_events', tagKey: 'id', tagMatch: e.id };
  }
  const kind = type as EntityKind;
  const { data: r } = await db.from(ENTITY_TABLE[kind]).select('*').eq('id', id).maybeSingle();
  if (!r) return null;
  const hidden = new Set<string>((r.hidden_fields as string[] | null) ?? []);
  const SKIP = new Set(['id', 'created_by', 'created_at', 'updated_at', 'visibility', 'hidden_fields', 'owner_id', 'lead_id', 'grant_id', 'tags']);
  const body = Object.entries(r as Record<string, unknown>).filter(([k, v]) => !SKIP.has(k) && !hidden.has(k) && v != null && v !== '' && typeof v !== 'object').map(([k, v]) => `${k.replace(/_/g, ' ')}: ${String(v)}`).join('. ');
  const title = String((r as Record<string, unknown>)[ENTITY_LABEL_FIELD[kind]] ?? '');
  return { type, id, title, text: `${title}. ${body}`, link: ENTITY_HREF[kind], stamp: '', tags: (r.tags as string[] | null) ?? [], tagTable: ENTITY_TABLE[kind], tagKey: 'id', tagMatch: String(r.id) };
}

/**
 * Index one thing now: cut its text into passages, give each a meaning vector, and (when it has no tags yet) tag it.
 * Replaces what was indexed before. Returns the tags the thing ended up with.
 */
export async function indexSource(type: SourceType, id: string, stamp?: string, vocabulary?: string[]): Promise<{ indexed: boolean; tags: string[] }> {
  const db = looseAdmin();
  const doc = await readDoc(type, id);
  if (!doc) {
    await db.from('mjengo_search_chunks').delete().eq('source_type', type).eq('source_id', id);
    await db.from('mjengo_search_sources').delete().eq('source_type', type).eq('source_id', id);
    return { indexed: false, tags: [] };
  }
  let tags = doc.tags;
  if (!tags.length && doc.tagTable && (doc.text.length > 40 || doc.title.length > 3)) {
    tags = await autoTag({ title: doc.title, text: doc.text, kind: type, vocabulary }).catch(() => []);
    if (tags.length) await db.from(doc.tagTable).update({ tags }).eq(doc.tagKey, doc.tagMatch);
  }
  // The title and the tags are part of what a search can find, so they are in the first passage.
  const chunks = chunkText(doc.text).slice(0, 80);
  if (!chunks.length) chunks.push(doc.title);
  chunks[0] = `${doc.title}${tags.length ? ` [${tags.join(', ')}]` : ''}\n${chunks[0]}`.slice(0, 1400);
  const vectors = await embed(chunks);
  await db.from('mjengo_search_chunks').delete().eq('source_type', type).eq('source_id', id);
  const rows = chunks.map((content, i) => ({ source_type: type, source_id: id, chunk_index: i, title: doc.title, content, link: doc.link, embedding: toVector(vectors[i]) }));
  for (let i = 0; i < rows.length; i += 40) {
    const { error } = await db.from('mjengo_search_chunks').insert(rows.slice(i, i + 40));
    if (error) throw new Error('Could not save the search index.');
  }
  await db.from('mjengo_search_sources').upsert({ source_type: type, source_id: id, title: doc.title, hash: stamp ?? sha(doc.text), indexed_at: new Date().toISOString() }, { onConflict: 'source_type,source_id' });
  return { indexed: true, tags };
}

/**
 * Bring the index up to date: index what is new or changed (at most `limit` things per run, oldest first), and
 * forget what no longer exists. Cheap when nothing changed.
 */
export async function syncIndex(limit = 12): Promise<{ indexed: number; removed: number; pending: number }> {
  const db = looseAdmin();
  const [now, { data: known }] = await Promise.all([stamps(), db.from('mjengo_search_sources').select('source_type, source_id, hash')]);
  const have = new Map(((known ?? []) as { source_type: string; source_id: string; hash: string }[]).map((k) => [`${k.source_type}:${k.source_id}`, k.hash]));
  const stale = [...now.entries()].filter(([k, v]) => have.get(k) !== v.stamp).map(([, v]) => v);
  const gone = [...have.keys()].filter((k) => !now.has(k));
  for (const k of gone) { const [t, ...rest] = k.split(':'); await indexSource(t as SourceType, rest.join(':')).catch(() => undefined); }
  let indexed = 0;
  if (stale.length) {
    const vocabulary = (await tagVocabulary(60)).map((v) => v.tag);
    for (const s of stale.slice(0, limit)) {
      try { await indexSource(s.type, s.id, s.stamp, vocabulary); indexed += 1; } catch { /* the next run tries again */ }
    }
  }
  return { indexed, removed: gone.length, pending: Math.max(0, stale.length - indexed) };
}
