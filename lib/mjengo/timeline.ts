import { looseAdmin } from '@/lib/loose-db';
import { may, permissionsFor, type ModuleKey } from '@/lib/access/permissions';
import { atLeast, levelFor, loadIndex, oversightFor } from '@/lib/vault/access';
import { ENTITY_HREF, entitiesFor, type EntityKind } from '@/lib/mjengo/entity-view';
import { fileLink } from '@/lib/mjengo/links';

export type TimelineKind = 'added' | 'status' | 'change' | 'document' | 'requirement' | 'todo' | 'done' | 'call' | 'file' | 'event' | 'date';
export interface TimelineItem {
  id: string;
  /** ISO time: when it happened, or when it is due. */
  at: string;
  kind: TimelineKind;
  title: string;
  detail?: string;
  link?: string | null;
  who?: string | null;
  /** In the future: a deadline, a meeting still to come. */
  upcoming: boolean;
  /** Found by the system rather than linked by a person. */
  auto?: boolean;
  /** A call, file or event linked here, so it can be unlinked. */
  ref?: { type: 'meeting' | 'file' | 'event'; id: string };
}
export interface Timeline { kind: EntityKind; id: string; title: string; items: TimelineItem[] }

const MODULE_OF: Record<EntityKind, ModuleKey> = { grant: 'grants', opportunity: 'opportunities', project: 'projects', fellowship: 'fellowships' };
/** The dates a record carries that matter to its story. */
const DATE_FIELDS: Record<EntityKind, [string, string][]> = {
  grant: [['deadline', 'Deadline'], ['decision_date', 'Decision expected']],
  opportunity: [['deadline', 'Deadline']],
  project: [['start_date', 'Starts'], ['end_date', 'Ends']],
  fellowship: [['start_date', 'Starts'], ['deadline', 'Deadline']],
};
const STATUS_WORDS = (v: unknown) => String(v ?? '').replace(/_/g, ' ');
const firstLines = (t: string | null, n = 220) => (t ?? '').replace(/[*#>`]/g, '').replace(/\s+/g, ' ').trim().slice(0, n);

/**
 * Everything about one grant, opportunity, project or fellowship in the order it happened, with what is still coming
 * on top. It gathers the record's own history, its documents and requirements, its to-dos, the calls, files and
 * events linked to it, and who did what. The asker only sees what they may: the record must be visible to them, and
 * linked files follow the vault's own access.
 */
export async function timelineFor(asker: { id: string; email: string }, kind: EntityKind, id: string): Promise<Timeline> {
  const perms = await permissionsFor(asker.id, asker.email);
  if (!may(perms, MODULE_OF[kind])) throw new Error('You do not have access to this part of the suite.');
  const entity = (await entitiesFor(asker, [kind])).find((e) => e.id === id);
  if (!entity) throw new Error('That does not exist, or it is private to someone else.');
  const db = looseAdmin();
  const now = Date.now();
  const items: TimelineItem[] = [];
  const add = (i: Omit<TimelineItem, 'upcoming'> & { upcoming?: boolean }) => items.push({ ...i, upcoming: i.upcoming ?? new Date(i.at).getTime() > now });
  const row = entity.row;

  add({ id: 'added', at: String(row.created_at), kind: 'added', title: `${entity.title} was added`, link: ENTITY_HREF[kind] });
  for (const [field, label] of DATE_FIELDS[kind]) {
    const v = row[field];
    if (typeof v === 'string' && v) add({ id: `date-${field}`, at: `${v.slice(0, 10)}T09:00:00.000Z`, kind: 'date', title: label, link: ENTITY_HREF[kind] });
  }

  const [{ data: audit }, { data: docs }, { data: todos }, { data: links }] = await Promise.all([
    db.from('audit_logs').select('id, actor_id, action, details, created_at').eq('target_type', kind).eq('target_id', id).order('created_at', { ascending: false }).limit(60),
    db.from('mjengo_documents').select('id, name, required, due_date, file_name, uploaded_by, uploaded_at, created_at').eq('entity_type', kind).eq('entity_id', id),
    db.from('mjengo_todos').select('id, title, status, due_date, created_at, completed_at, created_by').eq('entity_type', kind).eq('entity_id', id).limit(80),
    db.from('mjengo_links').select('item_type, item_id, auto, created_at').eq('entity_type', kind).eq('entity_id', id),
  ]);

  const whoIds = new Set<string>();
  for (const a of (audit ?? []) as { actor_id: string | null }[]) if (a.actor_id) whoIds.add(a.actor_id);
  for (const d of (docs ?? []) as { uploaded_by: string | null }[]) if (d.uploaded_by) whoIds.add(d.uploaded_by);
  for (const t of (todos ?? []) as { created_by: string | null }[]) if (t.created_by) whoIds.add(t.created_by);
  const { data: profs } = whoIds.size ? await db.from('profiles').select('id, first_name, last_name, email').in('id', [...whoIds]) : { data: [] };
  const names = new Map(((profs ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string | null }[]).map((p) => [p.id, [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Someone']));
  const who = (uid: string | null | undefined) => (uid ? names.get(uid) ?? null : null);

  for (const a of (audit ?? []) as { id: string; actor_id: string | null; action: string; details: { from?: string; to?: string } | null; created_at: string }[]) {
    const act = a.action.replace(/^mjengo\./, '');
    if (act.endsWith('.status_changed')) add({ id: `a-${a.id}`, at: a.created_at, kind: 'status', title: `Status: ${STATUS_WORDS(a.details?.from)} → ${STATUS_WORDS(a.details?.to)}`, who: who(a.actor_id) });
    else if (act.endsWith('.updated')) add({ id: `a-${a.id}`, at: a.created_at, kind: 'change', title: 'Details were updated', who: who(a.actor_id) });
  }

  for (const d of (docs ?? []) as { id: string; name: string; required: boolean; due_date: string | null; file_name: string | null; uploaded_by: string | null; uploaded_at: string | null; created_at: string }[]) {
    if (d.uploaded_at) add({ id: `d-${d.id}`, at: d.uploaded_at, kind: 'document', title: `${d.name} was uploaded`, detail: d.file_name ?? undefined, who: who(d.uploaded_by), link: ENTITY_HREF[kind] });
    else if (d.required) add({ id: `r-${d.id}`, at: d.due_date ? `${d.due_date}T09:00:00.000Z` : d.created_at, kind: 'requirement', title: `${d.name} is still needed`, detail: d.due_date ? `Due ${d.due_date}` : undefined, link: ENTITY_HREF[kind], upcoming: d.due_date ? new Date(d.due_date).getTime() > now : false });
  }

  for (const t of (todos ?? []) as { id: string; title: string; status: string; due_date: string | null; created_at: string; completed_at: string | null; created_by: string | null }[]) {
    if (t.status === 'done' && t.completed_at) add({ id: `td-${t.id}`, at: t.completed_at, kind: 'done', title: `Done: ${t.title}`, link: '/dashboard/mjengo/todos' });
    else add({ id: `t-${t.id}`, at: t.due_date ? `${t.due_date}T17:00:00.000Z` : t.created_at, kind: 'todo', title: t.title, detail: t.due_date ? `To do, due ${t.due_date}` : 'To do', who: who(t.created_by), link: '/dashboard/mjengo/todos', upcoming: t.due_date ? new Date(t.due_date).getTime() > now : false });
  }

  const byType = (type: string) => ((links ?? []) as { item_type: string; item_id: string; auto: boolean; created_at: string }[]).filter((l) => l.item_type === type);

  if (may(perms, 'meet')) {
    const m = byType('meeting');
    if (m.length) {
      const { data } = await db.from('mjengo_meetings').select('code, title, notes, created_at').in('code', m.map((l) => l.item_id));
      for (const c of (data ?? []) as { code: string; title: string | null; notes: string | null; created_at: string }[]) {
        const summary = /\*\*Summary\*\*\s*([\s\S]*?)(\n\s*\*\*|$)/.exec(c.notes ?? '')?.[1] ?? c.notes;
        add({ id: `m-${c.code}`, at: c.created_at, kind: 'call', title: `Call: ${c.title || 'Untitled'}`, detail: firstLines(summary) || undefined, link: `/dashboard/mjengo/meetings?code=${c.code}`, ref: { type: 'meeting', id: c.code }, auto: m.find((l) => l.item_id === c.code)?.auto });
      }
    }
  }
  if (may(perms, 'files')) {
    const f = byType('file');
    if (f.length) {
      const [ix, oversight] = await Promise.all([loadIndex(), oversightFor(asker.email)]);
      for (const l of f) {
        const file = ix.files.get(l.item_id);
        if (!file || !atLeast(levelFor(ix, asker.id, 'file', file.id, oversight), 'view')) continue;
        add({ id: `f-${file.id}`, at: file.updated_at ?? file.created_at ?? l.created_at, kind: 'file', title: file.name, detail: 'File linked here', ref: { type: 'file', id: file.id }, link: fileLink(file.name, file.id), auto: l.auto });
      }
    }
  }
  if (may(perms, 'calendar')) {
    const e = byType('event');
    if (e.length) {
      const { data } = await db.from('mjengo_events').select('id, title, starts_at').in('id', e.map((l) => l.item_id));
      for (const ev of (data ?? []) as { id: string; title: string; starts_at: string }[]) add({ id: `e-${ev.id}`, at: ev.starts_at, kind: 'event', title: ev.title, ref: { type: 'event', id: ev.id }, link: '/dashboard/mjengo/calendar' });
    }
  }

  // Upcoming first (soonest on top), then what happened (latest on top).
  const upcoming = items.filter((i) => i.upcoming).sort((a, b) => a.at.localeCompare(b.at));
  const past = items.filter((i) => !i.upcoming).sort((a, b) => b.at.localeCompare(a.at));
  return { kind, id, title: entity.title, items: [...upcoming, ...past] };
}

/** Words a call, file or event might use for a record: its title, at least four characters. */
export function nameVariants(title: string): string[] {
  const t = title.trim();
  return t.length >= 4 ? [t] : [];
}

/**
 * The records a call speaks about: those whose title appears (as a whole phrase) in the call's title, notes or
 * transcript. Used to link calls to their grants, projects and so on without anyone filing them.
 */
export function recordsMentioned(text: string, records: { kind: EntityKind; id: string; title: string }[]): { kind: EntityKind; id: string }[] {
  const hay = ` ${text.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
  return records
    .filter((r) => nameVariants(r.title).some((v) => hay.includes(` ${v.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `)))
    .map(({ kind, id }) => ({ kind, id }));
}
