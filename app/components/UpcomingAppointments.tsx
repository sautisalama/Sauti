"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/utils/supabase/client";
import { Database } from "@/types/db-schema";
import { format } from "date-fns";

type AppointmentWithDetails =
	Database["public"]["Tables"]["appointments"]["Row"] & {
		professional_profiles: {
			profession: string;
			profiles: {
				first_name: string | null;
				last_name: string | null;
			} | null;
		} | null;
		matched_services: {
			reports: {
				incident_description: string | null;
			} | null;
			support_services: {
				name: string;
			} | null;
		} | null;
	};

export function UpcomingAppointments() {
	const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		async function fetchAppointments() {
			const supabase = createClient();

			// Get the current user's session
			const {
				data: { session },
			} = await supabase.auth.getSession();

			if (!session?.user?.id) {
				console.error("No user session found");
				setIsLoading(false);
				return;
			}

			// Get the user's profile to determine their type (professional or survivor)
			const { data: userProfile } = await supabase
				.from("profiles")
				.select("user_type")
				.eq("id", session.user.id)
				.single();

			// Build the query based on user type
			const query = supabase
				.from("appointments")
				.select(
					`
					*,
					professional_profiles (
						profession,
						profiles (
							first_name,
							last_name
						)
					),
					matched_services (
						reports (
							incident_description
						),
						support_services (
							name
						)
					)
				`
				)
				.order("date", { ascending: false });

			// Filter based on user type
			if (userProfile?.user_type === "professional") {
				query.eq("professional_id", session.user.id);
			} else if (userProfile?.user_type === "survivor") {
				query.eq("survivor_id", session.user.id);
			}

			const { data: appointmentsData, error } = await query;

			if (error) {
				console.error("Error fetching appointments:", error);
				return;
			}

			setAppointments(appointmentsData || []);
			setIsLoading(false);
		}

		fetchAppointments();
	}, []);

	if (isLoading) {
		return <div>Loading appointments...</div>;
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<h2 className="text-xl font-semibold">Your Appointments</h2>
				<Button variant="outline" size="sm">
					View All
				</Button>
			</div>

			<div className="space-y-3">
				{appointments.length === 0 ? (
					<p className="text-muted-foreground text-sm">No appointments found</p>
				) : (
					appointments.map((appointment) => (
						<div
							key={appointment.id}
							className="flex items-start justify-between p-4 rounded-lg border bg-card"
						>
							<div className="space-y-1">
								<p className="font-medium">
									{appointment.professional_profiles?.profiles?.first_name}{" "}
									{appointment.professional_profiles?.profiles?.last_name}
								</p>
								<p className="text-sm text-muted-foreground">
									{appointment.professional_profiles?.profession}
								</p>
								<p className="text-sm text-muted-foreground">
									{appointment.matched_services?.support_services?.name}
								</p>
								{appointment.matched_services?.reports?.incident_description && (
									<p className="text-sm text-muted-foreground line-clamp-2">
										{appointment.matched_services.reports.incident_description}
									</p>
								)}
							</div>
							<div className="text-right">
								<p className="font-medium">
									{format(new Date(appointment.date), "MMM d, yyyy")}
								</p>
								<p className="text-sm text-muted-foreground">
									{format(new Date(appointment.date), "h:mm a")}
								</p>
								<span
									className={`inline-block mt-2 px-2 py-1 text-xs rounded-full ${
										appointment.status === "confirmed"
											? "bg-green-100 text-green-800"
											: "bg-yellow-100 text-yellow-800"
									}`}
								>
									{appointment.status}
								</span>
							</div>
						</div>
					))
				)}
			</div>
		</div>
	);
}
