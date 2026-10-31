import { createAdminClient } from "@/utils/supabase/admin-client";
import { sendNotification } from "@/lib/notifications";
import { ESCALATION_AFTER_HOURS } from "@/lib/constants";
import type { StaleCase } from "@/lib/cases/escalation";

/** Providers are nudged once a match has waited half the escalation window. */
export const NUDGE_AFTER_HOURS = ESCALATION_AFTER_HOURS / 2;
const LOOKBACK_DAYS = 14;

/** Claim a ledger row; true only for the run that inserted it, so a nudge is never sent twice. */
async function claim(kind: string, refId: string, reportId: string | null) {
	const { data, error } = await createAdminClient()
		.from("case_escalation_alerts")
		.upsert({ kind, ref_id: refId, report_id: reportId }, { onConflict: "kind,ref_id", ignoreDuplicates: true })
		.select("id");
	if (error) throw new Error(`ledger write failed: ${error.message}`);
	return !!data?.length;
}

const release = (kind: string, refId: string) => createAdminClient().from("case_escalation_alerts").delete().eq("kind", kind).eq("ref_id", refId);

/**
 * Tell the provider a match is waiting on them, before it becomes an escalation. In-app and push only
 * (never email, never survivor details), and it respects quiet hours like any other push.
 */
export async function nudgeProviders(appUrl: string, now = Date.now()) {
	const admin = createAdminClient();
	const olderThan = new Date(now - NUDGE_AFTER_HOURS * 36e5).toISOString();
	const floor = new Date(now - LOOKBACK_DAYS * 24 * 36e5).toISOString();
	const { data: waiting, error } = await admin
		.from("matched_services")
		.select("id, report_id, service_id, updated_at, match_date")
		.eq("match_status_type", "pending")
		.lte("updated_at", olderThan)
		.gte("updated_at", floor)
		.limit(100);
	if (error) throw new Error(`nudge query failed: ${error.message}`);
	if (!waiting?.length) return { waiting: 0, sent: 0 };

	const serviceIds = [...new Set(waiting.map((m) => m.service_id).filter((x): x is string => !!x))];
	const reportIds = [...new Set(waiting.map((m) => m.report_id).filter((x): x is string => !!x))];
	const [{ data: services }, { data: reports }] = await Promise.all([
		serviceIds.length ? admin.from("support_services").select("id, user_id").in("id", serviceIds) : Promise.resolve({ data: [] as { id: string; user_id: string | null }[] }),
		reportIds.length ? admin.from("reports").select("report_id, urgency").in("report_id", reportIds) : Promise.resolve({ data: [] as { report_id: string; urgency: string | null }[] }),
	]);
	const owner = new Map((services ?? []).map((s) => [s.id, s.user_id]));
	const urgency = new Map((reports ?? []).map((r) => [r.report_id, r.urgency]));

	let sent = 0;
	for (const m of waiting) {
		const userId = m.service_id ? owner.get(m.service_id) : null;
		if (!userId) continue;
		if (!(await claim("provider_nudge", m.id, m.report_id))) continue;
		try {
			await sendNotification({
				userId,
				type: "case_waiting",
				title: "A case is waiting for your response",
				message: `It will be passed to our team if no one responds within ${ESCALATION_AFTER_HOURS} hours. Accept it, or decline so it can move on.`,
				link: "/dashboard/cases",
				metadata: { match_id: m.id, urgency: (m.report_id && urgency.get(m.report_id)) || null },
				sendEmail: false,
			});
			sent++;
		} catch (e) {
			await release("provider_nudge", m.id);
			console.error("[nudge] provider notification failed:", e);
		}
	}
	return { waiting: waiting.length, sent };
}

/**
 * When a case has gone the full window without progress and the team has been alerted, say so to the
 * survivor: they should never be left wondering. In-app only, calm, nothing for them to do.
 */
export async function reassureSurvivors(cases: StaleCase[]) {
	const admin = createAdminClient();
	const withReport = cases.filter((c) => c.reportId);
	if (!withReport.length) return { sent: 0 };
	const { data: reports } = await admin.from("reports").select("report_id, user_id").in("report_id", withReport.map((c) => c.reportId!));
	const survivor = new Map((reports ?? []).map((r) => [r.report_id, r.user_id]));
	const done = new Set<string>();
	let sent = 0;
	for (const c of withReport) {
		const userId = survivor.get(c.reportId!);
		// One message per report, even if it appears as both unmatched and inactive.
		if (!userId || done.has(c.reportId!)) continue;
		done.add(c.reportId!);
		if (!(await claim("survivor_followup", c.reportId!, c.reportId))) continue;
		try {
			await sendNotification({
				userId,
				type: "case_followup",
				title: "We're following this up",
				message: "Your request hasn't been picked up yet, so our team has been told and is helping find the right support. You don't need to do anything.",
				link: "/dashboard",
				metadata: { report_id: c.reportId },
				sendEmail: false,
			});
			sent++;
		} catch (e) {
			await release("survivor_followup", c.reportId!);
			console.error("[followup] survivor notification failed:", e);
		}
	}
	return { sent };
}
