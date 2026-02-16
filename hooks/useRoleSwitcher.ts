import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { UserRoleContext } from "@/types/admin-types";

export function useRoleSwitcher() {
	const [roleContext, setRoleContext] = useState<UserRoleContext | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isAdminMode, setIsAdminMode] = useState(false);
	const supabase = createClient();
	const router = useRouter();
	const { toast } = useToast();

	useEffect(() => {
		loadRoleContext();
	}, []);

	// Listen for changes from other components/tabs
	useEffect(() => {
		const handleStorageChange = () => {
			const adminMode = localStorage.getItem("adminMode") === "true";
			setIsAdminMode(adminMode);
		};
		
		window.addEventListener("storage", handleStorageChange);
		window.addEventListener("adminModeChanged", handleStorageChange);
		
		return () => {
			window.removeEventListener("storage", handleStorageChange);
			window.removeEventListener("adminModeChanged", handleStorageChange);
		};
	}, []);

	const loadRoleContext = async () => {
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) {
				setIsLoading(false);
				return;
			}

			// Check if user is in admin mode (stored in localStorage)
			const adminMode = localStorage.getItem("adminMode") === "true";
			setIsAdminMode(adminMode);

			const { data, error } = await supabase.rpc("get_user_role_context", {
				target_user_id: user.id,
			});

			if (error) throw error;
			setRoleContext(data?.[0] || null);
		} catch (error) {
			console.error("Error loading role context:", error);
		} finally {
			setIsLoading(false);
		}
	};

	const switchToAdmin = () => {
		if (!roleContext?.can_switch_to_admin) return;

		localStorage.setItem("adminMode", "true");
		setIsAdminMode(true);
		window.dispatchEvent(new Event("adminModeChanged")); // Notify listeners
		router.push("/dashboard/admin");

		toast({
			title: "Switched to Admin Mode",
			description: "You are now viewing the admin dashboard",
		});
	};

	const switchToUser = () => {
		localStorage.setItem("adminMode", "false");
		setIsAdminMode(false);
		window.dispatchEvent(new Event("adminModeChanged")); // Notify listeners
		router.push("/dashboard");

		toast({
			title: "Switched to User Mode",
			description: "You are now viewing your regular dashboard",
		});
	};

	return {
		roleContext,
		isAdminMode,
		isLoading,
		switchToAdmin,
		switchToUser
	};
}
