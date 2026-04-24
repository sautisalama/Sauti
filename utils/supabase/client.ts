import { Database } from '@/types/db-schema'
import { createBrowserClient } from '@supabase/ssr'

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createClient() {
	if (client) return client;

	client = createBrowserClient<Database>(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
	);

	return client;
}

