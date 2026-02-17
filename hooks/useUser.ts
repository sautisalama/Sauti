"use client";
import { useEffect, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { User } from "@supabase/supabase-js";
import { Tables } from "@/types/db-schema";

// Create a type that combines auth User with profile data
type UserWithProfile = User & {
	profile?: Tables<"profiles">;
};

export function useUser() {
	const [user, setUser] = useState<UserWithProfile | null>(null);

	useEffect(() => {
		const supabase = createClient();
		let cancelled = false;
		const getUser = async () => {
			try {
				// Get authenticated user
				const {
					data: { user: authUser },
                                        error: authError
				} = await supabase.auth.getUser();

				if (cancelled) return;
                                if (authError) throw authError;

				if (authUser) {
					// Fetch profile data
					const { data: profile, error } = await supabase
						.from("profiles")
						.select("*")
						.eq("id", authUser.id)
						.single();

					if (cancelled) return;

					// If profile doesn't exist, create one
					if (error && error.code === "PGRST116") {
						console.log(
							"Profile not found, creating new profile for user:",
							authUser.id
						);

						const { data: newProfile } = await supabase
							.from("profiles")
							.insert({
								id: authUser.id,
								email: authUser.email,
								first_name: authUser.user_metadata?.first_name || "",
								last_name: authUser.user_metadata?.last_name || "",
								user_type: authUser.user_metadata?.user_type || "survivor",
								is_anonymous: authUser.user_metadata?.is_anonymous || false,
								anon_username: authUser.user_metadata?.anon_username || null,
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

						// Combine auth user with profile data
						if (!cancelled) setUser({ ...authUser, profile: newProfile });
					} else {
						// Combine auth user with profile data
						if (!cancelled) setUser({ ...authUser, profile });
					}
				} else {
					if (!cancelled) setUser(null);
				}
			} catch (error: any) {
				if (cancelled) return;
				// Ignore abort errors
				if (error.name === 'AbortError' || error.message?.includes('aborted')) return;
				console.error("Error loading user:", error);
			}
		};

		getUser();
		return () => {
			cancelled = true;
		};
	}, []);

	return user;
}
