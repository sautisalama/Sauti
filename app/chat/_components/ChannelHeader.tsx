"use client";

import { useChannelStateContext } from "stream-chat-react";
import { Button } from "@/components/ui/button";
import { Users } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export function ChannelHeader() {
	const { channel } = useChannelStateContext();
	const [showMembers, setShowMembers] = useState(false);

	const onlineMembers = channel?.state.watcher_count || 0;
	const totalMembers = channel?.state.members
		? Object.keys(channel.state.members).length
		: 0;

	return (
		<div className="px-4 py-3 border-b flex items-center justify-between">
			<div className="flex items-center gap-3">
				<Avatar className="h-10 w-10">
					<AvatarImage src={channel?.data?.image} />
					<AvatarFallback>
						{channel?.data?.name?.[0]?.toUpperCase() || "C"}
					</AvatarFallback>
				</Avatar>
				<div>
					<h3 className="font-semibold">{channel?.data?.name}</h3>
					<p className="text-sm text-muted-foreground">
						{onlineMembers} online • {totalMembers} members
					</p>
				</div>
			</div>

			<div className="flex items-center gap-2">
				<Dialog open={showMembers} onOpenChange={setShowMembers}>
					<DialogTrigger asChild>
						<Button variant="ghost" size="icon">
							<Users className="h-5 w-5" />
						</Button>
					</DialogTrigger>
					<DialogContent>
						<DialogHeader>
							<DialogTitle>Channel Members</DialogTitle>
						</DialogHeader>
						<div className="mt-4 space-y-3">
							{Object.values(channel?.state.members || {}).map((member) => (
								<div key={member.user_id} className="flex items-center gap-3">
									<Avatar className="h-8 w-8">
										<AvatarImage src={member.user?.image} />
										<AvatarFallback>
											{member.user?.name?.[0]?.toUpperCase() || "U"}
										</AvatarFallback>
									</Avatar>
									<div>
										<p className="font-medium">{member.user?.name}</p>
										<p className="text-sm text-muted-foreground">
											{channel?.state.watchers[member.user_id!] ? "Online" : "Offline"}
										</p>
									</div>
								</div>
							))}
						</div>
					</DialogContent>
				</Dialog>
			</div>
		</div>
	);
}
