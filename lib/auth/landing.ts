import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Cookie remembering which area THIS person was last working in (set by SuiteTracker). It is stored
 * per user, so a different person signing in on the same device is never sent there.
 */
export const suiteCookie = (userId: string) => `ss_suite_${userId}`;

/**
 * Where to send someone right after they sign in: the page they asked for, else the suite they were
 * last in (Mjengo or Admin, only if they are still an admin), else the dashboard.
 */
export async function landingFor(supabase: SupabaseClient, userId: string, next?: string | null): Promise<string> {
  if (next) return next;
  if (!userId) return '/dashboard';
  const mode = (await cookies()).get(suiteCookie(userId))?.value;
  if (mode !== 'admin' && mode !== 'mjengo') return '/dashboard';
  const { data } = await supabase.from('profiles').select('is_admin, is_banned').eq('id', userId).maybeSingle();
  if (!data?.is_admin || data.is_banned) return '/dashboard';
  return mode === 'mjengo' ? '/dashboard/mjengo' : '/dashboard/admin';
}
