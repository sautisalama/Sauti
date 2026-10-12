'use server';

import { guard } from '@/lib/action-result';
import { requireAdminActor } from '@/lib/access/super-admin';

/** Only this account is shown the shared AI credit balance. */
const WATCHER = 'oliver@sautisalama.org';

export interface OpenRouterBalance {
  /** Dollars left, or null when the key has no fixed credit view. */
  remaining: number | null;
  used: number | null;
  total: number | null;
  exhausted: boolean;
  low: boolean;
}

export const openRouterBalance = guard(async (): Promise<OpenRouterBalance | null> => {
  const actor = await requireAdminActor();
  if (actor.email?.toLowerCase() !== WATCHER) return null;
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OpenRouter is not connected.');
  const headers = { Authorization: `Bearer ${key}` };
  let remaining: number | null = null;
  let used: number | null = null;
  let total: number | null = null;

  // Account credit: purchased minus used.
  const credits = await fetch('https://openrouter.ai/api/v1/credits', { headers, cache: 'no-store', signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (credits?.ok) {
    const j = (await credits.json()) as { data?: { total_credits?: number; total_usage?: number } };
    if (typeof j.data?.total_credits === 'number' && typeof j.data?.total_usage === 'number') {
      total = j.data.total_credits;
      used = j.data.total_usage;
      remaining = total - used;
    }
  }
  // This key's own spending limit, if one is set, can run out first.
  const info = await fetch('https://openrouter.ai/api/v1/auth/key', { headers, cache: 'no-store', signal: AbortSignal.timeout(10_000) }).catch(() => null);
  if (info?.ok) {
    const j = (await info.json()) as { data?: { limit_remaining?: number | null; usage?: number; limit?: number | null } };
    const lr = j.data?.limit_remaining;
    if (typeof lr === 'number' && (remaining === null || lr < remaining)) {
      remaining = lr;
      used = j.data?.usage ?? used;
      total = j.data?.limit ?? total;
    } else if (remaining === null && typeof j.data?.usage === 'number') {
      used = j.data.usage;
    }
  }
  if (remaining === null && used === null) throw new Error('Could not read the OpenRouter balance.');
  return { remaining, used, total, exhausted: remaining !== null && remaining <= 0.05, low: remaining !== null && remaining < 2 };
});
