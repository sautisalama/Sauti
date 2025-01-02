import { NextResponse } from "next/server";
import { MailtrapClient } from "mailtrap";
import { REPORT_EMAIL_RECIPIENTS, REPORT_EMAIL_SENDER } from "@/lib/constants";
import { createClient } from "@/utils/supabase/server";
import { Database } from "@/types/db-schema";
import { matchReportWithServices } from "@/app/actions/match-services";

const TOKEN = process.env.MAILTRAP_TOKEN!;
const client = new MailtrapClient({ token: TOKEN });

export async function POST(request: Request) {
	try {
		const supabase = await createClient();
		const data = await request.json();

		const { error: supabaseError, data: insertedReport } = await supabase
			.from("reports")
			.insert([data])
			.select()
			.single();
		if (supabaseError) throw supabaseError;

		// Match the report with support services
		try {
			await matchReportWithServices(insertedReport.report_id);
		} catch (matchError) {
			console.error("Error matching services:", matchError);
			// Continue with the process even if matching fails
		}

		try {
			await client.send({
				from: REPORT_EMAIL_SENDER,
				to: REPORT_EMAIL_RECIPIENTS,
				subject: `New Abuse Report: ${data.type_of_incident} (${data.urgency} urgency)`,
				text: `
					New abuse report submitted:
					Type of Incident: ${data.type_of_incident}
					Urgency: ${data.urgency}
					Description: ${data.incident_description}
					Required Services: ${data.required_services.join(", ")}
					Reporter Information:
					Name: ${data.first_name}
					Email: ${data.email}
					Phone: ${data.phone || "Not provided"}
					Preferred Contact Method: ${data.contact_preference}
					Consent to Share: ${data.consent}

					Submitted at: ${data.submission_timestamp}
				`.trim(),
				category: "Abuse Reports",
			});
		} catch (emailError) {
			console.error("Email sending failed:", emailError);
		}

		return new NextResponse(
			JSON.stringify({ message: "Report submitted successfully" }),
			{
				status: 200,
				headers: { "Content-Type": "application/json" },
			}
		);
	} catch (error) {
		console.error("Error submitting report:", error);
		return new NextResponse(
			JSON.stringify({ error: "Failed to submit report" }),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			}
		);
	}
}

export type ReportFormData = {
	first_name: string | null;
	email: string | null;
	phone: string | null;
	type_of_incident: Database["public"]["Enums"]["incident_type"] | null;
	incident_description: string | null;
	urgency: Database["public"]["Enums"]["urgency_type"] | null;
	consent: Database["public"]["Enums"]["consent_type"] | null;
	contact_preference:
		| Database["public"]["Enums"]["contact_preference_type"]
		| null;
	required_services: string[];
	latitude: number | null;
	longitude: number | null;
	submission_timestamp: string;
};
