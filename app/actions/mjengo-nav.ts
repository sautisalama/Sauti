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
}

/** Small numbers shown on navigation items. Never throws: a missing count is just zero. */
export async function suiteCounts(): Promise<SuiteCounts> {
  const actor = await getActor();
  if (!actor?.isAdmin) return { opportunities: 0, files: 0, notifications: 0 };
  const db = looseAdmin();
  const [o, f, n] = await Promise.all([
    db.from('mjengo_opportunities').select('id', { count: 'exact', head: true }).eq('inbox', true),
    db.from('vault_files').select('id', { count: 'exact', head: true }).eq('inbox', true).eq('owner_id', actor.id),
    db.from('notifications').select('id', { count: 'exact', head: true }).eq('user_id', actor.id).eq('read', false).like('link', '/dashboard/mjengo%'),
  ]);
  return { opportunities: o.count ?? 0, files: f.count ?? 0, notifications: n.count ?? 0 };
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
