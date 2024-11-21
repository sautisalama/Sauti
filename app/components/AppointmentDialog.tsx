import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogFooter,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { createClient } from "@/utils/supabase/client";

interface AppointmentDialogProps {
	isOpen: boolean;
	onClose: () => void;
	matchId: string;
	reportId: string;
	professionalId: string;
	onSuccess: () => void;
}

export default function AppointmentDialog({
	isOpen,
	onClose,
	matchId,
	reportId,
	professionalId,
	onSuccess,
}: AppointmentDialogProps) {
	const [date, setDate] = useState<Date | undefined>(undefined);
	const [isSubmitting, setIsSubmitting] = useState(false);
	const supabase = createClient();

	const handleSubmit = async () => {
		if (!date) return;

		setIsSubmitting(true);
		try {
			const response = await fetch("/api/appointments", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					matchId,
					date: date.toISOString(),
					professionalId,
					reportId,
				}),
			});

			if (!response.ok) {
				throw new Error("Failed to create appointment");
			}

			onSuccess();
			onClose();
		} catch (error) {
			console.error("Error setting appointment:", error);
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Set Appointment Date</DialogTitle>
					<DialogDescription>
						Choose a date for the appointment with the survivor.
					</DialogDescription>
				</DialogHeader>
				<div className="py-4">
					<Calendar
						mode="single"
						selected={date}
						onSelect={setDate}
						disabled={(date) => date < new Date()}
					/>
				</div>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancel
					</Button>
					<Button onClick={handleSubmit} disabled={!date || isSubmitting}>
						Confirm Appointment
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
