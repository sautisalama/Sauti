'use server';

import { after } from 'next/server';
import { guard } from '@/lib/action-result';
import { looseAdmin } from '@/lib/loose-db';
import { requireAdminActor } from '@/lib/access/super-admin';
import { requireModule, type ModuleKey } from '@/lib/access/permissions';
import { atLeast, levelFor, loadIndex, oversightFor } from '@/lib/vault/access';
import { autoTag, cleanTags, tagVocabulary } from '@/lib/mjengo/autotag';
import { ENTITY_TABLE, entitiesFor, type EntityKind } from '@/lib/mjengo/entity-view';
import { indexSource, syncIndex } from '@/lib/mjengo/search-index';
import { searchWorkspace, similarSources } from '@/lib/mjengo/search';
import type { SearchFilters, SearchHit, SearchResult, SearchType } from '@/lib/mjengo/search-shared';

const me = async () => { const a = await requireAdminActor(); return { id: a.id, email: a.email }; };
const TYPES: SearchType[] = ['file', 'meeting', 'todo', 'event', 'grant', 'opportunity', 'project', 'fellowship'];
const clean = (f: SearchFilters = {}): SearchFilters => ({
  types: (f.types ?? []).filter((t) => TYPES.includes(t)),
  tags: cleanTags(f.tags ?? [], 12),
  member: typeof f.member === 'string' && /^[0-9a-f-]{36}$/i.test(f.member) ? f.member : null,
});

/** Search what the team has written, by meaning or by any fragment of text. Brings the index up to date behind it. */
async function searchAll_(query: string, filters: SearchFilters = {}): Promise<SearchResult> {
  const asker = await me();
  const result = await searchWorkspace(asker, query, clean(filters));
  const { pending } = await syncIndex(0).catch(() => ({ pending: 0 }));
  if (pending > 0) after(() => syncIndex(20).then(() => undefined).catch(() => undefined));
  return { ...result, pending };
}

/** Things that read like this one. */
async function similarTo_(type: SearchType, id: string, filters: SearchFilters = {}): Promise<SearchHit[]> {
  if (!TYPES.includes(type)) throw new Error('Unknown kind of item.');
  return similarSources(await me(), type, id, clean(filters));
}

export interface Facets { tags: { tag: string; count: number }[]; members: { id: string; name: string; avatar: string | null }[] }

/** The tags in use and the team, for the filter bars everywhere. */
async function facets_(): Promise<Facets> {
  await me();
  const [tags, { data }] = await Promise.all([
    tagVocabulary(120),
    looseAdmin().from('profiles').select('id, first_name, last_name, email, avatar_url').eq('is_admin', true).order('first_name'),
  ]);
  return {
    tags,
    members: ((data ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string | null; avatar_url: string | null }[]).map((p) => ({ id: p.id, name: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Admin', avatar: p.avatar_url })),
  };
}

const MODULE_OF: Record<SearchType, ModuleKey> = { file: 'files', meeting: 'meet', todo: 'todos', event: 'calendar', grant: 'grants', opportunity: 'opportunities', project: 'projects', fellowship: 'fellowships' };

/** Where an item's tags live, after checking this person may change it. */
async function tagTarget(type: SearchType, id: string): Promise<{ table: string; key: string; value: string }> {
  if (!TYPES.includes(type)) throw new Error('Unknown kind of item.');
  const actor = await requireModule(MODULE_OF[type], 'write');
  if (type === 'file') {
    const [ix, oversight] = await Promise.all([loadIndex(), oversightFor(actor.email)]);
    if (!ix.files.get(id) || !atLeast(levelFor(ix, actor.id, 'file', id, oversight), 'edit')) throw new Error('You can only tag files you can edit.');
    return { table: 'vault_files', key: 'id', value: id };
  }
  if (type === 'meeting') return { table: 'mjengo_meetings', key: 'code', value: id };
  if (type === 'todo') return { table: 'mjengo_todos', key: 'id', value: id };
  if (type === 'event') return { table: 'mjengo_events', key: 'id', value: id };
  const seen = (await entitiesFor({ id: actor.id, email: actor.email }, [type as EntityKind])).some((e) => e.id === id);
  if (!seen) throw new Error('That does not exist, or it is private to someone else.');
  return { table: ENTITY_TABLE[type as EntityKind], key: 'id', value: id };
}

/** A person's own tags for something. They replace what was there; the autotagger will not overwrite them. */
async function setTags_(type: SearchType, id: string, tags: string[]): Promise<string[]> {
  const t = await tagTarget(type, id);
  const next = cleanTags(tags, 12);
  const { error } = await looseAdmin().from(t.table).update({ tags: next }).eq(t.key, t.value);
  if (error) throw new Error('Could not save the tags.');
  after(() => indexSource(type, id).then(() => undefined).catch(() => undefined));
  return next;
}

/** Let the autotagger read the item again and suggest tags (they are kept, added to what is there). */
async function autoTagItem_(type: SearchType, id: string): Promise<string[]> {
  const t = await tagTarget(type, id);
  const db = looseAdmin();
  const { data: row } = await db.from(t.table).select('*').eq(t.key, t.value).maybeSingle();
  if (!row) throw new Error('That no longer exists.');
  const r = row as Record<string, unknown>;
  const title = String(r.title ?? r.name ?? r.code ?? 'Untitled');
  const text = type === 'file' ? `${title}` : [r.description, r.notes, r.location].filter((x) => typeof x === 'string').join('. ');
  let body = text;
  if (type === 'file') {
    const { extractText } = await import('@/lib/mjengo/files-text');
    body = await extractText(String(r.storage_path), title, (r.mime as string | null) ?? null, 8000).catch(() => '');
  }
  const found = await autoTag({ title, text: body, kind: type });
  const merged = cleanTags([...(r.tags as string[] | null ?? []), ...found], 12);
  await db.from(t.table).update({ tags: merged }).eq(t.key, t.value);
  after(() => indexSource(type, id).then(() => undefined).catch(() => undefined));
  return merged;
}

export const searchAll = guard(searchAll_);
export const similarTo = guard(similarTo_);
export const facets = guard(facets_);
export const setTags = guard(setTags_);
export const autoTagItem = guard(autoTagItem_);
