import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { Database } from "@/types/db-schema";

/**
 * Creates a Supabase client with the service_role key.
 * USE ONLY in server-side API routes — never expose to the browser.
 * The service role bypasses Row Level Security (RLS).
 */
export function createAdminClient() {
  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceRoleKey =
    process.env.NEXT_PUBLIC_SERVICE_ROLE_KEY || process.env.SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Supabase admin env vars are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SERVICE_ROLE_KEY."
    );
  }

  return createSupabaseClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
