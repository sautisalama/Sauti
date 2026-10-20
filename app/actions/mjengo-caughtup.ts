'use server';

import { after } from 'next/server';
import { guard } from '@/lib/action-result';
import { looseAdmin } from '@/lib/loose-db';
import { requireAdminActor } from '@/lib/access/super-admin';
import { sinceFor } from '@/lib/mjengo/digest';
import { ENTITY_HREF, entitiesFor } from '@/lib/mjengo/entity-view';
import { waitingFor } from '@/lib/mjengo/approvals';
import { cleanTags } from '@/lib/mjengo/autotag';
import { listAccounts, listMessages } from '@/app/actions/mjengo-mail';
import { sortMessage } from '@/lib/mail/sort';

export interface UrgentItem { id: string; kind: 'overdue' | 'due_soon' | 'approval'; title: string; detail: string; href: string }
export interface AddedOpportunity { id: string; title: string; fromPhone: boolean; at: string; status: string; deadline: string | null }
export interface SharedFile { id: string; name: string; tags: string[]; at: string; size: number | null }
export interface CaughtUp { since: string; urgent: UrgentItem[]; opportunities: AddedOpportunity[]; documents: SharedFile[] }
export interface MailToAnswer { accountId: string; account: string; uid: number; mailbox: string; from: string; address: string; subject: string; date: string | null }

const DAY = 86400_000;
const day = (offset: number) => new Date(Date.now() + offset * DAY).toISOString().slice(0, 10);
const CLOSED = new Set(['won', 'lost', 'passed', 'awarded', 'declined', 'closed', 'completed', 'cancelled', 'withdrawn']);

const me = async () => { const a = await requireAdminActor(); return { id: a.id, email: a.email }; };

/**
 * What needs this person first: tasks that are late or due in two days, application deadlines in the next three days,
 * approvals waiting on them; opportunities added since they last caught up (from the phone too); and documents shared
 * in from a phone that still need their confirmation. Read from the records only: nothing here is worked out by a model.
 */
async function getCaughtUp_(): Promise<CaughtUp> {
  const a = await me();
  const db = looseAdmin();
  const since = await sinceFor(a.id);
  const today = day(0);
  const [{ data: todos }, entities, waiting, { data: files }] = await Promise.all([
    db.from('mjengo_todos').select('id, title, due_date, status').contains('assignee_ids', [a.id]).neq('status', 'done').not('due_date', 'is', null).lte('due_date', day(2)).order('due_date').limit(20),
    entitiesFor(a, ['grant', 'opportunity', 'project', 'fellowship']).catch(() => []),
    waitingFor(a).catch(() => []),
    db.from('vault_files').select('id, name, tags, created_at, size').eq('owner_id', a.id).eq('inbox', true).order('created_at', { ascending: false }).limit(30),
  ]);

  const urgent: UrgentItem[] = [];
  for (const w of waiting) urgent.push({ id: `ap-${w.approvalId}`, kind: 'approval', title: `${w.from} is waiting for your answer on ${w.name}`, detail: w.note ?? 'Approval asked', href: w.link });
  for (const t of (todos ?? []) as { id: string; title: string; due_date: string; status: string }[]) {
    const late = t.due_date < today;
    urgent.push({ id: `td-${t.id}`, kind: late ? 'overdue' : 'due_soon', title: t.title, detail: late ? `Task, was due ${t.due_date}` : t.due_date === today ? 'Task, due today' : `Task, due ${t.due_date}`, href: `/dashboard/mjengo/todos?task=${t.id}` });
  }
  for (const e of entities) {
    const r = e.row;
    if (CLOSED.has(String(r.status))) continue;
    const date = String((e.kind === 'project' ? r.end_date : r.deadline) ?? '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > day(3) || date < day(-30)) continue;
    const late = date < today;
    urgent.push({ id: `${e.kind}-${e.id}`, kind: late ? 'overdue' : 'due_soon', title: e.title, detail: `${e.kind === 'project' ? 'Project ends' : 'Deadline'} ${date}`, href: ENTITY_HREF[e.kind] });
  }
  urgent.sort((x, y) => (x.kind === y.kind ? 0 : x.kind === 'approval' ? -1 : y.kind === 'approval' ? 1 : x.kind === 'overdue' ? -1 : 1));

  const opportunities = entities
    .filter((e) => e.kind === 'opportunity' && (String(e.row.created_at ?? '') > since || e.row.inbox === true) && !CLOSED.has(String(e.row.status)))
    .map<AddedOpportunity>((e) => ({
      id: e.id, title: e.title || 'Untitled', status: String(e.row.status ?? 'new'), at: String(e.row.created_at ?? since),
      fromPhone: e.row.inbox === true || /phone share sheet/i.test(String(e.row.notes ?? '')),
      deadline: e.row.deadline ? String(e.row.deadline).slice(0, 10) : null,
    }))
    .sort((x, y) => y.at.localeCompare(x.at))
    .slice(0, 12);

  const documents = ((files ?? []) as { id: string; name: string; tags: string[] | null; created_at: string; size: number | null }[]).map<SharedFile>((f) => ({ id: f.id, name: f.name, tags: f.tags ?? [], at: f.created_at, size: f.size }));
  return { since, urgent: urgent.slice(0, 12), opportunities, documents };
}

const AUTOMATED = /no[-_.]?reply|do[-_.]?not[-_.]?reply|notifications?@|newsletter|mailer|bounce|updates@|digest|billing@|receipts?@|alerts?@|support@.*(zendesk|freshdesk)|@(.*\.)?(linkedin|facebookmail|twitter|x|google|github|vercel|supabase|stripe)\.com$/i;

/** Unread mail from real people in the last week, newest first. Loaded on its own because it talks to the mail server. */
async function getMailToAnswer_(): Promise<MailToAnswer[]> {
  await me();
  const accounts = await listAccounts();
  if (!accounts.ok) return [];
  const weekAgo = Date.now() - 7 * DAY;
  const out: MailToAnswer[] = [];
  await Promise.all(accounts.data.slice(0, 3).map(async (acc) => {
    const r = await Promise.race([listMessages(acc.id, 'INBOX', {}, 0, 120), new Promise<null>((res) => setTimeout(() => res(null), 12_000))]).catch(() => null);
    if (!r || !r.ok) return;
    for (const m of r.data.items) {
      if (m.seen) continue;
      if (m.date && new Date(m.date).getTime() < weekAgo) continue;
      // The same sorting as the inbox: only mail that needs a person counts, not lists, receipts, updates or payments.
      if (AUTOMATED.test(m.from.address) || sortMessage(m).kind !== 'person') continue;
      out.push({ accountId: acc.id, account: acc.label || acc.email, uid: m.uid, mailbox: m.mailbox, from: m.from.name || m.from.address, address: m.from.address, subject: m.subject, date: m.date });
    }
  }));
  return out.sort((x, y) => (y.date ?? '').localeCompare(x.date ?? '')).slice(0, 8);
}

/** The person has read the tags on a shared document and agrees (or changed them): it leaves the list. */
async function confirmSharedFile_(fileId: string, tags: string[]): Promise<string[]> {
  const a = await me();
  const db = looseAdmin();
  const clean = cleanTags(tags, 12);
  const { data, error } = await db.from('vault_files').update({ tags: clean, inbox: false }).eq('id', fileId).eq('owner_id', a.id).eq('inbox', true).select('id').maybeSingle();
  if (error || !data) throw new Error('That document is already confirmed or no longer there.');
  after(async () => { const { indexSource } = await import('@/lib/mjengo/search-index'); await indexSource('file', fileId).catch(() => undefined); });
  return clean;
}

export const getCaughtUp = guard(getCaughtUp_);
export const getMailToAnswer = guard(getMailToAnswer_);
export const confirmSharedFile = guard(confirmSharedFile_);
