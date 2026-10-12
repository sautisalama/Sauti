'use server';

import { revalidatePath } from 'next/cache';
import { guard } from '@/lib/action-result';
import { requireAdminActor } from '@/lib/access/super-admin';
import { runVerification } from '@/lib/mjengo/opportunity-verify';
import { verifyOpportunityRow } from '@/lib/mjengo/opportunity-run';
import type { Verification } from '@/lib/mjengo/opportunity-types';

const todayNairobi = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Nairobi' }).format(new Date());

/**
 * Check where an opportunity really comes from. With an id the result is kept on the opportunity and its empty
 * fields are filled; without one (a new, unsaved opportunity) the result is only returned.
 */
export const verifyOpportunity = guard(async (input: { id?: string | null; url?: string; text?: string }): Promise<{ verification: Verification; filled: string[] }> => {
  await requireAdminActor();
  const url = (input.url ?? '').trim();
  const text = (input.text ?? '').trim();
  if (!input.id && !url && text.length < 20) throw new Error('Add a link, or paste the post text, to check it.');
  if (input.id) {
    const out = await verifyOpportunityRow(input.id, { url: url || undefined, text: text || undefined });
    revalidatePath('/dashboard/mjengo/opportunities');
    return out;
  }
  return { verification: await runVerification({ url: url || null, text, today: todayNairobi() }), filled: [] };
});
