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
import { AddToCalendarModal } from "./AddToCalendarModal";
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
	const [showCalendarModal, setShowCalendarModal] = useState(false);
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
			// Show calendar modal when confirming
			if (status === "confirmed") {
				setShowCalendarModal(true);
			}
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
				"group relative w-full bg-white rounded-2xl border transition-all duration-300 overflow-hidden",
				"hover:shadow-lg hover:-translate-y-0.5 hover:border-blue-200",
				appointment.status === "cancelled" ? "border-red-100 bg-red-50/10" : "border-gray-200"
			)}>
				{/* Status Strip */}
				<div className={cn(
					"absolute left-0 top-0 bottom-0 w-1.5 transition-colors duration-300",
					appointment.status === "cancelled" ? "bg-red-400" : 
					appointment.status === "completed" ? "bg-green-500" :
					isUpcoming ? "bg-blue-500" : "bg-gray-300"
				)} />

				<div className="p-5 pl-7"> {/* Added padding-left for strip */}
					{/* Header */}
					<div className="flex items-start justify-between mb-4">
						<div className="flex items-center gap-4 min-w-0">
							{/* Date Block */}
							<div className={cn(
								"flex flex-col items-center justify-center h-14 w-14 rounded-xl border shrink-0",
								isUpcoming ? "bg-blue-50 border-blue-100 text-blue-700" : "bg-gray-50 border-gray-200 text-gray-500"
							)}>
								<span className="text-[10px] font-bold uppercase tracking-wider leading-none mb-1">
									{format(appointmentDate, "MMM")}
								</span>
								<span className="text-xl font-bold leading-none">
									{format(appointmentDate, "d")}
								</span>
							</div>

							<div className="min-w-0">
								<h3 className="font-bold text-gray-900 truncate text-base mb-1">
									{appointment.matched_service?.service_details.name ||
										"Direct Appointment"}
								</h3>
								<div className="flex items-center gap-2 text-xs text-gray-500 font-medium">
									<Clock className="h-3.5 w-3.5 text-gray-400" />
									<span>{format(appointmentDate, "h:mm a")}</span>
									<span className="text-gray-300">•</span>
									<span className={isUpcoming ? "text-blue-600" : ""}>
										{format(appointmentDate, "EEEE")}
									</span>
									{isUpcoming && timeUntilAppointment > 0 && (
										<Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px] font-bold bg-blue-50 text-blue-700 hover:bg-blue-100 border-0">
											{timeUntilAppointment === 1 ? "Tomorrow" : `${timeUntilAppointment}d left`}
										</Badge>
									)}
								</div>
							</div>
						</div>

						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button variant="ghost" size="icon" className="h-8 w-8 -mr-2 text-gray-400 hover:text-gray-600">
									<MoreVertical className="h-4 w-4" />
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-48">
								<DropdownMenuItem onClick={handleOpenChat}>
									<MessageCircle className="h-4 w-4 mr-2" />
									Chat
								</DropdownMenuItem>
								{appointment.matched_service?.service_details.phone_number && (
									<DropdownMenuItem
										onClick={() =>
											(window.location.href = `tel:${appointment.matched_service.service_details.phone_number}`)
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
										className="w-full justify-start px-2 font-normal"
									/>
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>
					</div>

					{/* Service Details / Context */}
					{appointment.matched_service?.report?.incident_description && (
						<div className="mb-5 pl-1">
							<p className="text-sm text-gray-600 line-clamp-2 leading-relaxed">
								{appointment.matched_service.report.incident_description}
							</p>
						</div>
					)}

					{/* Participants & Primary Actions */}
					<div className="flex items-center justify-between gap-4 mt-auto">
						{/* Professional Info */}
						<div className="flex items-center gap-3 min-w-0">
							{appointment.professional && (
								<div className="flex items-center gap-2 bg-gray-50 rounded-full pl-1 pr-3 py-1 border border-gray-100">
									<div className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-bold">
										{appointment.professional.first_name?.[0]}
									</div>
									<span className="text-xs font-medium text-gray-700 truncate max-w-[120px]">
										{appointment.professional.first_name} {appointment.professional.last_name}
									</span>
								</div>
							)}
						</div>

						{/* Quick Actions Row */}
						<div className="flex items-center gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={handleOpenChat}
								className="h-9 px-3 text-xs bg-white hover:bg-gray-50 border-gray-200 text-gray-700"
							>
								<MessageCircle className="h-3.5 w-3.5 mr-1.5" />
								Chat
							</Button>
							
							{appointment.status === "confirmed" && isUpcoming ? (
								<Button
									onClick={() => window.open(appointment.meeting_link || "#", "_blank")} // Assuming meeting link exists or add placeholder
									className="h-9 px-4 text-xs bg-blue-600 hover:bg-blue-700 text-white shadow-sm shadow-blue-200"
								>
									<Video className="h-3.5 w-3.5 mr-1.5" />
									Join
								</Button>
							) : appointment.status === "confirmed" && appointment.professional_id === userId ? (
								<Button
									onClick={() => handleStatusUpdate("completed")}
									disabled={isUpdating}
									className="h-9 px-4 text-xs bg-green-600 hover:bg-green-700 text-white shadow-sm shadow-green-200"
								>
									<CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
									Complete
								</Button>
							) : null}
						</div>
					</div>

					{/* Editor Area (Conditional) */}
					{appointment.professional_id === userId && isEditingNotes && (
						<div className="mt-4 pt-4 border-t border-dashed border-gray-200">
							<div className="bg-yellow-50/50 rounded-lg p-3 border border-yellow-100">
								<Textarea
									value={notes}
									onChange={(e) => setNotes(e.target.value)}
									placeholder="Add private session notes..."
									className="min-h-[80px] mb-2 text-sm bg-white border-yellow-200 focus-visible:ring-yellow-400"
								/>
								<div className="flex justify-end gap-2">
									<Button
										size="sm"
										variant="ghost"
										onClick={() => setIsEditingNotes(false)}
										className="h-7 text-xs hover:bg-yellow-100 text-yellow-800"
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
										className="h-7 text-xs bg-yellow-600 hover:bg-yellow-700 text-white"
									>
										{isSavingNotes ? "Saving..." : "Save Notes"}
									</Button>
								</div>
							</div>
						</div>
					)}
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

			<AddToCalendarModal
				isOpen={showCalendarModal}
				onClose={() => setShowCalendarModal(false)}
				userId={userId}
				appointmentDetails={{
					appointmentId: appointment.appointment_id,
					date: appointmentDate,
					duration: 60,
					serviceName: appointment.matched_service?.service_details?.name,
					professionalName: appointment.professional
						? `${appointment.professional.first_name} ${appointment.professional.last_name}`
						: undefined,
				}}
			/>
		</>
	);
}
