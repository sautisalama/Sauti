import { ESCALATION_EMAIL_RECIPIENTS } from "@/lib/constants";
import { createAdminClient } from "@/utils/supabase/admin-client";
import { sendEmail } from "@/lib/notifications/email";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export interface PendingSubmission {
	id: string;
	kind: "profile" | "service";
	subjectId: string;
	ownerName: string;
	subjectName: string;
	role: string;
	documents: number;
	submittedAt: string;
}

export function buildVerificationEmail(items: PendingSubmission[], appUrl: string) {
	const cell = "padding:8px;border:1px solid #e5e7eb";
	const rows = items
		.map(
			(i) => `<tr>
				<td style="${cell}"><b>${esc(i.subjectName)}</b><br><span style="color:#6b7280;font-size:12px">${esc(i.role)}</span></td>
				<td style="${cell}">${i.kind === "service" ? `Service (owner: ${esc(i.ownerName)})` : "Provider profile"}</td>
				<td style="${cell}">${i.documents}</td>
				<td style="${cell}"><a href="${appUrl}/dashboard/admin/review/${encodeURIComponent(i.subjectId)}" style="color:#0f4c81">Review</a></td>
			</tr>`
		)
		.join("");
	const head = (t: string) => `<th style="${cell};text-align:left">${t}</th>`;
	const html = `<div style="font-family:Arial,sans-serif;max-width:640px;margin:0 auto;color:#1f2937">
		<div style="background:#0f4c81;color:#fff;padding:14px 18px;border-radius:10px 10px 0 0;font-weight:bold">Verification documents submitted</div>
		<div style="border:1px solid #e5e7eb;border-top:0;padding:18px;border-radius:0 0 10px 10px">
			<p style="margin:0 0 12px">${items.length === 1 ? "A provider has" : `${items.length} providers have`} submitted documents and ${items.length === 1 ? "is" : "are"} waiting for verification.</p>
			<table style="border-collapse:collapse;width:100%;font-size:13px">
				<tr style="background:#f3f4f6">${head("Who")}${head("What")}${head("Documents")}${head("")}</tr>
				${rows}
			</table>
			<p style="margin:18px 0"><a href="${appUrl}/dashboard/admin/review" style="background:#0f4c81;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Open the Review Queue</a></p>
			<p style="font-size:12px;color:#6b7280">Providers are not matched with survivors until an admin verifies them.</p>
		</div></div>`;
	return { subject: items.length === 1 ? "Verification documents submitted" : `Verification documents submitted (${items.length})`, html };
}

/**
 * Email the team about documents providers have submitted. Rows are CLAIMED first (notified_at is
 * set only where it was still empty), so concurrent callers can never send the same submission twice;
 * if the email fails the claim is released and the hourly monitor retries.
 */
export async function flushVerificationAlerts(appUrl: string) {
	const admin = createAdminClient();
	const { data: pending, error } = await admin
		.from("verification_submissions")
		.select("id")
		.is("notified_at", null)
		.order("submitted_at", { ascending: true })
		.limit(50);
	if (error) throw new Error(`verification ledger read failed: ${error.message}`);
	if (!pending?.length) return { sent: 0 };

	const { data: claimed } = await admin
		.from("verification_submissions")
		.update({ notified_at: new Date().toISOString() })
		.in("id", pending.map((p) => p.id))
		.is("notified_at", null)
		.select("id, kind, subject_id, owner_id, document_count, submitted_at");
	if (!claimed?.length) return { sent: 0 };

	const profileIds = [...new Set(claimed.flatMap((c) => [c.owner_id, c.kind === "profile" ? c.subject_id : null]).filter((x): x is string => !!x))];
	const serviceIds = claimed.filter((c) => c.kind === "service").map((c) => c.subject_id);
	const [{ data: profiles }, { data: services }] = await Promise.all([
		admin.from("profiles").select("id, first_name, last_name, user_type, professional_title").in("id", profileIds),
		serviceIds.length ? admin.from("support_services").select("id, name").in("id", serviceIds) : Promise.resolve({ data: [] as { id: string; name: string }[] }),
	]);
	const pName = new Map((profiles ?? []).map((p) => [p.id, `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim() || "Provider"]));
	const pRole = new Map((profiles ?? []).map((p) => [p.id, p.professional_title || (p.user_type === "ngo" ? "Organisation" : "Professional")]));
	const sName = new Map((services ?? []).map((s) => [s.id, s.name]));

	const items: PendingSubmission[] = claimed.map((c) => ({
		id: c.id,
		kind: c.kind as "profile" | "service",
		subjectId: c.subject_id,
		ownerName: pName.get(c.owner_id ?? "") ?? "Provider",
		subjectName: c.kind === "service" ? sName.get(c.subject_id) ?? "Service" : pName.get(c.subject_id) ?? "Provider",
		role: pRole.get(c.owner_id ?? "") ?? "Provider",
		documents: c.document_count,
		submittedAt: c.submitted_at,
	}));

	const { subject, html } = buildVerificationEmail(items, appUrl);
	const res = await sendEmail([...ESCALATION_EMAIL_RECIPIENTS], subject, html, { email: "alerts@sautisalama.org", name: "Sauti Salama Alerts" }, { category: "Verification Documents" });
	if (!res.success) {
		await admin.from("verification_submissions").update({ notified_at: null }).in("id", claimed.map((c) => c.id));
		throw new Error(`verification email failed: ${String(res.error)}`);
	}

	// In-app notice for admins too (best effort).
	const { data: admins } = await admin.from("profiles").select("id").eq("is_admin", true);
	if (admins?.length) {
		await admin.from("notifications").insert(
			admins.flatMap((a) =>
				items.map((i) => ({
					user_id: a.id,
					type: "new_service_submission",
					title: "Verification documents submitted",
					message: `${i.subjectName} (${i.role}) submitted ${i.documents} document${i.documents === 1 ? "" : "s"} for verification.`,
					link: `/dashboard/admin/review/${i.subjectId}`,
					read: false,
				}))
			)
		);
	}
	return { sent: claimed.length };
}
