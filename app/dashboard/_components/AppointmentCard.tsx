// app/dashboard/_components/AppointmentCard.tsx
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MessageCircle } from "lucide-react";
import { Tables } from "@/types/db-schema";
import { updateAppointmentStatus } from "../_views/actions/appointments";
import { useState } from "react";
import { AppointmentWithDetails } from "../_types";
import { ChatModal } from "./ChatModal";

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
			<div className="bg-white rounded-lg shadow p-4 border">
				<div className="mb-6">
					<h3 className="font-semibold text-lg">Direct Appointment</h3>
					<div className="mt-2 flex items-center gap-3 text-gray-600">
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

				{/* Participant Details */}
				<div className="p-3 bg-gray-50 rounded-md mb-4">
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

				{/* Action Buttons */}
				<div className="mt-4 space-y-2">
					<Button
						variant="outline"
						size="sm"
						onClick={handleOpenChat}
						className="w-full flex items-center justify-center gap-2"
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
							<Button
								size="sm"
								onClick={() => handleStatusUpdate("completed")}
								disabled={isUpdating}
								className="flex-1"
							>
								Mark Complete
							</Button>
						</div>
					)}
				</div>
			</div>
		);
	}

	// Original return with full appointment details
	return (
		<>
			<div className="bg-white rounded-lg shadow p-4 border">
				{/* Header Section */}
				<div className="mb-6">
					<h3 className="font-semibold text-lg">
						{appointment.matched_service.support_service.name}
					</h3>
					<div className="mt-2 flex items-center gap-3 text-gray-600">
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

				{/* Main Content Grid */}
				<div className="grid gap-4 mb-6">
					{/* Survivor Details */}
					<div className="p-3 bg-gray-50 rounded-md">
						<h4 className="text-sm font-medium text-gray-500 mb-2">
							Survivor Details
						</h4>
						<p className="font-medium">
							{appointment.matched_service.report.first_name}{" "}
							{appointment.matched_service.report.last_name}
						</p>
						<div className="mt-2 space-y-1">
							{appointment.matched_service.report.type_of_incident && (
								<div className="flex items-center gap-2">
									<span className="text-sm text-gray-600">Incident Type:</span>
									<span className="text-sm font-medium">
										{formatIncidentType(
											appointment.matched_service.report.type_of_incident
										)}
									</span>
								</div>
							)}
							{appointment.matched_service.report.urgency && (
								<div className="flex items-center gap-2">
									<span className="text-sm text-gray-600">Urgency:</span>
									<span
										className={`text-sm font-medium px-2 py-0.5 rounded-full ${
											appointment.matched_service.report.urgency === "high"
												? "bg-red-100 text-red-700"
												: appointment.matched_service.report.urgency === "medium"
												? "bg-yellow-100 text-yellow-700"
												: "bg-green-100 text-green-700"
										}`}
									>
										{appointment.matched_service.report.urgency.toUpperCase()}
									</span>
								</div>
							)}
						</div>
					</div>

					{/* Incident Description */}
					{appointment.matched_service.report.incident_description && (
						<div className="p-3 bg-gray-50 rounded-md">
							<h4 className="text-sm font-medium text-gray-500 mb-2">
								Incident Description
							</h4>
							<p className="text-sm text-gray-700 whitespace-pre-wrap">
								{appointment.matched_service.report.incident_description}
							</p>
						</div>
					)}
				</div>

				{/* Contact and Actions Section */}
				<div className="space-y-3">
					{/* Contact Information */}
					{appointment.matched_service.support_service.phone_number && (
						<div className="p-2 bg-blue-50 rounded-md text-center">
							<p className="text-sm font-medium text-blue-700">
								Contact: {appointment.matched_service.support_service.phone_number}
							</p>
						</div>
					)}

					{/* Action Buttons */}
					<div className="space-y-2">
						<Button
							variant="outline"
							size="sm"
							onClick={handleOpenChat}
							className="w-full flex items-center justify-center gap-2"
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
								<Button
									size="sm"
									onClick={() => handleStatusUpdate("completed")}
									disabled={isUpdating}
									className="flex-1"
								>
									Mark Complete
								</Button>
							</div>
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
		</>
	);
}
