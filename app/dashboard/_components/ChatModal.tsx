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
			<DialogContent className="max-w-4xl h-[80vh] overflow-hidden">
				<div className="h-full pt-2 overflow-hidden">
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
