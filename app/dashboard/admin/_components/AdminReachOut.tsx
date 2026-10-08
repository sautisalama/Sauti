"use client";

import { useState } from "react";
import { BellRing, Loader2, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { CaseChatPanel } from "@/components/chat/CaseChatPanel";
import { useToast } from "@/hooks/use-toast";
import { openAdminChat, remindToUploadDocuments } from "@/app/actions/admin-actions";

export type ReminderTarget = { id: string; type: "profile" | "service" };
export type ChatTarget = { profileId: string; name: string; role?: string | null };

/** Shown instead of Verify / Reject while nothing has been uploaded: verification is only done against documents. */
export function RemindDocumentsButton({ target, size = "default", className }: { target: ReminderTarget; size?: "default" | "sm"; className?: string }) {
	const { toast } = useToast();
	const [busy, setBusy] = useState(false);
	const [sent, setSent] = useState(false);

	const send = async () => {
		setBusy(true);
		try {
			await remindToUploadDocuments(target.type, target.id);
			setSent(true);
			toast({ title: "Reminder sent", description: "They have been emailed and notified in the app." });
		} catch (e) {
			toast({ title: "Could not send the reminder", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
		} finally {
			setBusy(false);
		}
	};

	return (
		<div className={`flex flex-col items-stretch gap-2 rounded-xl border border-amber-200 bg-amber-50/60 p-3 sm:flex-row sm:items-center sm:gap-4 ${className || ""}`}>
			<p className="flex-1 text-xs font-medium leading-snug text-amber-800">No documents uploaded yet. Verification is only done against documents.</p>
			<Button size={size} variant="outline" onClick={send} disabled={busy || sent} className="shrink-0 justify-center border-amber-300 bg-white text-amber-800 hover:bg-amber-100">
				{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <BellRing className="mr-2 h-4 w-4" />}
				{sent ? "Reminder sent" : "Remind to upload documents"}
			</Button>
		</div>
	);
}

/** Opens the admin's direct chat with the professional. The same chat is in both people's chat lists. */
export function MessageProfessionalButton({ chat, size = "default", fullWidth = false }: { chat: ChatTarget; size?: "default" | "sm"; fullWidth?: boolean }) {
	const { toast } = useToast();
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [chatId, setChatId] = useState<string | null>(null);

	const start = async () => {
		if (chatId) return setOpen(true);
		setBusy(true);
		try {
			setChatId(await openAdminChat(chat.profileId));
			setOpen(true);
		} catch (e) {
			toast({ title: "Could not open the chat", description: e instanceof Error ? e.message : "Try again.", variant: "destructive" });
		} finally {
			setBusy(false);
		}
	};

	return (
		<>
			<Button size={size} variant="outline" onClick={start} disabled={busy} className={`border-serene-neutral-200 shadow-sm ${fullWidth ? "h-11 w-full justify-center rounded-xl" : ""}`}>
				{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <MessageSquare className="mr-2 h-4 w-4" />}
				Message
			</Button>
			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="h-[80vh] max-w-xl gap-0 overflow-hidden p-0">
					<DialogTitle className="sr-only">Chat with {chat.name}</DialogTitle>
					<DialogDescription className="sr-only">Direct conversation with {chat.name}. It is also in the chat list.</DialogDescription>
					{chatId && (
						<CaseChatPanel
							matchId={chatId}
							existingChatId={chatId}
							survivorId=""
							professionalId={chat.profileId}
							professionalName={chat.name}
							professionalType={chat.role || "Professional"}
							survivorName="Sauti Salama"
							className="h-full"
							onClose={() => setOpen(false)}
						/>
					)}
				</DialogContent>
			</Dialog>
		</>
	);
}
