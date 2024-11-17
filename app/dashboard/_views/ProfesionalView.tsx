import { createClient } from "@/utils/supabase/server";

export default async function ProfessionalView({ userId }: { userId: string }) {
	const supabase = createClient();

	const { data: appointments } = await supabase
		.from("appointments")
		.select(
			`
      *,
      reports:reports(*)
    `
		)
		.eq("professional_id", userId);

	return (
		<div className="space-y-6">
			<h2 className="text-2xl font-bold">Your Cases</h2>

			{appointments && appointments.length > 0 ? (
				<div className="grid gap-4">
					{appointments.map((appointment) => (
						<div
							key={appointment.id}
							className="bg-card p-4 rounded-lg border shadow-sm"
						>
							<div className="flex justify-between items-start">
								<div>
									<h3 className="font-semibold">
										Appointment on {new Date(appointment.date).toLocaleDateString()}
									</h3>
									<p className="text-sm text-muted-foreground">
										Status: {appointment.status}
									</p>
								</div>
							</div>
						</div>
					))}
				</div>
			) : (
				<p className="text-muted-foreground">No active cases found.</p>
			)}
		</div>
	);
}
