import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
	Calendar,
	Clock,
	MessageCircle,
	Phone,
	UserCircle,
	AlertCircle,
	AlertTriangle,
	Pencil,
	MoreVertical,
	CalendarDays,
	MapPin,
	Video,
	RotateCcw,
	CheckCircle2,
	XCircle,
	Timer,
	ChevronRight,
} from "lucide-react";
import { Tables } from "@/types/db-schema";
import {
	updateAppointmentStatus,
	updateAppointmentNotes,
} from "../_views/actions/appointments";
import { useState } from "react";
import { AppointmentWithDetails } from "../_types";
import { ChatModal } from "./ChatModal";
import { Textarea } from "@/components/ui/textarea";
import { AddToCalendarButton } from "./AddToCalendarButton";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { RescheduleModal } from "./RescheduleModal";

interface AppointmentCardProps {
	appointment: AppointmentWithDetails;
	onStatusUpdate: () => void;
}

export function AppointmentCard({
	appointment,
	onStatusUpdate,
	userId,
	username,
}: AppointmentCardProps & { userId: string; username: string }) {
	const [isChatOpen, setIsChatOpen] = useState(false);
	const [isRescheduleOpen, setIsRescheduleOpen] = useState(false);
	const [isUpdating, setIsUpdating] = useState(false);
	const [notes, setNotes] = useState(appointment.notes || "");
	const [isSavingNotes, setIsSavingNotes] = useState(false);
	const [isEditingNotes, setIsEditingNotes] = useState(false);
	const appointmentDate = new Date(appointment.appointment_date);

	const handleOpenChat = () => {
		setIsChatOpen(true);
	};

	const handleStatusUpdate = async (
		status: "confirmed" | "cancelled" | "completed"
	) => {
		try {
			setIsUpdating(true);
			await updateAppointmentStatus(appointment.appointment_id, status);
			onStatusUpdate?.();
		} catch (error) {
			console.error("Error updating appointment status:", error);
		} finally {
			setIsUpdating(false);
		}
	};

	const handleNotesUpdate = async () => {
		try {
			setIsSavingNotes(true);
			await updateAppointmentNotes(appointment.appointment_id, notes);
		} catch (error) {
			console.error("Error updating notes:", error);
		} finally {
			setIsSavingNotes(false);
		}
	};

	// Helper function to format incident type
	const formatIncidentType = (type: string | null) => {
		if (!type) return "";
		return type
			.split("_")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");
	};

	// Helper function to get status color and icon
	const getStatusConfig = (status: string) => {
		switch (status) {
			case "confirmed":
				return {
					color: "bg-sauti-teal text-white shadow-sm",
					icon: <Timer className="h-3 w-3" />,
					label: "Confirmed",
				};
			case "completed":
				return {
					color: "bg-sauti-dark text-white shadow-sm",
					icon: <CheckCircle2 className="h-3 w-3" />,
					label: "Completed",
				};
			case "cancelled":
				return {
					color: "bg-sauti-red text-white shadow-sm",
					icon: <XCircle className="h-3 w-3" />,
					label: "Cancelled",
				};
			default:
				return {
					color: "bg-sauti-yellow text-sauti-dark shadow-sm",
					icon: <Clock className="h-3 w-3" />,
					label: "Pending",
				};
		}
	};

	const statusConfig = getStatusConfig(appointment.status);
	const isUpcoming = new Date(appointment.appointment_date) > new Date();
	const timeUntilAppointment = Math.ceil(
		(new Date(appointment.appointment_date).getTime() - new Date().getTime()) /
			(1000 * 60 * 60 * 24)
	);

	// Early return if matched_service data is missing
	if (!appointment.matched_service) {
		return (
			<div className="bg-sauti-teal-light rounded-2xl border-0 shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden relative">
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-sauti-teal/40" />
				<div className="p-4">
					{/* Header */}
					<div className="flex items-start justify-between mb-3">
						<div className="flex items-center gap-3">
							<div className="h-10 w-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-semibold text-sm">
								{appointment.professional?.first_name?.[0] || "D"}
							</div>
							<div>
								<h3 className="font-semibold text-gray-900">Direct Appointment</h3>
								<div className="flex items-center gap-2 text-sm text-gray-500">
									<Calendar className="h-3 w-3" />
									<span>{format(appointmentDate, "MMM d, yyyy")}</span>
									<span>•</span>
									<Clock className="h-3 w-3" />
									<span>{format(appointmentDate, "h:mm a")}</span>
								</div>
							</div>
						</div>
						<Badge className={cn("rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider border-0", statusConfig.color)}>
							{statusConfig.icon}
							<span className="ml-1">{statusConfig.label}</span>
						</Badge>
					</div>

					{/* Participants */}
					<div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
						{appointment.professional && (
							<div className="flex items-center gap-2">
								<UserCircle className="h-4 w-4" />
								<span>
									{appointment.professional.first_name}{" "}
									{appointment.professional.last_name}
								</span>
							</div>
						)}
						{appointment.survivor && (
							<div className="flex items-center gap-2">
								<UserCircle className="h-4 w-4" />
								<span>
									{appointment.survivor.first_name} {appointment.survivor.last_name}
								</span>
							</div>
						)}
					</div>

					{/* Actions */}
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							onClick={handleOpenChat}
							className="flex-1 h-8 text-xs"
						>
							<MessageCircle className="h-3 w-3 mr-1" />
							Chat
						</Button>
						{appointment.status === "confirmed" && (
							<>
								<Button
									variant="outline"
									size="sm"
									onClick={() => setIsRescheduleOpen(true)}
									className="flex-1 h-8 text-xs"
								>
									<RotateCcw className="h-3 w-3 mr-1" />
									Reschedule
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={() => handleStatusUpdate("cancelled")}
									disabled={isUpdating}
									className="flex-1 h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
								>
									<XCircle className="h-3 w-3 mr-1" />
									Cancel
								</Button>
							</>
						)}
						{appointment.professional_id === userId &&
							appointment.status === "confirmed" && (
								<Button
									size="sm"
									onClick={() => handleStatusUpdate("completed")}
									disabled={isUpdating}
									className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700"
								>
									<CheckCircle2 className="h-3 w-3 mr-1" />
									Complete
								</Button>
							)}
					</div>
				</div>
			</div>
		);
	}

	// Main appointment card with matched service
	return (
		<>
			<div className={cn(
        "rounded-2xl border-0 shadow-sm hover:shadow-md transition-all duration-300 group overflow-hidden relative mb-4",
        appointment.status === "cancelled" ? "bg-sauti-red-light" : "bg-sauti-teal-light"
      )}>
        {/* Bottom Accent Line */}
        <div className={cn(
          "absolute bottom-0 left-0 right-0 h-1.5",
          appointment.status === "cancelled" ? "bg-sauti-red" : "bg-sauti-teal"
        )} />
				<div className="p-4">
					{/* Header */}
					<div className="flex items-start justify-between mb-3">
						<div className="flex items-center gap-3 flex-1 min-w-0">
							<div className="h-10 w-10 rounded-xl bg-sauti-dark text-white flex items-center justify-center font-black text-sm flex-shrink-0">
								{appointment.matched_service?.support_service.name?.[0]?.toUpperCase() ||
									"A"}
							</div>
							<div className="min-w-0 flex-1">
								<h3 className="font-black text-sauti-dark truncate">
									{appointment.matched_service?.support_service.name ||
										"Direct Appointment"}
								</h3>
								<div className="flex items-center gap-2 text-sm text-gray-500">
									<Calendar className="h-3 w-3 flex-shrink-0" />
									<span>{format(appointmentDate, "MMM d, yyyy")}</span>
									<span>•</span>
									<Clock className="h-3 w-3 flex-shrink-0" />
									<span>{format(appointmentDate, "h:mm a")}</span>
									{isUpcoming && timeUntilAppointment > 0 && (
										<>
											<span>•</span>
											<span className="text-blue-600 font-medium">
												{timeUntilAppointment === 1
													? "Tomorrow"
													: `In ${timeUntilAppointment} days`}
											</span>
										</>
									)}
								</div>
							</div>
						</div>
						<div className="flex items-center gap-2 flex-shrink-0">
							<Badge className={cn("rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider border-0", statusConfig.color)}>
								{statusConfig.icon}
								<span className="ml-1">{statusConfig.label}</span>
							</Badge>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button variant="ghost" size="sm" className="h-8 w-8 p-0">
										<MoreVertical className="h-4 w-4" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end">
									<DropdownMenuItem onClick={handleOpenChat}>
										<MessageCircle className="h-4 w-4 mr-2" />
										Chat
									</DropdownMenuItem>
									{appointment.matched_service?.support_service.phone_number && (
										<DropdownMenuItem
											onClick={() =>
												(window.location.href = `tel:${appointment.matched_service.support_service.phone_number}`)
											}
										>
											<Phone className="h-4 w-4 mr-2" />
											Call
										</DropdownMenuItem>
									)}
									<DropdownMenuItem asChild>
										<AddToCalendarButton
											appointment={appointment}
											size="sm"
											variant="ghost"
										/>
									</DropdownMenuItem>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>

					{/* Service Details */}
					<div className="mb-4">
						{appointment.matched_service?.report?.incident_description && (
							<div className="bg-gray-50 rounded-lg p-3 mb-3">
								<p className="text-sm text-gray-700 line-clamp-2">
									{appointment.matched_service.report.incident_description}
								</p>
							</div>
						)}

						{/* Participants */}
						<div className="flex items-center gap-4 text-sm text-gray-600">
							{appointment.professional && (
								<div className="flex items-center gap-2">
									<UserCircle className="h-4 w-4" />
									<span className="truncate">
										{appointment.professional.first_name}{" "}
										{appointment.professional.last_name}
									</span>
								</div>
							)}
							{/* {appointment.survivor && (
								<div className="flex items-center gap-2">
									<UserCircle className="h-4 w-4" />
									<span className="truncate">
										{appointment.survivor.first_name} {appointment.survivor.last_name}
									</span>
								</div>
							)} */}
						</div>
					</div>

					{/* Professional Notes (if editing) */}
					{appointment.professional_id === userId && isEditingNotes && (
						<div className="bg-blue-50 rounded-lg p-3 mb-4">
							<Textarea
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								placeholder="Add your notes here..."
								className="min-h-[80px] mb-2 text-sm"
							/>
							<div className="flex gap-2">
								<Button
									size="sm"
									variant="outline"
									onClick={() => setIsEditingNotes(false)}
									className="flex-1 h-7 text-xs"
								>
									Cancel
								</Button>
								<Button
									size="sm"
									onClick={async () => {
										await handleNotesUpdate();
										setIsEditingNotes(false);
									}}
									disabled={isSavingNotes}
									className="flex-1 h-7 text-xs"
								>
									{isSavingNotes ? "Saving..." : "Save"}
								</Button>
							</div>
						</div>
					)}

					{/* Action Buttons */}
					<div className="flex items-center gap-2">
						{appointment.status === "confirmed" && (
							<>
								<Button
									variant="outline"
									size="sm"
									onClick={() => setIsRescheduleOpen(true)}
									className="flex-1 h-8 text-xs"
								>
									<RotateCcw className="h-3 w-3 mr-1" />
									Reschedule
								</Button>
								<Button
									variant="outline"
									size="sm"
									onClick={() => handleStatusUpdate("cancelled")}
									disabled={isUpdating}
									className="flex-1 h-8 text-xs text-red-600 hover:text-red-700 hover:bg-red-50"
								>
									<XCircle className="h-3 w-3 mr-1" />
									Cancel
								</Button>
							</>
						)}
						{appointment.professional_id === userId &&
							appointment.status === "confirmed" && (
								<Button
									size="sm"
									onClick={() => handleStatusUpdate("completed")}
									disabled={isUpdating}
									className="flex-1 h-8 text-xs bg-sauti-teal hover:bg-sauti-dark font-black rounded-full transition-all duration-300 shadow-md"
								>
									<CheckCircle2 className="h-3 w-3 mr-1" />
									Complete
								</Button>
							)}
						{appointment.professional_id === userId && !isEditingNotes && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() => setIsEditingNotes(true)}
								className="h-8 w-8 p-0"
							>
								<Pencil className="h-3 w-3" />
							</Button>
						)}
					</div>
				</div>
			</div>

			<ChatModal
				isOpen={isChatOpen}
				onClose={() => setIsChatOpen(false)}
				userId={userId}
				username={username}
				appointmentId={appointment.appointment_id}
			/>

			<RescheduleModal
				isOpen={isRescheduleOpen}
				onClose={() => setIsRescheduleOpen(false)}
				appointment={appointment}
				onReschedule={onStatusUpdate}
			/>
		</>
	);
}
