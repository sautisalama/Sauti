import { format } from "date-fns";
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

	// Early return if matched_service data is missing
	if (!appointment.matched_service) {
		return (
			<div className="bg-white rounded-lg shadow p-6 border space-y-4 w-full">
				<div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
					<h3 className="font-semibold text-lg">Direct Appointment</h3>
					<div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 text-gray-600 text-sm">
						<div className="flex items-center gap-2">
							<Calendar className="h-4 w-4" />
							<span>{format(appointmentDate, "MMMM d, yyyy")}</span>
						</div>
						<div className="flex items-center gap-2">
							<Clock className="h-4 w-4" />
							<span>{format(appointmentDate, "h:mm a")}</span>
						</div>
					</div>
				</div>

				<div className="bg-gray-50 rounded-md p-4">
					<h4 className="text-sm font-medium text-gray-500 mb-2">
						Appointment Details
					</h4>
					{appointment.professional && (
						<div className="flex items-center gap-2 mb-2">
							<span className="text-sm text-gray-600">Professional:</span>
							<span className="text-sm font-medium">
								{appointment.professional.first_name}{" "}
								{appointment.professional.last_name}
							</span>
						</div>
					)}
					{appointment.survivor && (
						<div className="flex items-center gap-2">
							<span className="text-sm text-gray-600">Survivor:</span>
							<span className="text-sm font-medium">
								{appointment.survivor.first_name} {appointment.survivor.last_name}
							</span>
						</div>
					)}
				</div>

				<div className="flex flex-col gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={handleOpenChat}
						className="flex items-center justify-center gap-2"
					>
						<MessageCircle className="h-4 w-4" />
						Open Chat
					</Button>

					{appointment.status === "confirmed" && (
						<div className="flex gap-2">
							<Button
								variant="outline"
								size="sm"
								onClick={() => handleStatusUpdate("cancelled")}
								disabled={isUpdating}
								className="flex-1"
							>
								Cancel
							</Button>
							{appointment.professional_id === userId && (
								<Button
									size="sm"
									onClick={() => handleStatusUpdate("completed")}
									disabled={isUpdating}
									className="flex-1"
								>
									Mark Complete
								</Button>
							)}
						</div>
					)}
				</div>
			</div>
		);
	}

	// Original return with full appointment details
	return (
		<>
			<div
				className={`rounded-lg shadow p-4 sm:p-6 border w-full hover:shadow-lg transition-shadow ${
					appointment.matched_service?.report?.urgency === "high"
						? "bg-[#FFF5F5]"
						: appointment.matched_service?.report?.urgency === "medium"
						? "bg-[#FFF8F0]"
						: "bg-[#F0F9FF]"
				}`}
			>
				{/* Header with Service Info and Schedule */}
				<div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4 mb-6">
					<div className="flex items-center gap-3">
						<div className="h-10 w-10 rounded-full bg-[#1A3434] text-white flex items-center justify-center">
							{appointment.matched_service?.support_service.name?.[0]?.toUpperCase() ||
								"A"}
						</div>
						<div>
							<h3 className="font-medium text-lg">
								{appointment.matched_service?.support_service.name ||
									"Direct Appointment"}
							</h3>
							<div className="flex flex-wrap items-center gap-2 text-sm text-gray-500">
								<Calendar className="h-4 w-4" />
								<span>{format(appointmentDate, "MMM d, h:mm a")}</span>
								<span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
								<span
									className={`px-2 py-0.5 rounded-full text-xs ${
										appointment.status === "confirmed"
											? "bg-blue-100 text-blue-700"
											: appointment.status === "completed"
											? "bg-green-100 text-green-700"
											: "bg-red-100 text-red-700"
									}`}
								>
									{appointment.status.charAt(0).toUpperCase() +
										appointment.status.slice(1)}
								</span>
							</div>
						</div>
					</div>

					{/* Quick Actions */}
					<div className="flex items-center gap-2 w-full sm:w-auto">
						<Button
							variant="ghost"
							size="sm"
							onClick={handleOpenChat}
							className="flex items-center justify-center gap-2 hover:bg-white/50 flex-1 sm:flex-none"
						>
							<MessageCircle className="h-4 w-4" />
							<span>Chat</span>
						</Button>
						{appointment.matched_service?.support_service.phone_number && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() =>
									(window.location.href = `tel:${appointment.matched_service.support_service.phone_number}`)
								}
								className="flex items-center justify-center gap-2 hover:bg-white/50 flex-1 sm:flex-none"
							>
								<Phone className="h-4 w-4" />
								<span>Call</span>
							</Button>
						)}
					</div>
				</div>

				{/* Main Content */}
				<div className="space-y-4">
					{/* Incident Description with Participants */}
					{appointment.matched_service?.report.incident_description && (
						<div className="bg-white/50 rounded-lg p-3 sm:p-4">
							<div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-3">
								<h4 className="text-sm font-medium text-gray-500">
									Incident Description
								</h4>
								<div className="flex flex-wrap gap-2">
									{appointment.professional && (
										<div className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/80 rounded-full text-xs text-gray-600">
											<UserCircle className="h-3 w-3" />
											{appointment.professional.first_name}{" "}
											{appointment.professional.last_name}
										</div>
									)}
									{appointment.survivor && (
										<div className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/80 rounded-full text-xs text-gray-600">
											<UserCircle className="h-3 w-3" />
											{appointment.survivor.first_name} {appointment.survivor.last_name}
										</div>
									)}
								</div>
							</div>
							<p className="text-sm text-gray-700 whitespace-pre-wrap">
								{appointment.matched_service.report.incident_description}
							</p>
						</div>
					)}

					{/* Professional Notes */}
					{appointment.professional_id === userId && (
						<div className="bg-white/50 rounded-lg p-4">
							<div className="flex justify-between items-center mb-2">
								<h4 className="text-sm font-medium text-gray-500">
									Professional Notes
								</h4>
								<Button
									variant="ghost"
									size="sm"
									onClick={() => setIsEditingNotes(!isEditingNotes)}
									className="h-8 w-8 p-0"
								>
									<Pencil className="h-4 w-4" />
								</Button>
							</div>

							{isEditingNotes ? (
								<>
									<Textarea
										value={notes}
										onChange={(e) => setNotes(e.target.value)}
										placeholder="Add your notes here..."
										className="min-h-[100px] mb-2"
									/>
									<div className="flex gap-2">
										<Button
											size="sm"
											variant="outline"
											onClick={() => setIsEditingNotes(false)}
											className="flex-1"
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
											className="flex-1"
										>
											{isSavingNotes ? "Saving..." : "Save"}
										</Button>
									</div>
								</>
							) : (
								<p className="text-sm text-gray-700 whitespace-pre-wrap">
									{notes || "No notes added yet."}
								</p>
							)}
						</div>
					)}

					{/* Action Buttons */}
					{appointment.status === "confirmed" && (
						<div className="flex gap-3">
							<Button
								variant="outline"
								size="sm"
								onClick={() => handleStatusUpdate("cancelled")}
								disabled={isUpdating}
								className="flex-1 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200"
							>
								Cancel Appointment
							</Button>
							{appointment.professional_id === userId && (
								<Button
									size="sm"
									onClick={() => handleStatusUpdate("completed")}
									disabled={isUpdating}
									className="flex-1 bg-green-600 hover:bg-green-700"
								>
									Mark as Completed
								</Button>
							)}
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
		</>
	);
}
