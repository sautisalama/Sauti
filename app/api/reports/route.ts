import { NextResponse } from "next/server";
import { REPORT_EMAIL_RECIPIENTS, REPORT_EMAIL_SENDER } from "@/lib/constants";
import { createClient } from "@/utils/supabase/server";
import { Database, TablesInsert } from "@/types/db-schema";
import { matchReportWithServices } from "@/app/actions/match-services";
import { sendEmail } from "@/lib/notifications/email";
import { sendNotification } from "@/lib/notifications";
import { newReportAdminEmail } from "@/lib/notifications/templates";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
	try {
		const supabase = await createClient();
		let formData;
		try {
			formData = await request.json();
		} catch (e) {
			return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
		}

		// Transform the data to match the database schema
		const reportData: TablesInsert<"reports"> = {
			first_name: formData.first_name || "Anonymous",
			last_name: formData.last_name || null,
			user_id: formData.user_id,
			phone: formData.phone,
			type_of_incident: formData.type_of_incident,
			incident_description: formData.incident_description || null,
			urgency: formData.urgency,
			consent: formData.consent,
			contact_preference: formData.contact_preference,
			required_services: formData.required_services,
			latitude: formData.latitude,
			longitude: formData.longitude,
			submission_timestamp: formData.submission_timestamp,
			administrative: formData.administrative || null,
			media: formData.media || null,
			is_onBehalf: !!formData.is_onBehalf,
			additional_info: formData.additional_info
				? JSON.stringify(formData.additional_info)
				: null,
			// Initialize match-related fields
			ismatched: false,
			match_status: "pending" as Database["public"]["Enums"]["match_status_type"],
			email: formData.email,
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

		// If report includes a phone and belongs to an unauth user, attempt to link to existing profile by phone
		try {
			if (!insertedReport.user_id && insertedReport.phone) {
				const { data: profile } = await supabase
					.from("profiles")
					.select("id")
					.eq("phone", insertedReport.phone)
					.single();
				if (profile?.id) {
					await supabase
						.from("reports")
						.update({ user_id: profile.id })
						.eq("report_id", insertedReport.report_id);
				}
			}
		} catch (linkErr) {
			console.warn("Auto-link by phone failed", linkErr);
		}

		// Send Notifications
		try {
            // 1. Notify Admins (Email only)
            const adminEmailHtml = newReportAdminEmail(
                insertedReport.report_id,
                formData.type_of_incident,
                formData.urgency,
                Array.isArray(formData.required_services) ? formData.required_services : [formData.required_services || 'None']
            );
            
			await sendEmail(
				REPORT_EMAIL_RECIPIENTS.map((r) => r.email),
				`New Abuse Report: ${formData.type_of_incident} (${formData.urgency})`,
				adminEmailHtml
			);

            // 2. Notify Reporter (if authenticated)
            if (insertedReport.user_id) {
                await sendNotification({
                    userId: insertedReport.user_id,
                    type: 'system_alert', // Using system_alert as generic "Report Received"
                    title: 'Report Received',
                    message: `We have received your report regarding "${formData.type_of_incident}". Our team is reviewing it.`,
                    link: '/dashboard/reports',
                    metadata: { report_id: insertedReport.report_id },
                    sendEmail: false // Don't spam email for receipt confirmation unless critical? user probably knows they sent it.
                });
            }

		} catch (notificationError) {
			console.error("Notification failed:", notificationError);
            // Don't fail the request
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
				details: error instanceof Error ? error.message : String(error),
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
