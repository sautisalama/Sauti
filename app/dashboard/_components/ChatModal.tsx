import { Dialog, DialogContent } from "@/components/ui/dialog";
import AppointmentChat from "@/app/dashboard/chat/_components/AppointmentChat";

interface ChatModalProps {
	isOpen: boolean;
	onClose: () => void;
	userId: string;
	username: string;
	appointmentId: string;
}

export function ChatModal({
	isOpen,
	onClose,
	userId,
	username,
	appointmentId,
}: ChatModalProps) {
	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="max-w-5xl h-[85vh] bg-white rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-2xl flex flex-col">
				<div className="h-full overflow-hidden">
					<AppointmentChat
						userId={userId}
						username={username}
						appointmentId={appointmentId}
					/>
				</div>
			</DialogContent>
		</Dialog>
	);
}
