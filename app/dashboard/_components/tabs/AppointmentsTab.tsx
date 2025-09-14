// app/dashboard/_components/tabs/AppointmentsTab.tsx
import { useEffect, useState, useCallback } from "react";
import { AppointmentCard } from "../AppointmentCard";
import { fetchUserAppointments } from "../../_views/actions/appointments";
import { useToast } from "@/hooks/use-toast";
import { AppointmentWithDetails } from "@/app/dashboard/_types";

interface AppointmentsTabProps {
	userId: string;
	userType: "professional" | "survivor";
	username: string;
	onAppointmentsChange?: () => Promise<void>;
}

export function AppointmentsTab({
	userId,
	userType,
	username,
	onAppointmentsChange,
}: AppointmentsTabProps) {
	const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const { toast } = useToast();

	const loadAppointments = useCallback(async () => {
		try {
			const data = await fetchUserAppointments(userId, userType, true);
			setAppointments(data);
			onAppointmentsChange?.();
		} catch (error) {
			toast({
				title: "Error",
				description: "Failed to load appointments. Please try again.",
				variant: "destructive",
			});
		} finally {
			setIsLoading(false);
		}
	}, [userId, userType, toast, onAppointmentsChange]);

	useEffect(() => {
		loadAppointments();
	}, [loadAppointments]);

	if (isLoading) {
		return <div>Loading appointments...</div>;
	}

	return (
		<div className="space-y-6">
			<h2 className="text-xl font-semibold">Your Appointments</h2>

			{appointments.length > 0 ? (
				<div className="">
					{appointments.map((appointment) => (
						<AppointmentCard
							key={appointment.id}
							appointment={appointment}
							onStatusUpdate={loadAppointments}
							userId={userId}
							username={username}
						/>
					))}
				</div>
			) : (
				<div className="text-center py-12 bg-gray-50 rounded-lg">
					<p className="text-gray-500">No appointments scheduled yet</p>
					<p className="text-sm text-gray-400 mt-2">
						Appointments will appear here once they are scheduled
					</p>
				</div>
			)}
		</div>
	);
}
