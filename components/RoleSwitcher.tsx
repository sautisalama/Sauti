"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Shield,
	User,
	Building2,
	ChevronDown,
	CheckCircle,
	Settings,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { UserRoleContext } from "@/types/admin-types";

export function RoleSwitcher() {
	const [roleContext, setRoleContext] = useState<UserRoleContext | null>(null);
	const [isLoading, setIsLoading] = useState(true);
	const [isAdminMode, setIsAdminMode] = useState(false);
	const supabase = createClient();
	const router = useRouter();
	const { toast } = useToast();

	useEffect(() => {
		loadRoleContext();
	}, []);

	const loadRoleContext = async () => {
		try {
			const {
				data: { user },
			} = await supabase.auth.getUser();
			if (!user) return;

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

	const getRoleIcon = (userType: string) => {
		switch (userType) {
			case "professional":
				return <User className="h-4 w-4" />;
			case "ngo":
				return <Building2 className="h-4 w-4" />;
			case "survivor":
				return <User className="h-4 w-4" />;
			default:
				return <User className="h-4 w-4" />;
		}
	};

	const getRoleLabel = (userType: string) => {
		switch (userType) {
			case "professional":
				return "Professional";
			case "ngo":
				return "NGO";
			case "survivor":
				return "Survivor";
			default:
				return "User";
		}
	};

	if (isLoading || !roleContext) {
		return null;
	}

	// Don't show role switcher if user is not admin
	if (!roleContext.is_admin) {
		return null;
	}

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" className="gap-2">
					{isAdminMode ? (
						<>
							<Shield className="h-4 w-4 text-blue-600" />
							Admin Mode
						</>
					) : (
						<>
							{getRoleIcon(roleContext.primary_role)}
							{getRoleLabel(roleContext.primary_role)}
						</>
					)}
					<ChevronDown className="h-4 w-4" />
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56 bg-white">
				<DropdownMenuLabel>Switch Role</DropdownMenuLabel>
				<DropdownMenuSeparator />

				{!isAdminMode && (
					<DropdownMenuItem onClick={switchToAdmin} className="gap-2">
						<Shield className="h-4 w-4 text-blue-600" />
						<div className="flex flex-col">
							<span>Admin Mode</span>
							<span className="text-xs text-gray-500">
								Manage verifications & platform
							</span>
						</div>
						<Badge variant="secondary" className="ml-auto text-xs">
							Admin
						</Badge>
					</DropdownMenuItem>
				)}

				{isAdminMode && (
					<DropdownMenuItem onClick={switchToUser} className="gap-2">
						{getRoleIcon(roleContext.primary_role)}
						<div className="flex flex-col">
							<span>{getRoleLabel(roleContext.primary_role)} Mode</span>
							<span className="text-xs text-gray-500">Your regular dashboard</span>
						</div>
						<Badge variant="outline" className="ml-auto text-xs">
							User
						</Badge>
					</DropdownMenuItem>
				)}

				<DropdownMenuSeparator />

				<DropdownMenuItem
					onClick={() => router.push("/dashboard/settings")}
					className="gap-2"
				>
					<Settings className="h-4 w-4" />
					Settings
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
