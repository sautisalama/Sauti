"use client";

import { useState } from "react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar as UIDateCalendar } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { CalendarDays, Clock, RotateCcw, Info } from "lucide-react";
import { AppointmentWithDetails } from "../_types";
import { rescheduleAppointment } from "../_views/actions/appointments";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

interface RescheduleModalProps {
	isOpen: boolean;
	onClose: () => void;
	appointment: AppointmentWithDetails;
	onReschedule: () => void;
}

export function RescheduleModal({
	isOpen,
	onClose,
	appointment,
	onReschedule,
}: RescheduleModalProps) {
	const [selectedDate, setSelectedDate] = useState<Date | undefined>(
		appointment.appointment_date
			? new Date(appointment.appointment_date)
			: undefined
	);
	const [selectedTime, setSelectedTime] = useState<string>(
		appointment.appointment_date
			? format(new Date(appointment.appointment_date), "HH:mm")
			: ""
	);
	const [notes, setNotes] = useState("");
	const [isUpdating, setIsUpdating] = useState(false);
	const { toast } = useToast();

	const handleReschedule = async () => {
		if (!selectedDate || !selectedTime) {
			toast({
				title: "Error",
				description: "Please select both date and time",
				variant: "destructive",
			});
			return;
		}

		try {
			setIsUpdating(true);

			// Create new appointment date
			const [hours, minutes] = selectedTime.split(":").map(Number);
			const newAppointmentDate = new Date(selectedDate);
			newAppointmentDate.setHours(hours, minutes, 0, 0);

			// Update appointment via server action
			await rescheduleAppointment(
				appointment.appointment_id,
				newAppointmentDate.toISOString(),
				notes || "Rescheduled requested by user"
			);

			toast({
				title: "Successfully Rescheduled",
				description: "The other party has been notified via email and app.",
			});

			onReschedule();
			onClose();
		} catch (error) {
			console.error("Error rescheduling appointment:", error);
			toast({
				title: "Error",
				description: "Failed to reschedule appointment. Please try again.",
				variant: "destructive",
			});
		} finally {
			setIsUpdating(false);
		}
	};

	const timeSlots = [
		"08:00", "08:30",
		"09:00", "09:30",
		"10:00", "10:30",
		"11:00", "11:30",
		"12:00", "12:30",
		"13:00", "13:30",
		"14:00", "14:30",
		"15:00", "15:30",
		"16:00", "16:30",
		"17:00", "17:30",
		"18:00", "18:30",
	];

	const professionalAvailability = appointment.matched_service?.service_details?.availability;

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-md bg-white rounded-2xl sm:rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-2xl">
				<div className="p-8 pb-0 border-b border-slate-50">
					<DialogHeader>
						<DialogTitle className="text-2xl font-bold flex items-center gap-3 text-slate-900">
							<RotateCcw className="h-6 w-6 text-teal-600" />
							Reschedule Option
						</DialogTitle>
						<DialogDescription className="text-slate-500 font-medium leading-relaxed mt-2">
							Choose a new time for your support session and we will notify the participants automatically.
						</DialogDescription>
					</DialogHeader>
				</div>

				<div className="p-8 space-y-6">

				<div className="space-y-6 py-2">
					{/* Professional Availability Banner */}
					{professionalAvailability && (
						<div className="bg-teal-50/50 border border-teal-100 rounded-xl p-3 flex gap-3 text-sm">
							<Info className="h-5 w-5 text-teal-600 shrink-0" />
							<div className="text-teal-900 leading-snug">
								<span className="font-bold">Provider Availability:</span> {professionalAvailability}
							</div>
						</div>
					)}

					<div className="grid grid-cols-2 gap-4">
						{/* Date Selection */}
						<div className="space-y-2 col-span-2">
							<Label htmlFor="date" className="font-bold text-slate-700">Select Date</Label>
							<Popover>
								<PopoverTrigger asChild>
									<Button
										variant="outline"
										className="w-full justify-start text-left font-normal h-12 rounded-xl"
									>
										<CalendarDays className="mr-2 h-4 w-4 text-slate-400" />
										{selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-auto p-0 rounded-2xl" align="start">
									<UIDateCalendar
										mode="single"
										selected={selectedDate}
										onSelect={setSelectedDate}
										disabled={(date) => date < new Date()}
										initialFocus
									/>
								</PopoverContent>
							</Popover>
						</div>

						{/* Time Selection */}
						<div className="space-y-2 col-span-2">
							<Label htmlFor="time" className="font-bold text-slate-700">Select Time</Label>
							<div className="grid grid-cols-4 sm:grid-cols-5 gap-2 max-h-40 overflow-y-auto pr-1">
								{timeSlots.map((time) => (
									<Button
										key={time}
										variant={selectedTime === time ? "default" : "outline"}
										size="sm"
										onClick={() => setSelectedTime(time)}
										className={selectedTime === time ? "bg-teal-600 hover:bg-teal-700 font-bold" : "text-xs font-medium text-slate-600"}
									>
										{format(new Date(`2000-01-01T${time}`), "h:mm a")}
									</Button>
								))}
							</div>
						</div>

						{/* Reason / Notes */}
						<div className="space-y-2 col-span-2 mt-2">
							<Label htmlFor="reason" className="font-bold text-slate-700">Note (Optional)</Label>
							<Textarea 
								id="reason"
								placeholder="Briefly mention why you need to reschedule..."
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								className="resize-none h-20 rounded-xl"
							/>
						</div>
					</div>
				</div>

				</div>
				<div className="p-8 pt-0">
					<DialogFooter className="flex gap-3">
						<Button variant="ghost" onClick={onClose} disabled={isUpdating} className="flex-1 rounded-xl h-12 font-bold text-slate-500 hover:bg-slate-50">
							Cancel
						</Button>
						<Button
							onClick={handleReschedule}
							disabled={!selectedDate || !selectedTime || isUpdating}
							className="flex-1 bg-teal-600 hover:bg-teal-700 text-white rounded-xl h-12 shadow-lg shadow-teal-600/20 font-bold"
						>
							{isUpdating ? "Processing..." : "Confirm Reschedule"}
						</Button>
					</DialogFooter>
				</div>
			</DialogContent>
		</Dialog>
	);
}
