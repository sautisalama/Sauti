import { Database, Tables } from "@/types/db-schema";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Session, User } from "@supabase/supabase-js";

export function createClient() {
	const cookieStore = cookies();

	return createServerClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL!,
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
		{
			cookies: {
				get(name: string) {
					return cookieStore.get(name)?.value;
				},
				set(name: string, value: string, options: any) {
					try {
						cookieStore.set(name, value, options);
					} catch (error) {
						// Handle cookie setting error in server component
					}
				},
				remove(name: string) {
					try {
						cookieStore.delete(name);
					} catch (error) {
						// Handle cookie removal error in server component
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
		const {
			data: { user },
			error: userError,
		} = await supabase.auth.getUser();
		if (userError || !user?.id) return null;

		const { data, error } = await supabase
			.from("profiles")
			.select("*")
			.eq("id", user.id)
			.single();

		if (error) throw error;
		return data;
	} catch (error) {
		console.error("Failed to get user profile:", error);
		return null;
	}
}
