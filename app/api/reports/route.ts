import { NextResponse } from "next/server";
import { MailtrapClient } from "mailtrap";
import { REPORT_EMAIL_RECIPIENTS, REPORT_EMAIL_SENDER } from "@/lib/constants";
import { createClient } from "@/utils/supabase/server";

const TOKEN = process.env.MAILTRAP_TOKEN!;
const client = new MailtrapClient({ token: TOKEN });

export async function POST(request: Request) {
	try {
		const supabase = createClient();
		const data = await request.json();

		const { error: supabaseError } = await supabase
			.from("reports")
			.insert([data]);
		if (supabaseError) throw supabaseError;

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
