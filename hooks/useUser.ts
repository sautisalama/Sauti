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
	const supabase = createClient();

	useEffect(() => {
		const getUser = async () => {
			// Get authenticated user
			const {
				data: { user: authUser },
			} = await supabase.auth.getUser();

			if (authUser) {
				// Fetch profile data
				const { data: profile } = await supabase
					.from("profiles")
					.select("*")
					.eq("id", authUser.id)
					.single();

				// Combine auth user with profile data
				setUser({ ...authUser, profile });
			} else {
				setUser(null);
			}
		};

		getUser();
	}, [supabase]);

	return user;
}
