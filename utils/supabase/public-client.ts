import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db-schema";

/**
 * Cookie-less anon client for public, cacheable reads (published content).
 * Using the cookie-bound client on these pages would force every request to
 * render dynamically; RLS already limits anon to published rows.
 */
export function createPublicClient() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
	if (!url || !key) throw new Error("Supabase env vars are missing");
	return createClient<Database>(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}
