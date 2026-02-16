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
import { CalendarDays, Clock, RotateCcw } from "lucide-react";
import { AppointmentWithDetails } from "../_types";
import { updateAppointmentStatus } from "../_views/actions/appointments";
import { useToast } from "@/hooks/use-toast";

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

			// Update appointment in database
			const response = await fetch(
				`/api/appointments/${appointment.appointment_id}`,
				{
					method: "PATCH",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						appointment_date: newAppointmentDate.toISOString(),
						status: "confirmed", // Reset to confirmed when rescheduling
					}),
				}
			);

			if (!response.ok) {
				throw new Error("Failed to reschedule appointment");
			}

			toast({
				title: "Success",
				description: "Appointment rescheduled successfully",
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
		"09:00",
		"09:30",
		"10:00",
		"10:30",
		"11:00",
		"11:30",
		"12:00",
		"12:30",
		"13:00",
		"13:30",
		"14:00",
		"14:30",
		"15:00",
		"15:30",
		"16:00",
		"16:30",
		"17:00",
		"17:30",
	];

	return (
		<Dialog open={isOpen} onOpenChange={onClose}>
			<DialogContent className="sm:max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<RotateCcw className="h-5 w-5" />
						Reschedule Appointment
					</DialogTitle>
					<DialogDescription>
						Choose a new date and time for your appointment with{" "}
						{appointment.matched_service?.service_details?.name ||
							"the service provider"}
						.
					</DialogDescription>
				</DialogHeader>

				<div className="space-y-6 py-4">
					{/* Current Appointment Info */}
					<div className="bg-gray-50 rounded-lg p-4">
						<h4 className="text-sm font-medium text-gray-900 mb-2">
							Current Appointment
						</h4>
						<div className="flex items-center gap-4 text-sm text-gray-600">
							<div className="flex items-center gap-2">
								<CalendarDays className="h-4 w-4" />
								<span>
									{appointment.appointment_date
										? format(new Date(appointment.appointment_date), "MMM d, yyyy")
										: "No date set"}
								</span>
							</div>
							<div className="flex items-center gap-2">
								<Clock className="h-4 w-4" />
								<span>
									{appointment.appointment_date
										? format(new Date(appointment.appointment_date), "h:mm a")
										: "No time set"}
								</span>
							</div>
						</div>
					</div>

					{/* Date Selection */}
					<div className="space-y-2">
						<Label htmlFor="date">Select Date</Label>
						<Popover>
							<PopoverTrigger asChild>
								<Button
									variant="outline"
									className="w-full justify-start text-left font-normal"
								>
									<CalendarDays className="mr-2 h-4 w-4" />
									{selectedDate ? format(selectedDate, "PPP") : "Pick a date"}
								</Button>
							</PopoverTrigger>
							<PopoverContent className="w-auto p-0" align="start">
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
					<div className="space-y-2">
						<Label htmlFor="time">Select Time</Label>
						<div className="grid grid-cols-3 gap-2 max-h-32 overflow-y-auto">
							{timeSlots.map((time) => (
								<Button
									key={time}
									variant={selectedTime === time ? "default" : "outline"}
									size="sm"
									onClick={() => setSelectedTime(time)}
									className="text-xs"
								>
									{format(new Date(`2000-01-01T${time}`), "h:mm a")}
								</Button>
							))}
						</div>
					</div>

					{/* Custom Time Input */}
					<div className="space-y-2">
						<Label htmlFor="custom-time">Or enter custom time</Label>
						<Input
							id="custom-time"
							type="time"
							value={selectedTime}
							onChange={(e) => setSelectedTime(e.target.value)}
							className="w-full"
						/>
					</div>
				</div>

				<DialogFooter>
					<Button variant="outline" onClick={onClose} disabled={isUpdating}>
						Cancel
					</Button>
					<Button
						onClick={handleReschedule}
						disabled={!selectedDate || !selectedTime || isUpdating}
						className="bg-[#1A3434] hover:bg-[#2A4A4A]"
					>
						{isUpdating ? "Rescheduling..." : "Reschedule Appointment"}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
