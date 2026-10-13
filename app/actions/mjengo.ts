'use server';

import { revalidatePath } from 'next/cache';
import { looseAdmin } from '@/lib/loose-db';
import { logAudit } from '@/lib/access/audit';
import { isSuperAdminEmail, requireAdminActor, type Actor } from '@/lib/access/super-admin';
import { requireModule, type ModuleKey } from '@/lib/access/permissions';
import { sendAccessEmail, sendNoticeEmail } from '@/lib/mjengo/invite-email';

export type Kind = 'grant' | 'opportunity' | 'project' | 'fellowship';

const TABLE: Record<Kind, string> = { grant: 'mjengo_grants', opportunity: 'mjengo_opportunities', project: 'mjengo_projects', fellowship: 'mjengo_fellowships' };
const LABEL_FIELD: Record<Kind, string> = { grant: 'title', opportunity: 'title', project: 'name', fellowship: 'title' };
const MODULE_OF: Record<Kind, ModuleKey> = { grant: 'grants', opportunity: 'opportunities', project: 'projects', fellowship: 'fellowships' };

type Field = { key: string; type: 'text' | 'number' | 'date' | 'enum' | 'uuid' | 'int' | 'tags' | 'sdgs'; options?: string[] };
/** What a fund covers; read from its link and kept on grants, opportunities and fellowships. */
const COVERS: Field[] = [{ key: 'sectors', type: 'tags' }, { key: 'themes', type: 'tags' }, { key: 'sdgs', type: 'sdgs' }, { key: 'regions', type: 'tags' }, { key: 'eligibility', type: 'text' }];
const CURRENCIES = ['USD', 'KES', 'EUR', 'GBP'];
const FIELDS: Record<Kind, Field[]> = {
  grant: [
    { key: 'title', type: 'text' },
    { key: 'funder', type: 'text' },
    { key: 'status', type: 'enum', options: ['idea', 'researching', 'drafting', 'submitted', 'under_review', 'awarded', 'declined', 'reporting', 'closed'] },
    { key: 'amount', type: 'number' },
    { key: 'currency', type: 'enum', options: CURRENCIES },
    { key: 'deadline', type: 'date' },
    { key: 'decision_date', type: 'date' },
    { key: 'owner_id', type: 'uuid' },
    { key: 'link', type: 'text' },
    { key: 'description', type: 'text' },
    { key: 'notes', type: 'text' },
    ...COVERS,
  ],
  opportunity: [
    { key: 'title', type: 'text' },
    { key: 'organisation', type: 'text' },
    { key: 'kind', type: 'enum', options: ['grant', 'partnership', 'tender', 'fellowship', 'consultancy', 'event', 'other'] },
    { key: 'status', type: 'enum', options: ['new', 'evaluating', 'pursuing', 'applied', 'won', 'lost', 'passed'] },
    { key: 'value', type: 'number' },
    { key: 'currency', type: 'enum', options: CURRENCIES },
    { key: 'deadline', type: 'date' },
    { key: 'owner_id', type: 'uuid' },
    { key: 'source_url', type: 'text' },
    { key: 'description', type: 'text' },
    { key: 'notes', type: 'text' },
    ...COVERS,
  ],
  project: [
    { key: 'name', type: 'text' },
    { key: 'status', type: 'enum', options: ['planning', 'active', 'on_hold', 'completed', 'cancelled'] },
    { key: 'start_date', type: 'date' },
    { key: 'end_date', type: 'date' },
    { key: 'budget', type: 'number' },
    { key: 'spent', type: 'number' },
    { key: 'currency', type: 'enum', options: CURRENCIES },
    { key: 'progress', type: 'int' },
    { key: 'lead_id', type: 'uuid' },
    { key: 'grant_id', type: 'uuid' },
    { key: 'description', type: 'text' },
    { key: 'notes', type: 'text' },
  ],
  fellowship: [
    { key: 'title', type: 'text' },
    { key: 'host', type: 'text' },
    { key: 'status', type: 'enum', options: ['applying', 'accepted', 'active', 'completed', 'declined', 'withdrawn'] },
    { key: 'stipend', type: 'number' },
    { key: 'currency', type: 'enum', options: CURRENCIES },
    { key: 'start_date', type: 'date' },
    { key: 'deadline', type: 'date' },
    { key: 'owner_id', type: 'uuid' },
    { key: 'link', type: 'text' },
    { key: 'description', type: 'text' },
    { key: 'notes', type: 'text' },
    ...COVERS,
  ],
};

/** Details the person who added something may keep from everyone else, per item. */
const HIDEABLE: Record<Kind, string[]> = {
  grant: ['amount', 'funder', 'deadline', 'decision_date', 'owner_id', 'link', 'description', 'notes'],
  opportunity: ['value', 'organisation', 'deadline', 'owner_id', 'source_url', 'description', 'notes'],
  project: ['budget', 'spent', 'lead_id', 'grant_id', 'description', 'notes'],
  fellowship: ['stipend', 'host', 'deadline', 'owner_id', 'link', 'description', 'notes'],
};

type Mine = 'owner' | 'edit' | 'view' | 'team';

/** What this person is to one record: its owner, an editor, a viewer, or just a member of the team it is open to. */
async function myPart(kind: Kind, row: { id: string; created_by: string | null; visibility?: string }, actor: Actor, oversight: boolean, access: Map<string, 'view' | 'edit'>): Promise<Mine | null> {
  if (row.created_by === actor.id) return 'owner';
  if (oversight) return 'edit';
  const lvl = access.get(`${kind}:${row.id}`);
  if (lvl) return lvl;
  return row.visibility === 'restricted' ? null : 'team';
}

/** Keep only known fields and coerce them, so a crafted request can't write anything else. */
function clean(kind: Kind, input: Record<string, unknown>) {
  const out: Record<string, unknown> = {};
  for (const f of FIELDS[kind]) {
    if (!(f.key in input)) continue;
    const v = input[f.key];
    if (v === null || v === undefined || v === '') {
      out[f.key] = f.key === LABEL_FIELD[kind] ? undefined : null;
      continue;
    }
    switch (f.type) {
      case 'text':
        out[f.key] = String(v).trim().slice(0, 4000);
        break;
      case 'number': {
        const n = Number(v);
        if (!Number.isFinite(n) || n < 0) throw new Error(`${f.key} must be a positive number.`);
        out[f.key] = n;
        break;
      }
      case 'int': {
        const n = Math.round(Number(v));
        if (!Number.isFinite(n) || n < 0 || n > 100) throw new Error('Progress must be between 0 and 100.');
        out[f.key] = n;
        break;
      }
      case 'date':
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(v))) throw new Error(`${f.key} must be a date.`);
        out[f.key] = String(v);
        break;
      case 'enum':
        if (!f.options!.includes(String(v))) throw new Error(`Invalid ${f.key}.`);
        out[f.key] = String(v);
        break;
      case 'uuid':
        if (!/^[0-9a-f-]{36}$/i.test(String(v))) throw new Error(`Invalid ${f.key}.`);
        out[f.key] = String(v);
        break;
      case 'tags':
        out[f.key] = [...new Set((Array.isArray(v) ? v : String(v).split(',')).map((t) => String(t).trim().slice(0, 60)).filter(Boolean))].slice(0, 30);
        break;
      case 'sdgs':
        out[f.key] = [...new Set((Array.isArray(v) ? v : []).map((n) => Math.round(Number(n))).filter((n) => n >= 1 && n <= 17))].sort((a, b) => a - b);
        break;
    }
  }
  return out;
}

async function audit(actor: Actor, action: string, kind: string, id: string, label?: string, details?: Record<string, unknown>) {
  await logAudit({ actorId: actor.id, actorEmail: actor.email, action: `mjengo.${action}`, targetType: kind, targetId: id, targetLabel: label, details });
}

const revalidate = () => revalidatePath('/dashboard/mjengo', 'layout');

/* ------------------------------------------------------------------ People */

export interface AdminLite {
  id: string;
  name: string;
  avatar: string | null;
  email: string | null;
}

export async function listAdmins(): Promise<AdminLite[]> {
  await requireAdminActor();
  const { data } = await looseAdmin().from('profiles').select('id, first_name, last_name, email, avatar_url').eq('is_admin', true).order('first_name');
  return (data ?? []).map((p: { id: string; first_name: string | null; last_name: string | null; email: string | null; avatar_url: string | null }) => ({
    id: p.id,
    name: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Admin',
    avatar: p.avatar_url,
    email: p.email?.toLowerCase() ?? null,
  }));
}

/* --------------------------------------------------------------- Entities */

export interface DocSummary {
  total: number;
  required: number;
  missing: number;
}

export type EntityRow = Record<string, unknown> & { id: string; docs: DocSummary; openTodos: number };

async function docSummaries(kind: Kind, ids: string[]) {
  const map = new Map<string, DocSummary>();
  if (!ids.length) return map;
  const { data } = await looseAdmin().from('mjengo_documents').select('entity_id, required, file_path').eq('entity_type', kind).in('entity_id', ids);
  for (const d of (data ?? []) as { entity_id: string; required: boolean; file_path: string | null }[]) {
    const s = map.get(d.entity_id) ?? { total: 0, required: 0, missing: 0 };
    s.total += 1;
    if (d.required) s.required += 1;
    if (d.required && !d.file_path) s.missing += 1;
    map.set(d.entity_id, s);
  }
  return map;
}

export async function listEntities(kind: Kind): Promise<EntityRow[]> {
  const actor = await requireModule(MODULE_OF[kind]);
  const db = looseAdmin();
  const [{ data }, oversight, { data: acc }] = await Promise.all([
    db.from(TABLE[kind]).select('*').order('created_at', { ascending: false }),
    isSuperAdminEmail(actor.email),
    db.from('mjengo_entity_access').select('entity_type, entity_id, level').eq('user_id', actor.id).eq('entity_type', kind),
  ]);
  const access = new Map(((acc ?? []) as { entity_type: string; entity_id: string; level: 'view' | 'edit' }[]).map((r) => [`${r.entity_type}:${r.entity_id}`, r.level]));
  const all = (data ?? []) as { id: string; created_by: string | null; visibility?: string; hidden_fields?: string[] }[];
  const shaped: Record<string, unknown>[] = [];
  for (const r of all) {
    const mine = await myPart(kind, r, actor, oversight, access);
    if (!mine) continue;
    const hidden = mine === 'owner' || oversight ? [] : (r.hidden_fields ?? []);
    const out: Record<string, unknown> = { ...r, _mine: mine };
    for (const k of hidden) out[k] = null;
    out._hidden = hidden;
    shaped.push(out);
  }
  const rows = shaped as { id: string }[];
  const docs = await docSummaries(kind, rows.map((r) => r.id));
  const { data: todos } = await db.from('mjengo_todos').select('entity_id').eq('entity_type', kind).neq('status', 'done');
  const open = new Map<string, number>();
  for (const t of (todos ?? []) as { entity_id: string }[]) open.set(t.entity_id, (open.get(t.entity_id) ?? 0) + 1);
  return rows.map((r) => ({ ...r, docs: docs.get(r.id) ?? { total: 0, required: 0, missing: 0 }, openTodos: open.get(r.id) ?? 0 })) as EntityRow[];
}

export async function saveEntity(kind: Kind, id: string | null, values: Record<string, unknown>) {
  const actor = await requireModule(MODULE_OF[kind], 'write');
  const db = looseAdmin();
  const data = clean(kind, values);
  if (id) {
    const { data: cur } = await db.from(TABLE[kind]).select('id, created_by, visibility, hidden_fields').eq('id', id).maybeSingle();
    if (!cur) throw new Error('That no longer exists.');
    const oversight = await isSuperAdminEmail(actor.email);
    const { data: acc } = await db.from('mjengo_entity_access').select('level').eq('entity_type', kind).eq('entity_id', id).eq('user_id', actor.id).maybeSingle();
    const part = await myPart(kind, cur as never, actor, oversight, new Map(acc ? [[`${kind}:${id}`, acc.level as 'view' | 'edit']] : []));
    if (!part || part === 'view') throw new Error('You can see this but not change it.');
    // Details the owner keeps hidden cannot be written by anyone else.
    if (part !== 'owner' && !oversight) for (const k of (cur.hidden_fields ?? []) as string[]) delete data[k];
  }
  const labelKey = LABEL_FIELD[kind];
  if (!id && !data[labelKey]) throw new Error('Give it a name.');
  if (id && labelKey in values && !data[labelKey]) throw new Error('The name cannot be empty.');
  for (const k of Object.keys(data)) if (data[k] === undefined) delete data[k];

  if (id) {
    const { data: before } = await db.from(TABLE[kind]).select('status').eq('id', id).maybeSingle();
    const { data: row, error } = await db.from(TABLE[kind]).update(data).eq('id', id).select('*').single();
    if (error || !row) throw new Error('Could not save the changes.');
    const statusChanged = before && 'status' in data && before.status !== data.status;
    await audit(actor, statusChanged ? `${kind}.status_changed` : `${kind}.updated`, kind, id, String(row[labelKey]), statusChanged ? { from: before!.status, to: data.status } : undefined);
    revalidate();
    return row;
  }
  // Private from the start: only the person who adds it (and anyone they add later) sees a restricted record.
  const visibility = values.visibility === 'restricted' ? 'restricted' : 'team';
  const { data: row, error } = await db.from(TABLE[kind]).insert({ ...data, visibility, created_by: actor.id }).select('*').single();
  if (error || !row) throw new Error('Could not create it.');
  await audit(actor, `${kind}.created`, kind, row.id, String(row[labelKey]));
  revalidate();
  return row;
}

export async function deleteEntity(kind: Kind, id: string) {
  const actor = await requireModule(MODULE_OF[kind], 'owner');
  const db = looseAdmin();
  const { data: row } = await db.from(TABLE[kind]).select('*').eq('id', id).maybeSingle();
  if (!row) return { success: true };
  if (row.visibility === 'restricted' && row.created_by && row.created_by !== actor.id && !(await isSuperAdminEmail(actor.email))) throw new Error('Only the person who added it can delete it.');

  const { data: docs } = await db.from('mjengo_documents').select('file_path').eq('entity_type', kind).eq('entity_id', id);
  const paths = (docs ?? []).map((d: { file_path: string | null }) => d.file_path).filter(Boolean) as string[];
  if (paths.length) await db.storage.from('mjengo-docs').remove(paths);
  await db.from('mjengo_documents').delete().eq('entity_type', kind).eq('entity_id', id);
  await db.from('mjengo_todos').update({ entity_type: null, entity_id: null }).eq('entity_type', kind).eq('entity_id', id);
  const { error } = await db.from(TABLE[kind]).delete().eq('id', id);
  if (error) throw new Error('Could not delete it.');
  await audit(actor, `${kind}.deleted`, kind, id, String(row[LABEL_FIELD[kind]]));
  revalidate();
  return { success: true };
}

/* -------------------------------------------------------------- Documents */

export interface DocRow {
  id: string;
  entity_type: Kind;
  entity_id: string;
  entity_label: string | null;
  name: string;
  required: boolean;
  due_date: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  uploaded_at: string | null;
  uploaded_by: string | null;
  uploaded_by_name: string | null;
  drive_link: string | null;
  created_at: string;
}

async function labelsFor(rows: { entity_type: Kind; entity_id: string }[]) {
  const db = looseAdmin();
  const out = new Map<string, string>();
  for (const kind of ['grant', 'opportunity', 'project', 'fellowship'] as Kind[]) {
    const ids = Array.from(new Set(rows.filter((r) => r.entity_type === kind).map((r) => r.entity_id)));
    if (!ids.length) continue;
    const { data } = await db.from(TABLE[kind]).select(`id, ${LABEL_FIELD[kind]}`).in('id', ids);
    for (const e of (data ?? []) as unknown as Record<string, string>[]) out.set(`${kind}:${e.id}`, e[LABEL_FIELD[kind]]);
  }
  return out;
}

export async function listDocuments(opts: { kind?: Kind; entityId?: string } = {}): Promise<DocRow[]> {
  await requireAdminActor();
  const db = looseAdmin();
  let q = db.from('mjengo_documents').select('*').order('created_at', { ascending: false }).limit(500);
  if (opts.kind) q = q.eq('entity_type', opts.kind);
  if (opts.entityId) q = q.eq('entity_id', opts.entityId);
  const { data } = await q;
  const rows = (data ?? []) as Omit<DocRow, 'entity_label' | 'uploaded_by_name'>[];
  const labels = await labelsFor(rows);
  const uploaderIds = Array.from(new Set(rows.map((r) => r.uploaded_by).filter(Boolean))) as string[];
  const names = new Map<string, string>();
  if (uploaderIds.length) {
    const { data: ps } = await db.from('profiles').select('id, first_name, last_name').in('id', uploaderIds);
    for (const p of (ps ?? []) as { id: string; first_name: string | null; last_name: string | null }[]) names.set(p.id, [p.first_name, p.last_name].filter(Boolean).join(' '));
  }
  return rows.map((r) => ({ ...r, entity_label: labels.get(`${r.entity_type}:${r.entity_id}`) ?? null, uploaded_by_name: r.uploaded_by ? names.get(r.uploaded_by) ?? null : null }));
}

/** A checklist item: "Audited accounts", "Board resolution"... Outstanding until a file is attached. */
export async function addDocumentRequirement(kind: Kind, entityId: string, input: { name: string; required?: boolean; dueDate?: string | null }) {
  const actor = await requireAdminActor();
  const name = (input.name ?? '').trim().slice(0, 200);
  if (!name) throw new Error('Name the document.');
  const { data, error } = await looseAdmin()
    .from('mjengo_documents')
    .insert({ entity_type: kind, entity_id: entityId, name, required: input.required ?? true, due_date: input.dueDate || null })
    .select('id')
    .single();
  if (error) throw new Error('Could not add it.');
  await audit(actor, 'document.requirement_added', kind, entityId, name);
  revalidate();
  return data.id as string;
}

/**
 * Record a file the browser has already uploaded to the private bucket (admins can write it under
 * RLS). With docId it fulfils a requirement; without, it adds an extra document to the record.
 */
export async function registerDocumentFile(input: { docId?: string; kind: Kind; entityId: string; name?: string; path: string; fileName: string; size: number; mime: string }) {
  const actor = await requireAdminActor();
  if (!input.path.startsWith(`${input.kind}/${input.entityId}/`)) throw new Error('Invalid file location.');
  const db = looseAdmin();
  const file = { file_path: input.path, file_name: input.fileName.slice(0, 255), file_size: input.size, mime_type: input.mime.slice(0, 120), uploaded_by: actor.id, uploaded_at: new Date().toISOString() };

  if (input.docId) {
    const { data: old } = await db.from('mjengo_documents').select('file_path, name').eq('id', input.docId).maybeSingle();
    const { error } = await db.from('mjengo_documents').update(file).eq('id', input.docId);
    if (error) throw new Error('Could not attach the file.');
    if (old?.file_path && old.file_path !== input.path) await db.storage.from('mjengo-docs').remove([old.file_path]);
    await audit(actor, 'document.uploaded', input.kind, input.entityId, old?.name ?? input.fileName);
  } else {
    const { error } = await db.from('mjengo_documents').insert({ entity_type: input.kind, entity_id: input.entityId, name: (input.name || input.fileName).slice(0, 200), required: false, ...file });
    if (error) throw new Error('Could not attach the file.');
    await audit(actor, 'document.uploaded', input.kind, input.entityId, input.name || input.fileName);
  }
  revalidate();
  return { success: true };
}

export async function deleteDocument(docId: string) {
  const actor = await requireAdminActor();
  const db = looseAdmin();
  const { data: d } = await db.from('mjengo_documents').select('*').eq('id', docId).maybeSingle();
  if (!d) return { success: true };
  if (d.file_path) await db.storage.from('mjengo-docs').remove([d.file_path]);
  await db.from('mjengo_documents').delete().eq('id', docId);
  await audit(actor, 'document.deleted', d.entity_type, d.entity_id, d.name);
  revalidate();
  return { success: true };
}

export async function getDocumentUrl(docId: string): Promise<string> {
  await requireAdminActor();
  const db = looseAdmin();
  const { data: d } = await db.from('mjengo_documents').select('file_path, file_name').eq('id', docId).maybeSingle();
  if (!d?.file_path) throw new Error('No file attached yet.');
  const { data, error } = await db.storage.from('mjengo-docs').createSignedUrl(d.file_path, 300, { download: d.file_name ?? undefined });
  if (error || !data) throw new Error('Could not open the file.');
  return data.signedUrl;
}

/* ----------------------------------------------------------------- To-dos */

export interface TodoRow {
  id: string;
  track_id: string;
  title: string;
  notes: string | null;
  status: 'todo' | 'doing' | 'done';
  due_date: string | null;
  assignee_ids: string[];
  entity_type: Kind | null;
  entity_id: string | null;
  entity_label: string | null;
  created_by: string | null;
  completed_at: string | null;
  important: boolean;
  remind_on: string | null;
  steps: { id: string; title: string; done: boolean }[];
}

export interface TrackRow {
  id: string;
  name: string;
  color: string;
  created_by: string | null;
  created_by_name: string | null;
  todos: TodoRow[];
}

export async function getTodoBoard(): Promise<{ me: string; isSuper: boolean; admins: AdminLite[]; tracks: TrackRow[]; links: { kind: Kind; id: string; label: string }[] }> {
  const actor = await requireAdminActor();
  const db = looseAdmin();
  const [{ data: tracks }, { data: todos }, admins, isSuper] = await Promise.all([
    db.from('mjengo_todo_tracks').select('*').order('created_at'),
    db.from('mjengo_todos').select('*').order('created_at'),
    listAdmins(),
    isSuperAdminEmail(actor.email),
  ]);
  const todoRows = (todos ?? []) as Omit<TodoRow, 'entity_label'>[];
  const labels = await labelsFor(todoRows.filter((t) => t.entity_type && t.entity_id) as { entity_type: Kind; entity_id: string }[]);
  const names = new Map(admins.map((a) => [a.id, a.name]));

  // Everything a task can be linked to.
  const links: { kind: Kind; id: string; label: string }[] = [];
  for (const kind of ['grant', 'opportunity', 'project', 'fellowship'] as Kind[]) {
    const { data } = await db.from(TABLE[kind]).select(`id, ${LABEL_FIELD[kind]}`).order('created_at', { ascending: false }).limit(200);
    for (const e of (data ?? []) as unknown as Record<string, string>[]) links.push({ kind, id: e.id, label: e[LABEL_FIELD[kind]] });
  }

  return {
    me: actor.id,
    isSuper,
    admins,
    links,
    tracks: ((tracks ?? []) as Omit<TrackRow, 'todos' | 'created_by_name'>[]).map((t) => ({
      ...t,
      created_by_name: t.created_by ? names.get(t.created_by) ?? null : null,
      todos: todoRows.filter((x) => x.track_id === t.id).map((x) => ({ ...x, entity_label: x.entity_type && x.entity_id ? labels.get(`${x.entity_type}:${x.entity_id}`) ?? null : null })),
    })),
  };
}

export async function createTrack(name: string, color = 'purple') {
  const actor = await requireAdminActor();
  const n = (name ?? '').trim().slice(0, 80);
  if (!n) throw new Error('Name the track.');
  const { data, error } = await looseAdmin().from('mjengo_todo_tracks').insert({ name: n, color, created_by: actor.id }).select('id').single();
  if (error) throw new Error('Could not create the track.');
  await audit(actor, 'track.created', 'todo_track', data.id, n);
  revalidate();
  return data.id as string;
}

async function ownsTrack(actor: Actor, trackId: string) {
  const { data: t } = await looseAdmin().from('mjengo_todo_tracks').select('created_by, name').eq('id', trackId).maybeSingle();
  if (!t) throw new Error('Track not found.');
  if (t.created_by === actor.id || (await isSuperAdminEmail(actor.email))) return t as { created_by: string | null; name: string };
  throw new Error('Only the person who started this track (or a super admin) can change it.');
}

export async function renameTrack(trackId: string, name: string) {
  const actor = await requireAdminActor();
  await ownsTrack(actor, trackId);
  const n = name.trim().slice(0, 80);
  if (!n) throw new Error('Name the track.');
  await looseAdmin().from('mjengo_todo_tracks').update({ name: n }).eq('id', trackId);
  await audit(actor, 'track.renamed', 'todo_track', trackId, n);
  revalidate();
}

export async function deleteTrack(trackId: string) {
  const actor = await requireAdminActor();
  const t = await ownsTrack(actor, trackId);
  await looseAdmin().from('mjengo_todo_tracks').delete().eq('id', trackId);
  await audit(actor, 'track.deleted', 'todo_track', trackId, t.name);
  revalidate();
}

/** Tell people they were given a task (never the person who gave it). */
async function notifyAssigned(actor: Actor, userIds: string[], title: string, todoId: string) {
  const others = userIds.filter((u) => u !== actor.id);
  if (!others.length) return;
  const { sendNotification } = await import('@/lib/notifications');
  await Promise.all(others.map((userId) => sendNotification({ userId, type: 'todo_assigned', title: 'A task was given to you', message: `${actor.name || 'A teammate'}: ${title}`, link: `/dashboard/mjengo/todos?task=${todoId}`, sendEmail: false }).catch(() => undefined)));
  // Like Google: whoever is given a task is emailed as well as notified.
  const { data: people } = await looseAdmin().from('profiles').select('email').in('id', others);
  const to = ((people ?? []) as { email: string | null }[]).map((p) => p.email).filter(Boolean) as string[];
  if (to.length) void sendNoticeEmail({ to, by: actor.name || 'A teammate', subject: `Task for you: ${title}`.slice(0, 120), heading: 'A task was given to you', lines: [title], button: { label: 'Open the task', url: `/dashboard/mjengo/todos?task=${todoId}` } });
}

export async function saveTodo(id: string | null, v: { trackId?: string; title?: string; notes?: string | null; dueDate?: string | null; assigneeIds?: string[]; status?: 'todo' | 'doing' | 'done'; entityType?: Kind | null; entityId?: string | null; important?: boolean; remindOn?: string | null; steps?: { id: string; title: string; done: boolean }[] }) {
  const actor = await requireAdminActor();
  const db = looseAdmin();
  const row: Record<string, unknown> = {};
  if (v.title !== undefined) {
    const t = v.title.trim().slice(0, 300);
    if (!t) throw new Error('Describe the task.');
    row.title = t;
  }
  if (v.notes !== undefined) row.notes = v.notes ? v.notes.slice(0, 4000) : null;
  if (v.dueDate !== undefined) {
    if (v.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(v.dueDate)) throw new Error('Invalid date.');
    row.due_date = v.dueDate || null;
  }
  if (v.assigneeIds !== undefined) {
    // Only real admins can hold a responsibility.
    const ids = Array.from(new Set(v.assigneeIds)).slice(0, 10);
    const { data: ok } = ids.length ? await db.from('profiles').select('id').in('id', ids).eq('is_admin', true) : { data: [] };
    row.assignee_ids = (ok ?? []).map((p: { id: string }) => p.id);
  }
  if (v.status !== undefined) {
    row.status = v.status;
    row.completed_at = v.status === 'done' ? new Date().toISOString() : null;
  }
  if (v.important !== undefined) row.important = !!v.important;
  if (v.remindOn !== undefined) {
    if (v.remindOn && !/^\d{4}-\d{2}-\d{2}$/.test(v.remindOn)) throw new Error('Invalid reminder date.');
    row.remind_on = v.remindOn || null;
    row.last_notified_on = null;
  }
  if (v.steps !== undefined) row.steps = v.steps.slice(0, 30).map((x) => ({ id: String(x.id).slice(0, 40), title: String(x.title).slice(0, 200), done: !!x.done }));
  if (v.dueDate !== undefined) row.last_notified_on = null;
  if (v.entityType !== undefined) {
    row.entity_type = v.entityType;
    row.entity_id = v.entityType ? v.entityId ?? null : null;
  }

  if (id) {
    const before = v.assigneeIds ? (await db.from('mjengo_todos').select('assignee_ids').eq('id', id).maybeSingle()).data?.assignee_ids as string[] | undefined : undefined;
    const { data, error } = await db.from('mjengo_todos').update(row).eq('id', id).select('title, status').single();
    if (error) throw new Error('Could not save the task.');
    if (before && Array.isArray(row.assignee_ids)) await notifyAssigned(actor, (row.assignee_ids as string[]).filter((x) => !before.includes(x)), data.title, id);
    if (v.status) await audit(actor, 'todo.status_changed', 'todo', id, data.title, { to: v.status });
    else if (v.assigneeIds) await audit(actor, 'todo.assigned', 'todo', id, data.title, { assignees: row.assignee_ids });
  } else {
    if (!v.trackId || !row.title) throw new Error('A task needs a track and a title.');
    const { data, error } = await db.from('mjengo_todos').insert({ ...row, track_id: v.trackId, created_by: actor.id }).select('id, title').single();
    if (error) throw new Error('Could not add the task.');
    await audit(actor, 'todo.created', 'todo', data.id, data.title, { assignees: row.assignee_ids ?? [] });
    await notifyAssigned(actor, (row.assignee_ids as string[] | undefined) ?? [], data.title, data.id);
  }
  revalidate();
}

export async function deleteTodo(id: string) {
  const actor = await requireAdminActor();
  const { data } = await looseAdmin().from('mjengo_todos').select('title').eq('id', id).maybeSingle();
  await looseAdmin().from('mjengo_todos').delete().eq('id', id);
  await audit(actor, 'todo.deleted', 'todo', id, data?.title);
  revalidate();
}

/* --------------------------------------------------------------- Overview */

export interface Deadline {
  kind: 'grant' | 'opportunity' | 'project' | 'document' | 'todo';
  label: string;
  date: string;
  href: string;
  context?: string | null;
}

export interface Overview {
  grantsByStatus: { status: string; count: number; amount: number }[];
  currencies: string[];
  pipelineValue: number;
  awardedValue: number;
  opportunitiesByStatus: { status: string; count: number }[];
  projectsByStatus: { status: string; count: number }[];
  budget: { name: string; budget: number; spent: number }[];
  deadlines: Deadline[];
  missingDocs: number;
  openTodos: number;
  myTodos: number;
}

export async function getOverview(): Promise<Overview> {
  const actor = await requireAdminActor();
  const db = looseAdmin();
  const [{ data: grants }, { data: opps }, { data: projects }, { data: docs }, { data: todos }, oversight, { data: acc }] = await Promise.all([
    db.from('mjengo_grants').select('id, title, status, amount, currency, deadline, created_by, visibility, hidden_fields'),
    db.from('mjengo_opportunities').select('id, title, status, deadline, created_by, visibility, hidden_fields'),
    db.from('mjengo_projects').select('id, name, status, budget, spent, end_date, created_by, visibility, hidden_fields'),
    db.from('mjengo_documents').select('id, name, entity_type, entity_id, required, file_path, due_date'),
    db.from('mjengo_todos').select('id, title, status, due_date, assignee_ids'),
    isSuperAdminEmail(actor.email),
    db.from('mjengo_entity_access').select('entity_type, entity_id').eq('user_id', actor.id),
  ]);
  // Records another person keeps to a few people are left out, and details their owner hid are not counted.
  const shared = new Set(((acc ?? []) as { entity_type: string; entity_id: string }[]).map((a) => `${a.entity_type}:${a.entity_id}`));
  const visibleTo = <X extends { id: string; created_by: string | null; visibility?: string; hidden_fields?: string[] }>(rows: X[] | null, kind: string, hide: string[]) =>
    (rows ?? [])
      .filter((r) => oversight || r.created_by === actor.id || r.visibility !== 'restricted' || shared.has(`${kind}:${r.id}`))
      .map((r) => {
        const out = { ...r } as Record<string, unknown>;
        if (!oversight && r.created_by !== actor.id) for (const k of hide) if ((r.hidden_fields ?? []).includes(k)) out[k] = null;
        return out as unknown as X;
      });
  const grantsV = visibleTo(grants as never[] | null, 'grant', ['amount', 'deadline']);
  const oppsV = visibleTo(opps as never[] | null, 'opportunity', ['deadline']);
  const projectsV = visibleTo(projects as never[] | null, 'project', ['budget', 'spent']);

  const G = (grantsV ?? []) as { id: string; title: string; status: string; amount: number | null; currency: string; deadline: string | null }[];
  const O = (oppsV ?? []) as { id: string; title: string; status: string; deadline: string | null }[];
  const P = (projectsV ?? []) as { id: string; name: string; status: string; budget: number | null; spent: number | null; end_date: string | null }[];
  const D = (docs ?? []) as { id: string; name: string; entity_type: Kind; entity_id: string; required: boolean; file_path: string | null; due_date: string | null }[];
  const T = (todos ?? []) as { id: string; title: string; status: string; due_date: string | null; assignee_ids: string[] }[];

  const group = <X extends { status: string }>(rows: X[], amount?: (r: X) => number) => {
    const m = new Map<string, { count: number; amount: number }>();
    for (const r of rows) {
      const e = m.get(r.status) ?? { count: 0, amount: 0 };
      e.count += 1;
      e.amount += amount ? amount(r) : 0;
      m.set(r.status, e);
    }
    return Array.from(m, ([status, v]) => ({ status, ...v }));
  };

  const open = ['idea', 'researching', 'drafting', 'submitted', 'under_review'];
  const today = new Date().toISOString().slice(0, 10);
  const deadlines: Deadline[] = [
    ...G.filter((g) => g.deadline && !['awarded', 'declined', 'closed'].includes(g.status)).map((g) => ({ kind: 'grant' as const, label: g.title, date: g.deadline!, href: '/dashboard/mjengo/grants' })),
    ...O.filter((o) => o.deadline && !['won', 'lost', 'passed'].includes(o.status)).map((o) => ({ kind: 'opportunity' as const, label: o.title, date: o.deadline!, href: '/dashboard/mjengo/opportunities' })),
    ...P.filter((p) => p.end_date && ['planning', 'active'].includes(p.status)).map((p) => ({ kind: 'project' as const, label: `${p.name} ends`, date: p.end_date!, href: '/dashboard/mjengo/projects' })),
    ...D.filter((d) => d.due_date && d.required && !d.file_path).map((d) => ({ kind: 'document' as const, label: d.name, date: d.due_date!, href: '/dashboard/mjengo/documents', context: d.entity_type })),
    ...T.filter((t) => t.due_date && t.status !== 'done').map((t) => ({ kind: 'todo' as const, label: t.title, date: t.due_date!, href: '/dashboard/mjengo/todos' })),
  ].sort((a, b) => a.date.localeCompare(b.date));

  return {
    grantsByStatus: group(G, (g) => Number(g.amount ?? 0)),
    currencies: Array.from(new Set(G.map((g) => g.currency))),
    pipelineValue: G.filter((g) => open.includes(g.status)).reduce((n, g) => n + Number(g.amount ?? 0), 0),
    awardedValue: G.filter((g) => ['awarded', 'reporting'].includes(g.status)).reduce((n, g) => n + Number(g.amount ?? 0), 0),
    opportunitiesByStatus: group(O).map(({ status, count }) => ({ status, count })),
    projectsByStatus: group(P).map(({ status, count }) => ({ status, count })),
    budget: P.filter((p) => p.budget).map((p) => ({ name: p.name, budget: Number(p.budget ?? 0), spent: Number(p.spent ?? 0) })).slice(0, 8),
    deadlines: deadlines.filter((d) => d.date >= today.slice(0, 8) + '01').slice(0, 40),
    missingDocs: D.filter((d) => d.required && !d.file_path).length,
    openTodos: T.filter((t) => t.status !== 'done').length,
    myTodos: T.filter((t) => t.status !== 'done' && t.assignee_ids?.includes(actor.id)).length,
  };
}


/* ------------------------------------------------------- Who sees a record */

export interface EntityAccess {
  visibility: 'team' | 'restricted';
  hidden: string[];
  hideable: string[];
  owner: { id: string; name: string } | null;
  people: { id: string; name: string; email: string; avatar: string | null; level: 'view' | 'edit' }[];
  canManage: boolean;
}

async function ownerCheck(kind: Kind, id: string, actor: Actor) {
  const { data } = await looseAdmin().from(TABLE[kind]).select('id, created_by, visibility, hidden_fields').eq('id', id).maybeSingle();
  if (!data) throw new Error('That no longer exists.');
  const canManage = data.created_by === actor.id || (await isSuperAdminEmail(actor.email));
  return { row: data as { id: string; created_by: string | null; visibility: 'team' | 'restricted'; hidden_fields: string[] }, canManage };
}

export async function getEntityAccess(kind: Kind, id: string): Promise<EntityAccess> {
  const actor = await requireModule(MODULE_OF[kind]);
  const { row, canManage } = await ownerCheck(kind, id, actor);
  const db = looseAdmin();
  const { data: rows } = await db.from('mjengo_entity_access').select('user_id, level').eq('entity_type', kind).eq('entity_id', id);
  const ids = [...new Set([...(rows ?? []).map((r: { user_id: string }) => r.user_id), ...(row.created_by ? [row.created_by] : [])])];
  const { data: profs } = ids.length ? await db.from('profiles').select('id, first_name, last_name, email, avatar_url').in('id', ids) : { data: [] };
  const info = new Map(((profs ?? []) as { id: string; first_name: string | null; last_name: string | null; email: string | null; avatar_url: string | null }[]).map((p) => [p.id, { name: [p.first_name, p.last_name].filter(Boolean).join(' ') || p.email || 'Someone', email: p.email ?? '', avatar: p.avatar_url }]));
  return {
    visibility: row.visibility,
    hidden: row.hidden_fields ?? [],
    hideable: HIDEABLE[kind],
    owner: row.created_by ? { id: row.created_by, name: info.get(row.created_by)?.name ?? 'Someone' } : null,
    canManage,
    people: ((rows ?? []) as { user_id: string; level: 'view' | 'edit' }[]).filter((r) => r.user_id !== row.created_by).map((r) => ({ id: r.user_id, level: r.level, name: info.get(r.user_id)?.name ?? 'Someone', email: info.get(r.user_id)?.email ?? '', avatar: info.get(r.user_id)?.avatar ?? null })),
  };
}

/** Who may see it (the whole team or only people added) and which details stay hidden from the others. */
export async function setEntityControls(kind: Kind, id: string, controls: { visibility?: 'team' | 'restricted'; hidden?: string[] }) {
  const actor = await requireModule(MODULE_OF[kind], 'write');
  const { row, canManage } = await ownerCheck(kind, id, actor);
  if (!canManage) throw new Error('Only the person who added it can change who sees it.');
  const update: Record<string, unknown> = {};
  if (controls.visibility) {
    if (!['team', 'restricted'].includes(controls.visibility)) throw new Error('Unknown setting.');
    update.visibility = controls.visibility;
  }
  if (controls.hidden) update.hidden_fields = controls.hidden.filter((k) => HIDEABLE[kind].includes(k));
  if (!Object.keys(update).length) return;
  const db = looseAdmin();
  await db.from(TABLE[kind]).update(update).eq('id', id);
  await audit(actor, `${kind}.access_changed`, kind, id, undefined, update);
  void row;
}

export async function setEntityAccess(kind: Kind, id: string, userId: string, level: 'view' | 'edit' | null, notify = true) {
  const actor = await requireModule(MODULE_OF[kind], 'write');
  const { row, canManage } = await ownerCheck(kind, id, actor);
  if (!canManage) throw new Error('Only the person who added it can change who sees it.');
  const db = looseAdmin();
  const { data: target } = await db.from('profiles').select('email, is_admin').eq('id', userId).maybeSingle();
  if (!target?.is_admin) throw new Error('It can only be shared with administrators.');
  if (level) await db.from('mjengo_entity_access').upsert({ entity_type: kind, entity_id: id, user_id: userId, level, granted_by: actor.id }, { onConflict: 'entity_type,entity_id,user_id' });
  else await db.from('mjengo_entity_access').delete().eq('entity_type', kind).eq('entity_id', id).eq('user_id', userId);
  const { data: ent } = await db.from(TABLE[kind]).select(LABEL_FIELD[kind]).eq('id', id).maybeSingle();
  const title = ent ? String((ent as unknown as Record<string, string>)[LABEL_FIELD[kind]]) : kind;
  await audit(actor, level ? `${kind}.shared` : `${kind}.unshared`, kind, id, title, { with: target.email, level });
  if (notify && level && target.email) void sendAccessEmail({ kind, to: [target.email], by: actor.name, title, url: `/dashboard/mjengo/${kind === 'opportunity' ? 'opportunities' : `${kind}s`}`, detail: level === 'edit' ? 'You can view and edit it.' : 'You can view it.' });
  void row;
}


/* ------------------------------------------------- Fellowship assignments */

export interface AssignmentRow {
  id: string;
  fellowship_id: string;
  title: string;
  due_date: string | null;
  status: 'todo' | 'in_progress' | 'submitted' | 'accepted' | 'revise';
  notes: string | null;
  submitted_at: string | null;
}

const ASSIGNMENT_STATUS = ['todo', 'in_progress', 'submitted', 'accepted', 'revise'];

/** Things that are due for a fellowship: reports, essays, forms, check-ins. Newest due date last. */
export async function listAssignments(fellowshipId: string): Promise<AssignmentRow[]> {
  await requireModule('fellowships');
  const { data } = await looseAdmin().from('mjengo_fellowship_assignments').select('id, fellowship_id, title, due_date, status, notes, submitted_at').eq('fellowship_id', fellowshipId).order('due_date', { ascending: true, nullsFirst: false });
  return (data ?? []) as AssignmentRow[];
}

export async function saveAssignment(fellowshipId: string, id: string | null, v: { title?: string; dueDate?: string | null; status?: AssignmentRow['status']; notes?: string | null }): Promise<AssignmentRow> {
  const actor = await requireModule('fellowships', 'write');
  const db = looseAdmin();
  const row: Record<string, unknown> = {};
  if (v.title !== undefined) {
    const t = v.title.trim().slice(0, 200);
    if (!t) throw new Error('Name the assignment.');
    row.title = t;
  }
  if (v.dueDate !== undefined) {
    if (v.dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(v.dueDate)) throw new Error('That is not a date.');
    row.due_date = v.dueDate || null;
  }
  if (v.status !== undefined) {
    if (!ASSIGNMENT_STATUS.includes(v.status)) throw new Error('Unknown status.');
    row.status = v.status;
    row.submitted_at = v.status === 'submitted' ? new Date().toISOString() : null;
  }
  if (v.notes !== undefined) row.notes = v.notes?.trim().slice(0, 2000) || null;
  const cols = 'id, fellowship_id, title, due_date, status, notes, submitted_at';
  const q = id
    ? db.from('mjengo_fellowship_assignments').update(row).eq('id', id).eq('fellowship_id', fellowshipId)
    : db.from('mjengo_fellowship_assignments').insert({ ...row, fellowship_id: fellowshipId, created_by: actor.id });
  const { data, error } = await q.select(cols).single();
  if (error || !data) throw new Error('Could not save the assignment.');
  await audit(actor, id ? 'assignment.updated' : 'assignment.created', 'fellowship', fellowshipId, String(data.title));
  return data as AssignmentRow;
}

export async function deleteAssignment(fellowshipId: string, id: string) {
  const actor = await requireModule('fellowships', 'owner');
  await looseAdmin().from('mjengo_fellowship_assignments').delete().eq('id', id).eq('fellowship_id', fellowshipId);
  await audit(actor, 'assignment.deleted', 'fellowship', fellowshipId, id);
}
