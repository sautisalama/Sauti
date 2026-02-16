"use client";

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
} from "lucide-react";
import { useRoleSwitcher } from "@/hooks/useRoleSwitcher";

export function RoleSwitcher() {
	const { roleContext, isAdminMode, isLoading, switchToAdmin, switchToUser } = useRoleSwitcher();

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
			<DropdownMenuContent 
				align="end" 
				side="bottom"
				className="w-60 mb-2 ml-2 rounded-2xl border-serene-neutral-200 shadow-xl bg-white/95 backdrop-blur-xl animate-in fade-in zoom-in-95 duration-200"
			>
				<DropdownMenuLabel className="font-normal p-3 text-xs text-serene-neutral-500 uppercase tracking-wider">
					Switch Role
				</DropdownMenuLabel>
				<DropdownMenuSeparator className="bg-serene-neutral-100" />

				{!isAdminMode && (
					<DropdownMenuItem 
						onClick={switchToAdmin} 
						className="gap-3 cursor-pointer rounded-xl focus:bg-serene-neutral-50 focus:text-serene-blue-600 m-1 p-2"
					>
						<div className="h-8 w-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
							<Shield className="h-4 w-4" />
						</div>
						<div className="flex flex-col">
							<span className="font-semibold text-sm">Admin Mode</span>
							<span className="text-[10px] text-gray-500">
								Platform management
							</span>
						</div>
						<Badge variant="secondary" className="ml-auto text-[10px] bg-blue-50 text-blue-700 border-blue-100">
							Admin
						</Badge>
					</DropdownMenuItem>
				)}

				{isAdminMode && (
					<DropdownMenuItem 
						onClick={switchToUser} 
						className="gap-3 cursor-pointer rounded-xl focus:bg-serene-neutral-50 focus:text-serene-blue-600 m-1 p-2"
					>
						<div className="h-8 w-8 rounded-lg bg-gray-50 flex items-center justify-center text-gray-600">
							{getRoleIcon(roleContext.primary_role)}
						</div>
						<div className="flex flex-col">
							<span className="font-semibold text-sm">{getRoleLabel(roleContext.primary_role)} Mode</span>
							<span className="text-[10px] text-gray-500">Regular dashboard</span>
						</div>
						<Badge variant="outline" className="ml-auto text-[10px]">
							User
						</Badge>
					</DropdownMenuItem>
				)}

			</DropdownMenuContent>
		</DropdownMenu>
	);
}
