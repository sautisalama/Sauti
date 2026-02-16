import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
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
				match.service_details.user_id!,
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
			<div className={cn(
        "p-6 rounded-2xl border-0 shadow-sm hover:shadow-md transition-all duration-300 relative overflow-hidden group",
        match.match_status_type === "accepted" ? "bg-sauti-teal-light" : 
        match.match_status_type === "pending" ? "bg-sauti-yellow-light" : 
        "bg-white"
      )}>
        {/* Bottom Accent Line */}
        <div className={cn(
          "absolute bottom-0 left-0 right-0 h-1.5",
          match.match_status_type === "accepted" ? "bg-sauti-teal" : 
          match.match_status_type === "pending" ? "bg-sauti-yellow" : 
          "bg-sauti-dark/10"
        )} />
				<div className="flex justify-between items-start mb-4">
					<div>
						<h3 className="font-black text-lg text-sauti-dark tracking-tight">{match.service_details.name}</h3>
						{match.service_details.service_types && (
							<p className="text-sm text-gray-500">
								Service Type: {match.service_details.service_types}
							</p>
						)}
					</div>
					<div className="flex gap-2">
						{match.match_status_type === "pending" && (
							<>
								<Button
									onClick={handleAccept}
									className="bg-sauti-teal hover:bg-sauti-dark text-white font-bold rounded-full px-6 transition-all duration-300"
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
								className="bg-sauti-teal hover:bg-sauti-dark text-white font-bold rounded-full px-6 transition-all duration-300"
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
						className={cn(
              "inline-flex items-center px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm",
              match.match_status_type === "accepted" ? "bg-sauti-teal text-white" : 
              match.match_status_type === "pending" ? "bg-sauti-yellow text-sauti-dark" : 
              "bg-neutral-100 text-neutral-600"
            )}
					>
						{match.match_status_type}
					</span>
					{/* {match.report.match_score !== null && (
						<span className="text-sm text-gray-500">
							Match Score: {Math.round(match.match_score)}%
						</span>
					)} */}
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
