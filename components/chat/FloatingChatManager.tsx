"use client";

import { useState } from "react";
import { CaseChatPanel } from "@/components/chat/CaseChatPanel";
import { X, Minus, MessageCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface FloatingChat {
	id: string; // unique key (matchId)
	matchId: string;
	survivorId: string;
	professionalId: string;
	professionalName: string;
	survivorName: string;
	existingChatId?: string;
}

interface FloatingChatManagerProps {
	chats: FloatingChat[];
	onClose: (id: string) => void;
}

/**
 * LinkedIn-style floating chat manager.
 * Renders multiple minimizable chat windows pinned to the bottom-right.
 */
export function FloatingChatManager({ chats, onClose }: FloatingChatManagerProps) {
	const [minimized, setMinimized] = useState<Set<string>>(new Set());

	const toggleMinimize = (id: string) => {
		setMinimized((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	};

	if (chats.length === 0) return null;

	return (
		<div className="fixed bottom-0 right-4 lg:right-6 z-[60] flex items-end gap-3 pointer-events-none">
			{chats.map((chat, idx) => {
				const isMin = minimized.has(chat.id);

				return (
					<div
						key={chat.id}
						className={cn(
							"pointer-events-auto flex flex-col bg-white rounded-t-xl border border-serene-neutral-200 shadow-2xl transition-all duration-300 overflow-hidden",
							isMin ? "w-64 h-12" : "w-80 sm:w-96 h-[480px]"
						)}
						style={{ maxHeight: "calc(100vh - 80px)" }}
					>
						{/* Chat header — always visible */}
						<div
							className="flex items-center justify-between px-3 py-2.5 bg-sauti-dark text-white cursor-pointer select-none shrink-0"
							onClick={() => toggleMinimize(chat.id)}
						>
							<div className="flex items-center gap-2 min-w-0 flex-1">
								<div className="w-2 h-2 rounded-full bg-serene-green-400 shrink-0" />
								<span className="text-sm font-semibold truncate">
									{chat.professionalName || "Support Chat"}
								</span>
							</div>
							<div className="flex items-center gap-1">
								<button
									onClick={(e) => {
										e.stopPropagation();
										toggleMinimize(chat.id);
									}}
									className="p-1 rounded hover:bg-white/10 transition-colors"
									title={isMin ? "Expand" : "Minimize"}
								>
									{isMin ? (
										<MessageCircle className="h-3.5 w-3.5" />
									) : (
										<Minus className="h-3.5 w-3.5" />
									)}
								</button>
								<button
									onClick={(e) => {
										e.stopPropagation();
										onClose(chat.id);
									}}
									className="p-1 rounded hover:bg-white/10 transition-colors"
									title="Close"
								>
									<X className="h-3.5 w-3.5" />
								</button>
							</div>
						</div>

						{/* Chat body — hidden when minimized */}
						{!isMin && (
							<div className="flex-1 overflow-hidden">
								<CaseChatPanel
									matchId={chat.matchId}
									survivorId={chat.survivorId}
									professionalId={chat.professionalId}
									professionalName={chat.professionalName}
									survivorName={chat.survivorName}
									existingChatId={chat.existingChatId}
									className="h-full border-0 rounded-none shadow-none"
								/>
							</div>
						)}
					</div>
				);
			})}
		</div>
	);
}
