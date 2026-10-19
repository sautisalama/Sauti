'use server';

import { looseAdmin } from '@/lib/loose-db';
import { guard } from '@/lib/action-result';
import { logAudit } from '@/lib/access/audit';
import { requireModule } from '@/lib/access/permissions';
import { saveTodo } from '@/app/actions/mjengo';

/** The other things the calendar can add besides events: a to-do with a due date, and a deadline on a record. */

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** A task due on a day. It lands in the first track (a "To-dos" track is made when there is none) and is yours. */
async function todo_(v: { title: string; date: string; notes?: string | null }): Promise<void> {
  const a = await requireModule('todos', 'write');
  const title = v.title.trim().slice(0, 300);
  if (!title) throw new Error('Describe the task.');
  if (!DATE.test(v.date)) throw new Error('Pick the day it is due.');
  const db = looseAdmin();
  const { data: tracks } = await db.from('mjengo_todo_tracks').select('id').order('created_at').limit(1);
  let trackId = (tracks?.[0] as { id: string } | undefined)?.id;
  if (!trackId) {
    const { data, error } = await db.from('mjengo_todo_tracks').insert({ name: 'To-dos', color: 'purple', created_by: a.id }).select('id').single();
    if (error || !data) throw new Error('Could not start a to-do list.');
    trackId = data.id as string;
  }
  await saveTodo(null, { trackId, title, dueDate: v.date, notes: v.notes?.trim() || null, assigneeIds: [a.id] });
}

export type DeadlineKind = 'grant' | 'opportunity' | 'project';
export interface DeadlineTarget { kind: DeadlineKind; id: string; title: string; current: string | null }

const TABLE: Record<DeadlineKind, { table: string; label: string; field: string; module: 'grants' | 'opportunities' | 'projects' }> = {
  grant: { table: 'mjengo_grants', label: 'title', field: 'deadline', module: 'grants' },
  opportunity: { table: 'mjengo_opportunities', label: 'title', field: 'deadline', module: 'opportunities' },
  project: { table: 'mjengo_projects', label: 'name', field: 'end_date', module: 'projects' },
};

/** Records a deadline can be put on, most recent first. */
async function targets_(): Promise<DeadlineTarget[]> {
  await requireModule('calendar');
  const db = looseAdmin();
  const out: DeadlineTarget[] = [];
  for (const kind of Object.keys(TABLE) as DeadlineKind[]) {
    const t = TABLE[kind];
    const { data } = await db.from(t.table).select(`id, ${t.label}, ${t.field}`).order('created_at', { ascending: false }).limit(60);
    for (const r of (data ?? []) as unknown as Record<string, string | null>[]) out.push({ kind, id: String(r.id), title: String(r[t.label] ?? ''), current: (r[t.field] as string | null) ?? null });
  }
  return out;
}

/** Put (or move) the deadline of a grant, an opportunity or a project; it then shows on the calendar. */
async function setDeadline_(kind: DeadlineKind, id: string, date: string): Promise<void> {
  const t = TABLE[kind];
  if (!t) throw new Error('Unknown kind of record.');
  const a = await requireModule(t.module, 'write');
  if (!DATE.test(date)) throw new Error('Pick the day.');
  const { data, error } = await looseAdmin().from(t.table).update({ [t.field]: date }).eq('id', id).select(`id, ${t.label}`).maybeSingle();
  if (error || !data) throw new Error('Could not set the deadline.');
  await logAudit({ actorId: a.id, actorEmail: a.email, action: `${kind}.deadline_set`, targetType: kind, targetId: id, targetLabel: String((data as unknown as Record<string, string>)[t.label] ?? ''), details: { date } });
}

export const addCalendarTodo = guard(todo_);
export const deadlineTargets = guard(targets_);
export const setRecordDeadline = guard(setDeadline_);
