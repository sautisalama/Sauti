"use client";

import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
	Calendar,
	CalendarPlus,
	CheckCircle2,
	Clock,
	Download,
	ExternalLink,
	X,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useCalendarStatus } from "@/hooks/useCalendarStatus";
import { generateCalendarUrls, generateICSFile, CalendarEvent } from "@/lib/google-calendar";
import { format } from "date-fns";

interface AddToCalendarModalProps {
	isOpen: boolean;
	onClose: () => void;
	userId: string;
	appointmentDetails: {
		appointmentId?: string;
		date: Date;
		duration?: number;
		type?: string;
		notes?: string;
		professionalName?: string;
		survivorName?: string;
		serviceName?: string;
	};
}

export function AddToCalendarModal({
	isOpen,
	onClose,
	userId,
	appointmentDetails,
}: AddToCalendarModalProps) {
	const [isAddingToCalendar, setIsAddingToCalendar] = useState(false);
	const [addedSuccessfully, setAddedSuccessfully] = useState(false);
	const { toast } = useToast();
	const { connected, connectCalendar } = useCalendarStatus(userId);

	const endDate = new Date(
		appointmentDetails.date.getTime() +
			(appointmentDetails.duration || 60) * 60 * 1000
	);

	const calendarEvent: CalendarEvent = {
		title: `Appointment${appointmentDetails.serviceName ? ` - ${appointmentDetails.serviceName}` : ""}`,
		start: appointmentDetails.date,
		end: endDate,
		description: [
			appointmentDetails.type && `Type: ${appointmentDetails.type}`,
			appointmentDetails.professionalName &&
				`Professional: ${appointmentDetails.professionalName}`,
			appointmentDetails.survivorName &&
				`Client: ${appointmentDetails.survivorName}`,
			appointmentDetails.notes && `Notes: ${appointmentDetails.notes}`,
			"",
			"Platform: Sauti — Supporting survivors with professional care",
		]
			.filter(Boolean)
			.join("\n"),
		location: "Virtual Meeting — Sauti Platform",
	};

	const handleAddToGoogleCalendar = async () => {
		if (!connected) {
			connectCalendar();
			return;
		}

		setIsAddingToCalendar(true);
		try {
			const response = await fetch("/api/calendar/create-event", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					appointmentId: appointmentDetails.appointmentId,
					event: {
						title: calendarEvent.title,
						start: calendarEvent.start.toISOString(),
						end: calendarEvent.end.toISOString(),
						description: calendarEvent.description,
						location: calendarEvent.location,
					},
				}),
			});

			if (response.ok) {
				setAddedSuccessfully(true);
				toast({
					title: "Added to Google Calendar",
					description: "The appointment has been added to your calendar with a reminder.",
				});
				setTimeout(() => onClose(), 1500);
			} else {
				const error = await response.json();
				if (error.error === "Google Calendar not connected") {
					connectCalendar();
				} else {
					throw new Error(error.error);
				}
			}
		} catch (error) {
			toast({
				title: "Failed to add to calendar",
				description: "Could not add to Google Calendar. You can download the ICS file instead.",
				variant: "destructive",
			});
		} finally {
			setIsAddingToCalendar(false);
		}
	};

	const handleDownloadICS = () => {
		try {
			const icsContent = generateICSFile(calendarEvent);
			const blob = new Blob([icsContent], {
				type: "text/calendar;charset=utf-8",
			});
			const link = document.createElement("a");
			link.href = URL.createObjectURL(blob);
			link.download = `appointment-${appointmentDetails.appointmentId || "new"}.ics`;
			document.body.appendChild(link);
			link.click();
			document.body.removeChild(link);
			URL.revokeObjectURL(link.href);

			toast({
				title: "Calendar file downloaded",
				description: "Open the file to add the appointment to any calendar app.",
			});
			onClose();
		} catch {
			toast({
				title: "Download failed",
				description: "Failed to download calendar file.",
				variant: "destructive",
			});
		}
	};

	const calendarUrls = generateCalendarUrls(calendarEvent);

	return (
		<Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="sm:max-w-[440px]">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<CalendarPlus className="h-5 w-5 text-blue-600" />
						Add to Calendar
					</DialogTitle>
					<DialogDescription>
						Would you like to add this appointment to your calendar?
					</DialogDescription>
				</DialogHeader>

				{/* Appointment Summary */}
				<div className="bg-blue-50/70 rounded-xl p-4 border border-blue-100 space-y-2">
					<div className="flex items-center gap-2 text-sm font-semibold text-blue-900">
						<Calendar className="h-4 w-4 text-blue-600" />
						{format(appointmentDetails.date, "EEEE, MMMM d, yyyy")}
					</div>
					<div className="flex items-center gap-2 text-sm text-blue-800">
						<Clock className="h-4 w-4 text-blue-500" />
						{format(appointmentDetails.date, "h:mm a")} –{" "}
						{format(endDate, "h:mm a")}
						{appointmentDetails.duration && (
							<Badge
								variant="secondary"
								className="ml-1 text-[10px] px-1.5 py-0 h-4 bg-blue-100 text-blue-700 border-0"
							>
								{appointmentDetails.duration}min
							</Badge>
						)}
					</div>
					{appointmentDetails.type && (
						<div className="text-sm text-blue-700 capitalize">
							{appointmentDetails.type.replace(/-/g, " ")}
						</div>
					)}
					{appointmentDetails.professionalName && (
						<div className="text-xs text-blue-600">
							with {appointmentDetails.professionalName}
						</div>
					)}
				</div>

				{/* Success State */}
				{addedSuccessfully ? (
					<div className="flex items-center gap-3 p-4 bg-green-50 rounded-xl border border-green-100">
						<CheckCircle2 className="h-6 w-6 text-green-600 shrink-0" />
						<div>
							<p className="font-semibold text-green-900 text-sm">
								Added to Google Calendar!
							</p>
							<p className="text-xs text-green-600">
								You&apos;ll receive a reminder 30 minutes before.
							</p>
						</div>
					</div>
				) : (
					<div className="space-y-3">
						{/* Primary CTA: Google Calendar */}
						<Button
							onClick={handleAddToGoogleCalendar}
							disabled={isAddingToCalendar}
							className="w-full h-12 gap-3 bg-white hover:bg-gray-50 text-gray-800 border-2 border-gray-200 hover:border-blue-300 rounded-xl shadow-sm transition-all"
						>
							<svg viewBox="0 0 24 24" className="w-5 h-5">
								<path
									d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
									fill="#4285F4"
								/>
								<path
									d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
									fill="#34A853"
								/>
								<path
									d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
									fill="#FBBC05"
								/>
								<path
									d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
									fill="#EA4335"
								/>
							</svg>
							<span className="font-semibold">
								{!connected
									? "Connect & Add to Google Calendar"
									: isAddingToCalendar
										? "Adding..."
										: "Add to Google Calendar"}
							</span>
						</Button>

						{/* Secondary options */}
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={handleDownloadICS}
								className="flex-1 h-9 text-xs gap-1.5 rounded-lg"
							>
								<Download className="h-3.5 w-3.5" />
								Download ICS
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() =>
									window.open(calendarUrls.outlook, "_blank")
								}
								className="flex-1 h-9 text-xs gap-1.5 rounded-lg"
							>
								<ExternalLink className="h-3.5 w-3.5" />
								Outlook
							</Button>
						</div>
					</div>
				)}

				{/* Skip Button */}
				{!addedSuccessfully && (
					<Button
						variant="ghost"
						onClick={onClose}
						className="w-full text-sm text-gray-500 hover:text-gray-700"
					>
						Skip for now
					</Button>
				)}
			</DialogContent>
		</Dialog>
	);
}
