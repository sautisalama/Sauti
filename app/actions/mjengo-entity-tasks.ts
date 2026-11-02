'use server';

import { randomUUID } from 'node:crypto';
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
  /** The small steps inside this to-do. */
  steps: { id: string; title: string; done: boolean }[];
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
    db.from('mjengo_todos').select('id, title, status, due_date, important, notes, assignee_ids, steps').eq('entity_type', kind).eq('entity_id', id).order('created_at'),
  ]);
  if (!ent) throw new Error('That item no longer exists.');
  const e = ent as Record<string, unknown>;
  const title = String(e[ENTITY_LABEL_FIELD[kind]] ?? '');
  const deadline = typeof e.deadline === 'string' ? e.deadline.slice(0, 10) : null;
  const tasks = ((rows ?? []) as (Omit<EntityTask, 'auto' | 'steps'> & { notes: string | null; steps: EntityTask['steps'] | null })[]).map(({ notes, steps, ...t }) => ({ ...t, steps: Array.isArray(steps) ? steps : [], auto: notes === AUTO_NOTE }));
  const have = new Set(tasks.flatMap((t) => [t.title, ...t.steps.map((x) => x.title)]).map((x) => x.toLowerCase()));
  // Once a suggested to-do exists, the page has nothing more to suggest.
  const suggestions = tasks.some((t) => t.auto) ? [] : suggestTasks(kind, title, deadline).filter((s) => !have.has(s.title.toLowerCase()));
  return { tasks, deadline, title, suggestions };
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

const shortDate = (iso: string) => new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** The suggested chain as ONE to-do with its steps inside, not a row of separate to-dos. */
async function addChecklist_(kind: EntityKind, id: string): Promise<EntityTasks> {
  const cur = await load_(kind, id);
  if (!cur.suggestions.length) return cur;
  const track = await trackId_();
  const name = cur.title.trim() || 'this';
  const last = cur.suggestions.map((x) => x.due).filter(Boolean).sort().pop() ?? null;
  const steps = cur.suggestions.map((x) => ({ id: randomUUID().slice(0, 12), title: x.due ? `${x.title} (by ${shortDate(x.due)})` : x.title, done: false }));
  await saveTodo(null, { trackId: track, title: kind === 'project' ? `Keep ${name} moving` : `Apply: ${name}`, dueDate: last, entityType: kind, entityId: id, notes: AUTO_NOTE, steps });
  return load_(kind, id);
}
export const addEntityChecklist = guard(addChecklist_);

async function toggleStep_(kind: EntityKind, id: string, taskId: string, stepId: string, done: boolean): Promise<EntityTasks> {
  await requireAdminActor();
  const { data } = await looseAdmin().from('mjengo_todos').select('steps, status').eq('id', taskId).eq('entity_type', kind).eq('entity_id', id).maybeSingle();
  if (!data) throw new Error('That task is not linked here.');
  const steps = ((data.steps ?? []) as EntityTask['steps']).map((x) => (x.id === stepId ? { ...x, done } : x));
  // The to-do is done when its last step is, and open again if one is un-ticked.
  const status = steps.length > 0 && steps.every((x) => x.done) ? 'done' : data.status === 'done' ? 'todo' : data.status;
  await saveTodo(taskId, { steps, status });
  return load_(kind, id);
}
export const toggleEntityStep = guard(toggleStep_);

/**
 * Redo the suggested tasks after the deadline or link changed: only suggestions nobody has touched
 * (still to do, no one assigned, not starred) are replaced. Anything a person worked on stays.
 */
async function redo_(kind: EntityKind, id: string): Promise<EntityTasks> {
  const cur = await load_(kind, id);
  const untouched = cur.tasks.filter((t) => t.auto && t.status === 'todo' && !t.important && t.assignee_ids.length === 0 && !t.steps.some((x) => x.done));
  for (const t of untouched) await deleteTodo(t.id);
  return addChecklist_(kind, id);
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
