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
				const { data: profile } = await supabase
					.from("profiles")
					.select("*")
					.eq("id", authUser.id)
					.single();

				if (cancelled) return;
				// Combine auth user with profile data
				setUser({ ...authUser, profile });
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
