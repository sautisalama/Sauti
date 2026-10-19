import { looseAdmin } from '@/lib/loose-db';
import { askAi } from '@/lib/mjengo/ai';
import { dropUnsupportedDateLines } from '@/lib/mjengo/evidence';
import { entitiesFor, ENTITY_HREF } from '@/lib/mjengo/entity-view';
import { waitingFor } from '@/lib/mjengo/approvals';

export type DigestKind = 'approval' | 'task' | 'status' | 'call' | 'note' | 'record';
export interface DigestItem { at: string; kind: DigestKind; title: string; detail?: string; link: string | null }
export interface Digest { since: string; items: DigestItem[]; /** Salama's few lines on what matters most; empty when there is nothing. */ brief: string }

const DAY = 86400_000;

/** When "since you were away" starts: the last time they caught up, at most 30 days back, at least an hour. */
export async function sinceFor(userId: string): Promise<string> {
  const { data } = await looseAdmin().from('mjengo_digest_seen').select('seen_at').eq('user_id', userId).maybeSingle();
  const floor = Date.now() - 30 * DAY;
  const t = data?.seen_at ? new Date(data.seen_at).getTime() : Date.now() - 7 * DAY;
  return new Date(Math.min(Math.max(t, floor), Date.now() - 3600_000)).toISOString();
}

export async function markCaughtUp(userId: string): Promise<void> {
  await looseAdmin().from('mjengo_digest_seen').upsert({ user_id: userId, seen_at: new Date().toISOString() }, { onConflict: 'user_id' });
}

/**
 * What changed for this person since they last looked: approvals waiting on them, tasks given to them, status changes
 * on the records they can see, calls they were in whose notes are ready, and their own notifications. Nothing they may not
 * see; nothing they did themselves.
 */
export async function collectDigest(asker: { id: string; email: string }, since: string): Promise<DigestItem[]> {
  const db = looseAdmin();
  const items: DigestItem[] = [];
  const [waiting, { data: tasks }, { data: calls }, { data: notes }, entities] = await Promise.all([
    waitingFor(asker).catch(() => []),
    db.from('mjengo_todos').select('id, title, due_date, created_by, created_at').contains('assignee_ids', [asker.id]).neq('status', 'done').gt('created_at', since).limit(30),
    db.from('mjengo_meetings').select('code, title, notes_shared_at').contains('participants', [asker.id]).gt('notes_shared_at', since).limit(15),
    db.from('notifications').select('title, message, link, created_at').eq('user_id', asker.id).gt('created_at', since).order('created_at', { ascending: false }).limit(40),
    entitiesFor(asker).catch(() => []),
  ]);
  for (const w of waiting) items.push({ at: w.at, kind: 'approval', title: `${w.from} asked you to approve ${w.name}`, detail: w.note ?? undefined, link: w.link });
  for (const t of (tasks ?? []) as { id: string; title: string; due_date: string | null; created_by: string | null; created_at: string }[]) {
    if (t.created_by === asker.id) continue;
    items.push({ at: t.created_at, kind: 'task', title: `A task for you: ${t.title}`, detail: t.due_date ? `Due ${t.due_date}` : undefined, link: `/dashboard/mjengo/todos?task=${t.id}` });
  }
  for (const c of (calls ?? []) as { code: string; title: string | null; notes_shared_at: string }[]) items.push({ at: c.notes_shared_at, kind: 'call', title: `Notes are ready: ${c.title || 'your call'}`, link: `/dashboard/mjengo/meetings?code=${c.code}` });
  const seen = new Set(items.map((i) => i.title));
  for (const n of (notes ?? []) as { title: string; message: string | null; link: string | null; created_at: string }[]) {
    if (seen.has(n.title) || /approval is asked/i.test(n.title)) continue;
    items.push({ at: n.created_at, kind: 'note', title: n.title, detail: n.message ?? undefined, link: n.link });
  }
  // Status changes and new records among those they can see, by other people.
  const visible = new Map(entities.map((e) => [`${e.kind}:${e.id}`, e]));
  const { data: audit } = await db.from('audit_logs').select('actor_id, action, target_type, target_id, target_label, details, created_at').in('target_type', ['grant', 'opportunity', 'project', 'fellowship']).gt('created_at', since).order('created_at', { ascending: false }).limit(80);
  for (const a of (audit ?? []) as { actor_id: string | null; action: string; target_type: string; target_id: string; target_label: string | null; details: { from?: string; to?: string } | null; created_at: string }[]) {
    if (a.actor_id === asker.id || !visible.has(`${a.target_type}:${a.target_id}`)) continue;
    const act = a.action.replace(/^mjengo\./, '');
    const label = a.target_label ?? visible.get(`${a.target_type}:${a.target_id}`)?.title ?? 'a record';
    if (act.endsWith('.status_changed')) items.push({ at: a.created_at, kind: 'status', title: `${label}: ${String(a.details?.from ?? '').replace(/_/g, ' ')} to ${String(a.details?.to ?? '').replace(/_/g, ' ')}`, link: ENTITY_HREF[a.target_type as keyof typeof ENTITY_HREF] });
    else if (act.endsWith('.created')) items.push({ at: a.created_at, kind: 'record', title: `New ${a.target_type}: ${label}`, link: ENTITY_HREF[a.target_type as keyof typeof ENTITY_HREF] });
  }
  return items.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 40);
}

/** Salama's few lines: what to look at first, from the items only. */
export async function briefOf(items: DigestItem[], since: string): Promise<string> {
  if (!items.length) return '';
  const out = await askAi(
    'You are Salama, a member of the team at Sauti Salama, welcoming a colleague back. From the list of changes, write a short catch-up in plain Markdown: one opening sentence, then at most five bullets, most important first (anything waiting for their answer or given to them comes first). Use only what the list says; never invent names, dates or numbers; do not repeat every item, group the small ones. Under 110 words.',
    `They were last here on ${since.slice(0, 10)}. Changes since:\n${items.slice(0, 40).map((i) => `- ${i.at.slice(0, 10)} [${i.kind}] ${i.title}${i.detail ? `: ${i.detail}` : ''}`).join('\n')}`,
    450,
    { temperature: 0.2 },
  );
  return dropUnsupportedDateLines(out, `${since}\n${items.map((i) => `${i.at} ${i.title} ${i.detail ?? ''}`).join('\n')}`).text;
}
