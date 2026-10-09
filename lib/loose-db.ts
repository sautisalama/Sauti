import type { SupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/utils/supabase/admin-client';

/**
 * Service-role client without generated table types, for tables added after the last type
 * generation (invite codes, Mjengo, audit log...). Server-only: it bypasses RLS, so every caller
 * must check who is asking first.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function looseAdmin(): SupabaseClient<any, 'public', any> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createAdminClient() as unknown as SupabaseClient<any, 'public', any>;
}
