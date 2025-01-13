import { NextResponse } from "next/server";
import { MailtrapClient } from "mailtrap";
import { REPORT_EMAIL_RECIPIENTS, REPORT_EMAIL_SENDER } from "@/lib/constants";
import { createClient } from "@/utils/supabase/server";
import { Database, TablesInsert } from "@/types/db-schema";
import { matchReportWithServices } from "@/app/actions/match-services";

const TOKEN = process.env.MAILTRAP_TOKEN!;
const client = new MailtrapClient({ token: TOKEN });

export async function POST(request: Request) {
	try {
		const supabase = await createClient();
		const formData = await request.json();

		// Transform the data to match the database schema
		const reportData: TablesInsert<"reports"> = {
			first_name: formData.user_id ? 
				(await supabase
					.from('profiles')
					.select('first_name')
					.eq('id', formData.user_id)
					.single()
				).data?.first_name || "Anonymous" : "Anonymous",
			last_name: formData.last_name || null,
			user_id: formData.user_id,
			phone: formData.phone,
			type_of_incident: formData.type_of_incident,
			incident_description: formData.incident_description,
			urgency: formData.urgency,
			consent: formData.consent,
			contact_preference: formData.contact_preference,
			required_services: formData.required_services,
			latitude: formData.latitude,
			longitude: formData.longitude,
			submission_timestamp: formData.submission_timestamp,
			// Initialize match-related fields
			ismatched: false,
			match_status: "pending",
		};

		const { error: supabaseError, data: insertedReport } = await supabase
			.from("reports")
			.insert([reportData])
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
				subject: `New Abuse Report: ${formData.type_of_incident} (${formData.urgency} urgency)`,
				text: `
					New abuse report submitted:
					Type of Incident: ${formData.type_of_incident}
					Urgency: ${formData.urgency}
					Description: ${formData.incident_description}
					Required Services: ${formData.required_services.join(", ")}
					Reporter Information:
					Name: ${formData.first_name}
					Email: ${formData.email}
					Phone: ${formData.phone || "Not provided"}
					Preferred Contact Method: ${formData.contact_preference}
					Consent to Share: ${formData.consent}

					Submitted at: ${formData.submission_timestamp}
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
			JSON.stringify({ 
				error: "Failed to submit report",
				details: error instanceof Error ? error.message : String(error)
			}),
			{
				status: 500,
				headers: { "Content-Type": "application/json" },
			}
		);
	}
}

export type ReportFormData = Omit<
	TablesInsert<"reports">,
	| "report_id"
	| "ismatched"
	| "match_status"
	| "administrative"
	| "location"
	| "plus_code"
	| "support_services"
> & {
	required_services: string[];
	first_name: string;
	user_id: string;
};
