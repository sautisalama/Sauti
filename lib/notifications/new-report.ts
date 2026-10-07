import { REPORT_EMAIL_RECIPIENTS } from "@/lib/constants";
import { sendEmail } from "@/lib/notifications/email";
import { newReportAdminEmail } from "@/lib/notifications/templates";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * Tell the response team a new report arrived. Used by BOTH submission routes (signed-in and
 * anonymous) — the anonymous route, which is the main path for survivors, used to send nothing.
 * Contains only report id, incident type, urgency and requested services — never survivor details.
 * Values come from the request body, so they are escaped before going into the HTML.
 */
export async function notifyTeamOfNewReport(report: { reportId: string; incident?: string | null; urgency?: string | null; services?: unknown }) {
	const incident = esc(String(report.incident ?? "unknown"));
	const urgency = esc(String(report.urgency ?? "medium"));
	const services = (Array.isArray(report.services) ? report.services : report.services ? [report.services] : ["None"]).map((s) => esc(String(s)));
	return sendEmail(
		REPORT_EMAIL_RECIPIENTS.map((r) => r.email),
		`New Abuse Report: ${incident} (${urgency})`,
		newReportAdminEmail(report.reportId, incident, urgency, services),
		undefined,
		{ category: "New Report", urgent: urgency === "high" }
	);
}
