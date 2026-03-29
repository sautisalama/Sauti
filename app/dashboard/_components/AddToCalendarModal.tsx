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
		match_status_type?: string;
		professional_accepted_at?: string;
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
			<DialogContent className="sm:max-w-[500px] bg-white rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-2xl">
				<div className="p-8 pb-0 border-b border-slate-50">
					<DialogHeader>
						<DialogTitle className="text-2xl font-bold flex items-center gap-3 text-slate-900">
							<CalendarPlus className="h-6 w-6 text-teal-600" />
							Add to Calendar
						</DialogTitle>
						<DialogDescription className="text-slate-500 font-medium">
							Sync this important meeting with your personal schedule.
						</DialogDescription>
					</DialogHeader>
				</div>

				<div className="p-8 space-y-6">
					{/* Appointment Summary */}
					<div className="bg-teal-50/50 rounded-2xl p-5 border border-teal-100/50 space-y-3 shadow-inner">
						<div className="flex items-center gap-3 text-sm font-bold text-teal-900">
							<div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm">
								<Calendar className="h-4 w-4 text-teal-600" />
							</div>
							{format(appointmentDetails.date, "EEEE, MMMM d, yyyy")}
						</div>
						<div className="flex items-center gap-3 text-sm text-slate-600 font-medium pl-1">
							<Clock className="h-4 w-4 text-teal-500" />
							<span>
								{format(appointmentDetails.date, "h:mm a")} –{" "}
								{format(endDate, "h:mm a")}
							</span>
							{appointmentDetails.duration && (
								<Badge
									variant="secondary"
									className="ml-2 bg-teal-100/50 text-teal-700 border-0 font-bold"
								>
									{appointmentDetails.duration} min
								</Badge>
							)}
						</div>
						{appointmentDetails.type && (
							<div className="text-sm text-slate-500 capitalize pl-7 font-medium">
								{appointmentDetails.type.replace(/-/g, " ")}
							</div>
						)}
						{appointmentDetails.professionalName && (
							<div className="text-xs text-slate-400 pl-7">
								with {appointmentDetails.professionalName}
							</div>
						)}
					</div>

					{/* Success State */}
					{addedSuccessfully ? (
						<div className="flex items-center gap-4 p-5 bg-teal-600 text-white rounded-2xl shadow-lg shadow-teal-600/20 animate-in zoom-in-95 duration-300">
							<CheckCircle2 className="h-8 w-8 shrink-0" />
							<div>
								<p className="font-bold text-base">
									Successfully Synced!
								</p>
								<p className="text-xs text-white/80">
									We&apos;ll notify you 30 minutes before the start.
								</p>
							</div>
						</div>
					) : (
						<div className="space-y-4">
							{/* Primary CTA: Google Calendar */}
							<Button
								onClick={handleAddToGoogleCalendar}
								disabled={isAddingToCalendar}
								className="w-full h-14 gap-3 bg-white hover:bg-slate-50 text-slate-900 border-2 border-slate-100 rounded-2xl shadow-sm transition-all hover:scale-[1.01] active:scale-95 group font-bold"
							>
								<svg viewBox="0 0 24 24" className="w-5 h-5 group-hover:scale-110 transition-transform">
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
								<span className="font-bold">
									{!connected
										? "Connect & Add to Google"
										: isAddingToCalendar
											? "Adding..."
											: "Sync with Google Calendar"}
								</span>
							</Button>

							{/* Secondary options */}
							<div className="flex gap-3">
								<Button
									variant="secondary"
									size="lg"
									onClick={handleDownloadICS}
									className="flex-1 h-12 gap-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 border-0 font-bold"
								>
									<Download className="h-4 w-4" />
									Download
								</Button>
								<Button
									variant="secondary"
									size="lg"
									onClick={() =>
										window.open(calendarUrls.outlook, "_blank")
									}
									className="flex-1 h-12 gap-2 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 border-0 font-bold"
								>
									<ExternalLink className="h-4 w-4" />
									Outlook
								</Button>
							</div>
						</div>
					)}

					{/* Footer Link */}
					{!addedSuccessfully && (
						<div className="pt-2 text-center">
							<button
								onClick={onClose}
								className="text-sm font-medium text-slate-400 hover:text-teal-600 transition-colors"
							>
								Don&apos;t add for now
							</button>
						</div>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
