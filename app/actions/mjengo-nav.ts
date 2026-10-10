'use server';

import { getActor, isSuperAdminEmail } from '@/lib/access/super-admin';

/** Which Mjengo sections the signed-in person sees in the side navigation. */
export async function mjengoNav(): Promise<{ isAdmin: boolean; isSuper: boolean }> {
  const actor = await getActor();
  if (!actor?.isAdmin) return { isAdmin: false, isSuper: false };
  return { isAdmin: true, isSuper: await isSuperAdminEmail(actor.email) };
}
