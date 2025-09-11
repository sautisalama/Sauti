import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
	const supabase = await createClient();

	try {
		const {
			data: { user },
		} = await supabase.auth.getUser();
		if (!user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const data = await request.json();
		const { matchId, date, professionalId } = data;

		// Get the report details from matched_services first
		const { data: matchData, error: matchQueryError } = await supabase
			.from("matched_services")
			.select(
				`
				*,
				reports!inner(
					report_id,
					user_id
				)
			`
			)
			.eq("id", matchId)
			.single();

		if (matchQueryError) throw matchQueryError;
		if (!matchData?.reports) throw new Error("Report not found");

		// Create appointment with the correct survivor_id (user_id from report)
		const { data: appointment, error: appointmentError } = await supabase
			.from("appointments")
			.insert({
				appointment_date: date,
				professional_id: professionalId,
				status: "confirmed",
				survivor_id: matchData.reports.user_id,
			})
			.select()
			.single();

		if (appointmentError) throw appointmentError;

		// Update both matched_services and reports status
		const updates = await Promise.all([
			// Update matched_services status
			supabase
				.from("matched_services")
				.update({
					match_status_type: "accepted",
					updated_at: new Date().toISOString(),
				})
				.eq("id", matchId),

			// Update report match_status and ismatched
			supabase
				.from("reports")
				.update({
					match_status: "accepted",
					ismatched: true,
				})
				.eq("report_id", matchData.reports.report_id),
		]);

		// Check for errors in either update
		const [matchError, reportError] = updates.map((update) => update.error);
		if (matchError) throw matchError;
		if (reportError) throw reportError;

		return NextResponse.json({
			message: "Appointment created and case accepted successfully",
			appointment,
		});
	} catch (error) {
		console.error("Error creating appointment:", error);
		return NextResponse.json(
			{ error: "Failed to create appointment" },
			{ status: 500 }
		);
	}
}
