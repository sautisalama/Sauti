'use server';

import { guard, type Result } from '@/lib/action-result';
import { requireAdminActor } from '@/lib/access/super-admin';
import { findStaleCases, type StaleCase } from '@/lib/cases/escalation';

/** Cases nobody has acted on for 24 hours, for the admin overview. Same rules as the daily email. */
export const listEscalatedCases: () => Promise<Result<StaleCase[]>> = guard(async () => {
	await requireAdminActor();
	const cases = await findStaleCases();
	// Longest-waiting and most urgent first, so the top of the list is what to do next.
	const rank = (u: string | null) => (u === 'high' ? 0 : u === 'medium' ? 1 : 2);
	return cases.sort((a, b) => rank(a.urgency) - rank(b.urgency) || b.hoursWaiting - a.hoursWaiting);
});
