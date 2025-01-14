"use client";

import { useState, useEffect } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AvatarUpdateDialog } from "./AvatarUpdateDialog";
import { createClient } from "@/utils/supabase/client";

interface UserAvatarProps {
	userId: string;
	email?: string;
}

export function UserAvatar({ userId, email }: UserAvatarProps) {
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
	const supabase = createClient();

	useEffect(() => {
		async function fetchAvatarUrl() {
			const { data, error } = await supabase
				.from("profiles")
				.select("avatar_url")
				.eq("id", userId)
				.single();
			
			if (!error && data) {
				setAvatarUrl(data.avatar_url);
			}
		}

		fetchAvatarUrl();
	}, [userId, supabase]);

	return (
		<>
			<Avatar
				className="h-8 w-8 bg-gradient-to-br from-emerald-400 via-teal-400 to-cyan-400 cursor-pointer"
				onClick={() => setIsDialogOpen(true)}
			>
				<AvatarImage src={avatarUrl || ""} alt={userId || "User avatar"} />
				<AvatarFallback className="text-white font-medium bg-gradient-to-br from-purple-400 via-fuchsia-400 to-pink-400">
					{email?.toUpperCase()?.[0] || "?"}
				</AvatarFallback>
			</Avatar>

			<AvatarUpdateDialog
				isOpen={isDialogOpen}
				onClose={() => setIsDialogOpen(false)}
				userId={userId}
				email={email}
				onAvatarUpdate={setAvatarUrl}
			/>
		</>
	);
}
