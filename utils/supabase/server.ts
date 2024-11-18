import { Database, Tables } from "@/types/db-schema";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Session, User } from "@supabase/supabase-js";

export function createClient() {
	const cookieStore = cookies();

	return createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				getAll() {
					return cookieStore.getAll();
				},
				setAll(cookiesToSet) {
					try {
						cookiesToSet.forEach(({ name, value, options }) =>
							cookieStore.set(name, value, options)
						);
					} catch {
						// The `setAll` method was called from a Server Component.
						// This can be ignored if you have middleware refreshing
						// user sessions.
					}
				},
			},
		}
	);
}

export async function getSession(): Promise<Session | null> {
	const supabase = createClient();
	try {
		const {
			data: { session },
			error,
		} = await supabase.auth.getSession();
		if (error) throw error;
		return session;
	} catch (error) {
		console.error("Failed to get session:", error);
		return null;
	}
}

export async function getUser(): Promise<Tables<"profiles"> | null> {
	const supabase = createClient();
	try {
		const session = await getSession();
		console.log("session", session);
		if (!session?.user?.id) return null;

		const { data, error } = await supabase
			.from("profiles")
			.select("*")
			.eq("id", session.user.id)
			.single();

		if (error) throw error;
		return data;
	} catch (error) {
		console.error("Failed to get user profile:", error);
		return null;
	}
}
