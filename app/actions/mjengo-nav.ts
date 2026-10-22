'use server';

import { getActor, isSuperAdminEmail } from '@/lib/access/super-admin';
import { permissionsFor } from '@/lib/access/permissions';
import { looseAdmin } from '@/lib/loose-db';
import { entitiesFor } from '@/lib/mjengo/entity-view';

/** Which Mjengo sections the signed-in person sees in the side navigation. */
export interface MjengoNav {
  isAdmin: boolean;
  isSuper: boolean;
  /** Module keys this person may use, or null for everything. */
  allowed: string[] | null;
  /** Which kinds of work this person has any of. Grants, projects and fellowships show in the menu only once there is one
   *  (an opportunity that was won, or one made directly), so the menu starts small and grows with the work. */
  has: { grants: boolean; projects: boolean; fellowships: boolean };
}

export async function mjengoNav(): Promise<MjengoNav> {
  const actor = await getActor();
  if (!actor?.isAdmin) return { isAdmin: false, isSuper: false, allowed: null, has: { grants: true, projects: true, fellowships: true } };
  const perms = await permissionsFor(actor.id, actor.email);
  const mine = await entitiesFor({ id: actor.id, email: actor.email }, ['grant', 'project', 'fellowship']).catch(() => null);
  const has = mine ? { grants: mine.some((e) => e.kind === 'grant'), projects: mine.some((e) => e.kind === 'project'), fellowships: mine.some((e) => e.kind === 'fellowship') } : { grants: true, projects: true, fellowships: true };
  return { isAdmin: true, isSuper: await isSuperAdminEmail(actor.email), allowed: perms === 'all' ? null : [...perms.keys()], has };
}

export interface SuiteCounts {
  /** Opportunities that arrived from a phone and nobody has opened yet. */
  opportunities: number;
  /** Files shared to the app from a phone, still unopened. */
  files: number;
  /** Unread notifications that belong to the suite. */
  notifications: number;
  /** Responses to forms that nobody has looked at yet. */
  forms: number;
  /** Calls that have a transcript or notes worth opening. */
  meetings: number;
}

/** Small numbers shown on navigation items. Never throws: a missing count is just zero. */
export async function suiteCounts(): Promise<SuiteCounts> {
  const actor = await getActor();
  if (!actor?.isAdmin) return { opportunities: 0, files: 0, notifications: 0, forms: 0, meetings: 0 };
  const db = looseAdmin();
  const [o, f, n, fm, mt] = await Promise.all([
    db.from('mjengo_opportunities').select('id', { count: 'exact', head: true }).eq('inbox', true),
    db.from('vault_files').select('id', { count: 'exact', head: true }).eq('inbox', true).eq('owner_id', actor.id),
    db.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', actor.id).eq('read', false).like('link', '/dashboard/mjengo%'),
    db.from('mjengo_forms').select('id, responses_seen_at'),
    db.from('mjengo_meetings').select('id', { count: 'exact', head: true }).or('notes.not.is.null,transcript.neq.[]'),
  ]);
  let forms = 0;
  const rows = (fm.data ?? []) as { id: string; responses_seen_at: string }[];
  if (rows.length) {
    const { data: rs } = await db.from('mjengo_form_responses').select('form_id, created_at').in('form_id', rows.map((r) => r.id)).gte('created_at', rows.reduce((a, r) => (r.responses_seen_at < a ? r.responses_seen_at : a), rows[0].responses_seen_at));
    const seen = new Map(rows.map((r) => [r.id, r.responses_seen_at]));
    forms = ((rs ?? []) as { form_id: string; created_at: string }[]).filter((r) => r.created_at > (seen.get(r.form_id) ?? '')).length;
  }
  return { opportunities: o.count ?? 0, files: f.count ?? 0, notifications: n.count ?? 0, forms, meetings: mt.count ?? 0 };
}

/** Opening the Opportunities list clears the "from phone" marker. */
export async function clearOpportunityInbox(): Promise<void> {
  const actor = await getActor();
  if (!actor?.isAdmin) return;
  await looseAdmin().from('mjengo_opportunities').update({ inbox: false }).eq('inbox', true);
}

export async function clearFilesInbox(): Promise<void> {
  const actor = await getActor();
  if (!actor?.isAdmin) return;
  await looseAdmin().from('vault_files').update({ inbox: false }).eq('inbox', true).eq('owner_id', actor.id);
}

export interface SuiteStatus {
  forms: { open: number; draft: number; newResponses: number };
  content: { posted: number; scheduled: number; drafts: number; lastPosted: string | null };
  /** `pending` leaves out to-dos whose date has passed; those are `overdue`. */
  todos: { pending: number; mine: number; overdue: number };
  /** Things that are not switched on yet. Each links to where it is set up. */
  setup: { id: string; label: string; hint: string; href: string }[];
}

/** One call for the overview: open forms, what has gone out online, pending to-dos and unfinished setup. */
export async function suiteStatus(): Promise<SuiteStatus> {
  const actor = await getActor();
  const empty: SuiteStatus = { forms: { open: 0, draft: 0, newResponses: 0 }, content: { posted: 0, scheduled: 0, drafts: 0, lastPosted: null }, todos: { pending: 0, mine: 0, overdue: 0 }, setup: [] };
  if (!actor?.isAdmin) return empty;
  const db = looseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const [forms, posts, todos, mail, drive, channels, ai, sig, counts] = await Promise.all([
    db.from('mjengo_forms').select('status'),
    db.from('mjengo_posts').select('status, posted_at'),
    db.from('mjengo_todos').select('status, due_date, assignee_ids'),
    db.from('mail_accounts').select('id', { count: 'exact', head: true }).eq('owner_id', actor.id),
    db.from('mjengo_drive_connections').select('owner_id', { count: 'exact', head: true }).eq('owner_id', actor.id),
    db.from('mjengo_channel_connections').select('id', { count: 'exact', head: true }),
    db.from('mjengo_ai_settings').select('provider, api_key_enc').eq('owner_id', actor.id).maybeSingle(),
    db.from('mail_signatures').select('html').eq('owner_id', actor.id).maybeSingle(),
    suiteCounts(),
  ]);
  const F = (forms.data ?? []) as { status: string }[];
  const P = (posts.data ?? []) as { status: string; posted_at: string | null }[];
  const T = (todos.data ?? []) as { status: string; due_date: string | null; assignee_ids: string[] | null }[];
  const notDone = T.filter((t) => t.status !== 'done');
  const pending = notDone.filter((t) => !t.due_date || t.due_date >= today);
  const aiRow = ai.data as { provider: string | null; api_key_enc: string | null } | null;

  const setup: SuiteStatus['setup'] = [];
  if (!mail.count && !drive.count) setup.push({ id: 'google', label: 'Connect your Google account', hint: 'Mail, calendar and files in one step.', href: `/api/mjengo/mail/oauth/google/start?choice=done&email=${encodeURIComponent(actor.email)}` });
  else {
    if (!mail.count) setup.push({ id: 'mail', label: 'Connect your mailbox', hint: 'Send and read email inside the suite.', href: '/dashboard/mjengo/mail' });
    else if (!(sig.data as { html?: string } | null)?.html) setup.push({ id: 'signature', label: 'Add an email signature', hint: 'It is added to every email you send.', href: '/dashboard/mjengo/mail' });
    if (!drive.count) setup.push({ id: 'drive', label: 'Connect Google Drive', hint: 'Keep Files and Drive in step.', href: '/dashboard/mjengo/vault' });
  }
  if (!channels.count) setup.push({ id: 'channels', label: 'Link your social accounts', hint: 'Needed to post content online.', href: '/dashboard/mjengo/design#schedule' });
  if (!aiRow?.api_key_enc && aiRow?.provider !== 'chatgpt') setup.push({ id: 'ai', label: 'Connect your own AI', hint: 'Lifts the free assistant limit.', href: '/dashboard/mjengo/assistant' });

  return {
    forms: { open: F.filter((f) => f.status === 'open').length, draft: F.filter((f) => f.status === 'draft').length, newResponses: counts.forms },
    content: {
      posted: P.filter((p) => p.status === 'posted').length,
      scheduled: P.filter((p) => p.status === 'scheduled').length,
      drafts: P.filter((p) => p.status === 'draft').length,
      lastPosted: P.filter((p) => p.status === 'posted' && p.posted_at).map((p) => p.posted_at as string).sort().pop() ?? null,
    },
    todos: { pending: pending.length, mine: pending.filter((t) => (t.assignee_ids ?? []).includes(actor.id)).length, overdue: notDone.length - pending.length },
    setup,
  };
}
