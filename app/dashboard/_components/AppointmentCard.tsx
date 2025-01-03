// app/dashboard/_components/AppointmentCard.tsx
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar, Clock } from "lucide-react";
import { Tables } from "@/types/db-schema";
import { updateAppointmentStatus } from "../_views/actions/appointments";
import { useState } from "react";

interface AppointmentCardProps {
	appointment: {
		id: string;
		appointment_date: string;
		status: string;
		matched_service: {
			support_service: Tables<"support_services">;
		};
	};
	onStatusUpdate?: () => void;
}

export function AppointmentCard({ appointment, onStatusUpdate }: AppointmentCardProps) {
	const [isUpdating, setIsUpdating] = useState(false);
	const appointmentDate = new Date(appointment.appointment_date);

	const handleStatusUpdate = async (status: 'confirmed' | 'cancelled' | 'completed') => {
		try {
			setIsUpdating(true);
			await updateAppointmentStatus(appointment.id, status);
			onStatusUpdate?.();
		} catch (error) {
			console.error('Error updating appointment status:', error);
		} finally {
			setIsUpdating(false);
		}
	};

	return (
		<div className="bg-white rounded-lg shadow p-4 border">
			<h3 className="font-semibold text-lg mb-2">
				{appointment.matched_service.support_service.name}
			</h3>
			
			<div className="space-y-2">
				<div className="flex items-center gap-2 text-gray-600">
					<Calendar className="h-4 w-4" />
					<span>{format(appointmentDate, "MMMM d, yyyy")}</span>
				</div>
				<div className="flex items-center gap-2 text-gray-600">
					<Clock className="h-4 w-4" />
					<span>{format(appointmentDate, "h:mm a")}</span>
				</div>
			</div>

			{appointment.matched_service.support_service.phone_number && (
				<div className="mt-4 pt-4 border-t">
					<p className="text-sm text-gray-600">
						Contact: {appointment.matched_service.support_service.phone_number}
					</p>
				</div>
			)}

			<div className="mt-4 pt-4 border-t flex gap-2">
				{appointment.status === 'confirmed' && (
					<>
						<Button
							variant="outline"
							size="sm"
							onClick={() => handleStatusUpdate('cancelled')}
							disabled={isUpdating}
						>
							Cancel
						</Button>
						<Button
							size="sm"
							onClick={() => handleStatusUpdate('completed')}
							disabled={isUpdating}
						>
							Mark Complete
						</Button>
					</>
				)}
			</div>
		</div>
	);
}
