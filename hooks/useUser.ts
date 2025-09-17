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
			// Get authenticated user
			const {
				data: { user: authUser },
			} = await supabase.auth.getUser();

			if (cancelled) return;
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
					setUser({ ...authUser, profile: newProfile });
				} else {
					// Combine auth user with profile data
					setUser({ ...authUser, profile });
				}
			} else {
				setUser(null);
			}
		};

		getUser();
		return () => {
			cancelled = true;
		};
	}, []);

	return user;
}
