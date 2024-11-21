import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
	const supabase = createClient();

	try {
		const {
			data: { session },
		} = await supabase.auth.getSession();
		if (!session) {
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
				reports!inner(*)
			`
			)
			.eq("id", matchId)
			.single();

		if (matchQueryError) throw matchQueryError;
		if (!matchData?.reports) throw new Error("Report not found");

		// Create appointment with the correct report_id
		const { data: appointment, error: appointmentError } = await supabase
			.from("appointments")
			.insert({
				date,
				professional_id: professionalId,
				status: "confirmed",
				survivor_id: matchData.report_id,
			})
			.select()
			.single();

		if (appointmentError) throw appointmentError;

		// Update matched_services status
		const { error: matchError } = await supabase
			.from("matched_services")
			.update({
				match_status_type: "accepted",
				updated_at: new Date().toISOString(),
			})
			.eq("id", matchId);

		if (matchError) throw matchError;

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
