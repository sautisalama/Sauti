"use client";

import { useState } from "react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { AvatarUpdateDialog } from "./AvatarUpdateDialog";
//
interface UserAvatarProps {
	userId: string;
	avatarUrl?: string | null;
	className?: string;
}

export function UserAvatar({ userId, avatarUrl, className }: UserAvatarProps) {
	const [isDialogOpen, setIsDialogOpen] = useState(false);
	const [currentAvatarUrl, setCurrentAvatarUrl] = useState(avatarUrl);

	return (
		<>
			<Avatar
				className={`cursor-pointer ${className}`}
				onClick={() => setIsDialogOpen(true)}
			>
				<AvatarImage src={currentAvatarUrl || ""} />
				<AvatarFallback>{userId.slice(0, 2).toUpperCase()}</AvatarFallback>
			</Avatar>

			<AvatarUpdateDialog
				isOpen={isDialogOpen}
				onClose={() => setIsDialogOpen(false)}
				currentAvatarUrl={currentAvatarUrl}
				userId={userId}
				onAvatarUpdate={(newUrl) => setCurrentAvatarUrl(newUrl)}
			/>
		</>
	);
}
