import { Button } from "@/components/ui/button";
import {
	acceptMatch,
	createMatchAppointment,
	updateMatchStatus,
} from "@/app/dashboard/_views/actions/matched-services";
import { useToast } from "@/hooks/use-toast";
import { AppointmentScheduler } from "./AppointmentScheduler";
import { useState } from "react";
import { MatchedServiceWithRelations } from "../_types";

interface MatchCardProps {
	match: MatchedServiceWithRelations;
	onAccept?: () => void;
}

export function MatchCard({ match, onAccept }: MatchCardProps) {
	const { toast } = useToast();
	const [isScheduling, setIsScheduling] = useState(false);

	const handleAccept = async () => {
		setIsScheduling(true);
	};

	const handleScheduleAppointment = async (appointmentDate: Date) => {
		try {
			// First accept the match
			await acceptMatch(match.id);

			// Then create the appointment as a separate transaction
			await createMatchAppointment(
				match.id,
				appointmentDate,
				match.support_service.user_id!,
				match.report.user_id!
			);

			toast({
				title: "Match accepted",
				description: "Appointment has been scheduled successfully.",
			});
			onAccept?.();
		} catch (error) {
			console.error("Error scheduling appointment:", error);
			toast({
				title: "Error",
				description: "Failed to schedule appointment. Please try again.",
				variant: "destructive",
			});
		} finally {
			setIsScheduling(false);
		}
	};

	const handleStatusUpdate = async (
		status: "declined" | "completed" | "cancelled"
	) => {
		try {
			await updateMatchStatus(match.id, match.report.report_id, status);
			toast({
				title: "Status updated",
				description: `Match has been ${status}.`,
			});
			onAccept?.(); // Refresh the list
		} catch (error) {
			console.error("Error updating match status:", error);
			toast({
				title: "Error",
				description: "Failed to update status. Please try again.",
				variant: "destructive",
			});
		}
	};

	return (
		<>
			<div className="p-4 border rounded-lg">
				<div className="flex justify-between items-start mb-4">
					<div>
						<h3 className="font-semibold">{match.support_service.name}</h3>
						{match.support_service.service_types && (
							<p className="text-sm text-gray-500">
								Service Type: {match.support_service.service_types}
							</p>
						)}
					</div>
					<div className="flex gap-2">
						{match.match_status_type === "pending" && (
							<>
								<Button
									onClick={handleAccept}
									className="bg-teal-600 hover:bg-teal-700"
								>
									Accept
								</Button>
								<Button
									onClick={() => handleStatusUpdate("declined")}
									variant="outline"
									className="text-red-600 border-red-600 hover:bg-red-50"
								>
									Decline
								</Button>
							</>
						)}
						{match.match_status_type === "accepted" && (
							<Button
								onClick={() => handleStatusUpdate("completed")}
								className="bg-green-600 hover:bg-green-700"
							>
								Complete
							</Button>
						)}
					</div>
				</div>
				<p className="text-sm text-gray-600">
					{match.report.incident_description || "No description provided"}
				</p>
				<div className="mt-2 flex items-center justify-between">
					<span
						className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium
						${
							match.match_status_type === "accepted"
								? "bg-green-100 text-green-800"
								: match.match_status_type === "pending"
								? "bg-yellow-100 text-yellow-800"
								: "bg-gray-100 text-gray-800"
						}`}
					>
						{match.match_status_type}
					</span>
					{match.report.match_score !== null && (
						<span className="text-sm text-gray-500">
							Match Score: {Math.round(match.match_score)}%
						</span>
					)}
				</div>
			</div>

			<AppointmentScheduler
				isOpen={isScheduling}
				onClose={() => setIsScheduling(false)}
				onSchedule={handleScheduleAppointment}
			/>
		</>
	);
}
