import { Database, Tables } from "@/types/db-schema";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { Session } from "@supabase/supabase-js";

export async function createClient() {
	const cookieStore = cookies();

	const supabaseUrl =
		process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
	const supabaseAnonKey =
		process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
	if (!supabaseUrl || !supabaseAnonKey) {
		console.error(
			"Supabase env vars are missing. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_URL and SUPABASE_ANON_KEY) in your Vercel project."
		);
		throw new Error("Supabase configuration missing");
	}

	return createServerClient(supabaseUrl, supabaseAnonKey, {
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
	});
}

export async function getSession(): Promise<Session | null> {
	const supabase = await createClient();
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
	const supabase = await createClient();
	try {
		const {
			data: { user },
			error: userError,
		} = await supabase.auth.getUser();
		if (userError || !user?.id) return null;

		// First try to get existing profile
		const { data, error } = await supabase
			.from("profiles")
			.select("*")
			.eq("id", user.id)
			.single();

		// If profile exists, return it
		if (data && !error) {
			return data;
		}

		// If profile doesn't exist, create one
		if (error && error.code === "PGRST116") {
			console.log("Profile not found, creating new profile for user:", user.id);

			const { data: newProfile, error: createError } = await supabase
				.from("profiles")
				.insert({
					id: user.id,
					email: user.email,
					first_name: user.user_metadata?.first_name || "",
					last_name: user.user_metadata?.last_name || "",
					user_type: user.user_metadata?.user_type || "survivor",
					verification_status: "pending",
					accreditation_files_metadata: "[]",
					profile_image_metadata: "{}",
					verification_notes: null,
					last_verification_check: null,
					created_at: new Date().toISOString(),
					updated_at: new Date().toISOString(),
				})
				.select("*")
				.single();

			if (createError) {
				console.error("Failed to create user profile:", createError);
				return null;
			}

			return newProfile;
		}

		// If it's a different error, throw it
		if (error) throw error;
		return null;
	} catch (error) {
		console.error("Failed to get user profile:", error);
		return null;
	}
}
