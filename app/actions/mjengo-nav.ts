'use server';

import { getActor, isSuperAdminEmail } from '@/lib/access/super-admin';
import { looseAdmin } from '@/lib/loose-db';

/** Which Mjengo sections the signed-in person sees in the side navigation. */
export async function mjengoNav(): Promise<{ isAdmin: boolean; isSuper: boolean }> {
  const actor = await getActor();
  if (!actor?.isAdmin) return { isAdmin: false, isSuper: false };
  return { isAdmin: true, isSuper: await isSuperAdminEmail(actor.email) };
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
