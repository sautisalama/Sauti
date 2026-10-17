'use server';

import { guard } from '@/lib/action-result';
import { looseAdmin } from '@/lib/loose-db';
import { requireAdminActor } from '@/lib/access/super-admin';
import { requireModule, type ModuleKey } from '@/lib/access/permissions';
import { atLeast, levelFor, loadIndex, oversightFor } from '@/lib/vault/access';
import { askAi } from '@/lib/mjengo/ai';
import { ENTITY_KINDS, entitiesFor, type EntityKind } from '@/lib/mjengo/entity-view';
import { timelineFor, type Timeline } from '@/lib/mjengo/timeline';

const MODULE_OF: Record<EntityKind, ModuleKey> = { grant: 'grants', opportunity: 'opportunities', project: 'projects', fellowship: 'fellowships' };
const kindOk = (k: string): k is EntityKind => (ENTITY_KINDS as string[]).includes(k);
export type LinkItemType = 'meeting' | 'file' | 'event';
export interface Linkable { type: LinkItemType; id: string; title: string; hint: string; linked: boolean }

const me = async () => { const a = await requireAdminActor(); return { id: a.id, email: a.email }; };

/** The story of one record: everything about it in order, with what is still coming on top. */
async function getTimeline_(kind: EntityKind, id: string): Promise<Timeline> {
  if (!kindOk(kind)) throw new Error('Unknown kind of record.');
  return timelineFor(await me(), kind, id);
}

/** Calls, files and events that could be linked to this record, newest first, narrowed by what is typed. */
async function linkables_(kind: EntityKind, id: string, query: string): Promise<Linkable[]> {
  if (!kindOk(kind)) throw new Error('Unknown kind of record.');
  const asker = await me();
  const q = query.trim().toLowerCase().slice(0, 80);
  const db = looseAdmin();
  const { data: have } = await db.from('mjengo_links').select('item_type, item_id').eq('entity_type', kind).eq('entity_id', id);
  const linked = new Set(((have ?? []) as { item_type: string; item_id: string }[]).map((l) => `${l.item_type}:${l.item_id}`));
  const out: Linkable[] = [];

  const [{ data: meetings }, { data: events }, ix, oversight] = await Promise.all([
    db.from('mjengo_meetings').select('code, title, created_at').order('created_at', { ascending: false }).limit(60),
    db.from('mjengo_events').select('id, title, starts_at').order('starts_at', { ascending: false }).limit(60),
    loadIndex(),
    oversightFor(asker.email),
  ]);
  for (const m of (meetings ?? []) as { code: string; title: string | null; created_at: string }[]) {
    const title = m.title || 'Untitled call';
    if (!q || title.toLowerCase().includes(q)) out.push({ type: 'meeting', id: m.code, title, hint: `Call, ${m.created_at.slice(0, 10)}`, linked: linked.has(`meeting:${m.code}`) });
  }
  for (const e of (events ?? []) as { id: string; title: string; starts_at: string }[]) {
    if (!q || e.title.toLowerCase().includes(q)) out.push({ type: 'event', id: e.id, title: e.title, hint: `Event, ${e.starts_at.slice(0, 10)}`, linked: linked.has(`event:${e.id}`) });
  }
  for (const f of [...ix.files.values()].sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''))) {
    if (q && !f.name.toLowerCase().includes(q)) continue;
    if (!atLeast(levelFor(ix, asker.id, 'file', f.id, oversight), 'view')) continue;
    out.push({ type: 'file', id: f.id, title: f.name, hint: 'File', linked: linked.has(`file:${f.id}`) });
  }
  return out.slice(0, 40);
}

async function mayLink(kind: EntityKind, id: string) {
  const a = await requireModule(MODULE_OF[kind], 'write');
  const seen = (await entitiesFor({ id: a.id, email: a.email }, [kind])).some((e) => e.id === id);
  if (!seen) throw new Error('That does not exist, or it is private to someone else.');
  return a;
}

/** Put a call, file or event on a record's timeline. */
async function linkItem_(kind: EntityKind, id: string, type: LinkItemType, itemId: string): Promise<void> {
  if (!kindOk(kind) || !['meeting', 'file', 'event'].includes(type)) throw new Error('That cannot be linked.');
  const a = await mayLink(kind, id);
  if (type === 'file') {
    const [ix, oversight] = await Promise.all([loadIndex(), oversightFor(a.email)]);
    if (!ix.files.get(itemId) || !atLeast(levelFor(ix, a.id, 'file', itemId, oversight), 'view')) throw new Error('You do not have access to that file.');
  }
  const { error } = await looseAdmin().from('mjengo_links').upsert({ entity_type: kind, entity_id: id, item_type: type, item_id: itemId.slice(0, 80), auto: false, created_by: a.id }, { onConflict: 'entity_type,entity_id,item_type,item_id' });
  if (error) throw new Error('Could not link it.');
}

/** Take something off a record's timeline (it is not deleted, only unlinked). */
async function unlinkItem_(kind: EntityKind, id: string, type: LinkItemType, itemId: string): Promise<void> {
  if (!kindOk(kind)) throw new Error('Unknown kind of record.');
  await mayLink(kind, id);
  await looseAdmin().from('mjengo_links').delete().eq('entity_type', kind).eq('entity_id', id).eq('item_type', type).eq('item_id', itemId);
}

/** A short read of where this record stands, what comes next and what looks stuck, written from its timeline only. */
async function briefTimeline_(kind: EntityKind, id: string): Promise<string> {
  if (!kindOk(kind)) throw new Error('Unknown kind of record.');
  const t = await timelineFor(await me(), kind, id);
  const line = (i: (typeof t.items)[number]) => `- ${i.at.slice(0, 10)} ${i.upcoming ? '(coming)' : ''} ${i.title}${i.detail ? `: ${i.detail}` : ''}${i.who ? ` [${i.who}]` : ''}`;
  return askAi(
    'You are Salama, a member of the team at Sauti Salama. From the timeline given, write a brief for a colleague who is catching up. Use exactly these bold headings in Markdown: **Where it stands** (two or three sentences), **Next** (bullets: dates and things coming), **Watch** (bullets: anything overdue, missing or quiet for a long time; write "Nothing stands out." if none). Use only what is on the timeline. Never invent names, dates or numbers. Under 140 words.',
    `${t.title} (${kind}). Today is ${new Date().toISOString().slice(0, 10)}.\n\nTimeline, newest and upcoming first:\n${t.items.slice(0, 60).map(line).join('\n')}`,
    600,
    { temperature: 0.2 },
  );
}

export const getTimeline = guard(getTimeline_);
export const linkables = guard(linkables_);
export const linkItem = guard(linkItem_);
export const unlinkItem = guard(unlinkItem_);
export const briefTimeline = guard(briefTimeline_);
