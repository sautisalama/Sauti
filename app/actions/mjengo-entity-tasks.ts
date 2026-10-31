'use server';

import { guard } from '@/lib/action-result';
import { looseAdmin } from '@/lib/loose-db';
import { requireAdminActor } from '@/lib/access/super-admin';
import { ENTITY_KINDS, ENTITY_LABEL_FIELD, ENTITY_TABLE, type EntityKind } from '@/lib/mjengo/entity-view';
import { createTrack, saveTodo, deleteTodo } from '@/app/actions/mjengo';
import { AUTO_NOTE, suggestTasks, type SuggestedTask } from '@/lib/mjengo/task-suggestions';

export interface EntityTask {
  id: string;
  title: string;
  status: 'todo' | 'doing' | 'done';
  due_date: string | null;
  important: boolean;
  auto: boolean;
  assignee_ids: string[];
}

export interface EntityTasks {
  tasks: EntityTask[];
  /** What the suggestions are worked from, so the page can say why. */
  deadline: string | null;
  title: string;
  suggestions: SuggestedTask[];
}

const kindOk = (k: string): k is EntityKind => (ENTITY_KINDS as string[]).includes(k);

async function load_(kind: EntityKind, id: string): Promise<EntityTasks> {
  await requireAdminActor();
  if (!kindOk(kind) || !/^[0-9a-f-]{36}$/i.test(id)) throw new Error('Unknown item.');
  const db = looseAdmin();
  const [{ data: ent }, { data: rows }] = await Promise.all([
    db.from(ENTITY_TABLE[kind]).select('*').eq('id', id).maybeSingle(),
    db.from('mjengo_todos').select('id, title, status, due_date, important, notes, assignee_ids').eq('entity_type', kind).eq('entity_id', id).order('created_at'),
  ]);
  if (!ent) throw new Error('That item no longer exists.');
  const e = ent as Record<string, unknown>;
  const title = String(e[ENTITY_LABEL_FIELD[kind]] ?? '');
  const deadline = typeof e.deadline === 'string' ? e.deadline.slice(0, 10) : null;
  const tasks = ((rows ?? []) as (Omit<EntityTask, 'auto'> & { notes: string | null })[]).map(({ notes, ...t }) => ({ ...t, auto: notes === AUTO_NOTE }));
  const have = new Set(tasks.map((t) => t.title.toLowerCase()));
  return { tasks, deadline, title, suggestions: suggestTasks(kind, title, deadline).filter((s) => !have.has(s.title.toLowerCase())) };
}
export const entityTasks = guard(load_);

async function trackId_(): Promise<string> {
  const db = looseAdmin();
  const { data } = await db.from('mjengo_todo_tracks').select('id').order('created_at').limit(1);
  const first = (data ?? [])[0] as { id: string } | undefined;
  return first?.id ?? (await createTrack('General'));
}

/** Add tasks linked to this item (the suggested ones, or one the person typed). */
async function add_(kind: EntityKind, id: string, items: { title: string; due: string | null; auto?: boolean }[]): Promise<EntityTasks> {
  await requireAdminActor();
  if (!kindOk(kind)) throw new Error('Unknown item.');
  const track = await trackId_();
  for (const it of items.slice(0, 12)) {
    await saveTodo(null, { trackId: track, title: it.title, dueDate: it.due, entityType: kind, entityId: id, notes: it.auto ? AUTO_NOTE : null });
  }
  return load_(kind, id);
}
export const addEntityTasks = guard(add_);

/**
 * Redo the suggested tasks after the deadline or link changed: only suggestions nobody has touched
 * (still to do, no one assigned, not starred) are replaced. Anything a person worked on stays.
 */
async function redo_(kind: EntityKind, id: string): Promise<EntityTasks> {
  const cur = await load_(kind, id);
  const untouched = cur.tasks.filter((t) => t.auto && t.status === 'todo' && !t.important && t.assignee_ids.length === 0);
  for (const t of untouched) await deleteTodo(t.id);
  const after = await load_(kind, id);
  return add_(kind, id, after.suggestions.map((s) => ({ ...s, auto: true })));
}
export const redoEntityTasks = guard(redo_);

async function toggle_(kind: EntityKind, id: string, taskId: string, done: boolean): Promise<EntityTasks> {
  await requireAdminActor();
  // Only touch a task that really belongs to this item.
  const { data } = await looseAdmin().from('mjengo_todos').select('id').eq('id', taskId).eq('entity_type', kind).eq('entity_id', id).maybeSingle();
  if (!data) throw new Error('That task is not linked here.');
  await saveTodo(taskId, { status: done ? 'done' : 'todo' });
  return load_(kind, id);
}
export const toggleEntityTask = guard(toggle_);
