"use client";

import { useState, useEffect } from "react";
import { streamClient } from "@/utils/stream-chat";
import { createClient } from "@/utils/supabase/client";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface NewChatDialogProps {
	open: boolean;
	onClose: () => void;
	userId: string;
}

export default function NewChatDialog({
	open,
	onClose,
	userId,
}: NewChatDialogProps) {
	const [users, setUsers] = useState<any[]>([]);
	const supabase = createClient();

	useEffect(() => {
		const fetchUsers = async () => {
			const { data } = await supabase
				.from("profiles")
				.select("*")
				.neq("id", userId);

			if (data) {
				setUsers(data);
			}
		};

		if (open) {
			fetchUsers();
		}
	}, [open, userId]);

	const startChat = async (otherUser: any) => {
		try {
			const channelId = [userId, otherUser.id].sort().join("-");
			const channel = streamClient.channel("messaging", channelId, {
				members: [userId, otherUser.id],
				name: `Chat with ${otherUser.name}`,
			});

			await channel.watch();
			onClose();
		} catch (error) {
			console.error("Error starting chat:", error);
		}
	};

	return (
		<Dialog open={open} onOpenChange={onClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Start a New Chat</DialogTitle>
				</DialogHeader>
				<div className="space-y-4 mt-4">
					{users.map((user) => (
						<div
							key={user.id}
							className="flex items-center justify-between p-2 hover:bg-muted/50 rounded-lg cursor-pointer"
							onClick={() => startChat(user)}
						>
							<div className="flex items-center gap-3">
								<Avatar>
									<AvatarImage src={user.avatar_url} />
									<AvatarFallback>{user.name?.charAt(0) || "U"}</AvatarFallback>
								</Avatar>
								<div>
									<p className="font-medium">{user.name}</p>
									<p className="text-sm text-muted-foreground">{user.email}</p>
								</div>
							</div>
							<Button variant="ghost" size="sm">
								Chat
							</Button>
						</div>
					))}
				</div>
			</DialogContent>
		</Dialog>
	);
}
