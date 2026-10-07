import { createAdminClient } from "@/utils/supabase/admin-client";
import { sendEmail } from "@/lib/notifications/email";
import { ESCALATION_AFTER_HOURS, ESCALATION_EMAIL_RECIPIENTS } from "@/lib/constants";

/** Matches still waiting on someone to respond. */
const WAITING = ["pending", "proposed", "pending_survivor", "reschedule_requested"] as const;
/** Don't resurrect ancient history the first time this runs. */
const LOOKBACK_DAYS = 14;
const MAX_PER_RUN = 100;

export type StaleCase = {
	kind: "unmatched_report" | "inactive_match";
	refId: string;
	reportId: string | null;
	reason: string;
	hoursWaiting: number;
	incident: string | null;
	urgency: string | null;
	area: string | null;
};

const hoursSince = (iso: string | null, now: number) => (iso ? Math.floor((now - new Date(iso).getTime()) / 36e5) : ESCALATION_AFTER_HOURS);
const label = (s: string | null) => (s ? s.replace(/_/g, " ") : null);

/**
 * Cases that need a human: reported but still unmatched after 24h, or matched
 * but nobody has acted for 24h (no response to the match, or an accepted match
 * with no chat messages).
 */
export async function findStaleCases(now = Date.now()): Promise<StaleCase[]> {
	const admin = createAdminClient();
	const cutoff = new Date(now - ESCALATION_AFTER_HOURS * 36e5).toISOString();
	const floor = new Date(now - LOOKBACK_DAYS * 24 * 36e5).toISOString();
	const out: StaleCase[] = [];

	// 1. Reported, never matched. Record-only reports are deliberately not matched.
	const { data: unmatched, error: e1 } = await admin
		.from("reports")
		.select("report_id, submission_timestamp, type_of_incident, urgency, state, city, record_only")
		.eq("ismatched", false)
		.or("record_only.is.null,record_only.eq.false")
		.lte("submission_timestamp", cutoff)
		.gte("submission_timestamp", floor)
		.order("submission_timestamp", { ascending: true })
		.limit(MAX_PER_RUN);
	if (e1) throw new Error(`unmatched query failed: ${e1.message}`);
	const waitingIds = (unmatched ?? []).map((r) => r.report_id);
	const withLiveMatch = new Set<string>();
	if (waitingIds.length) {
		const { data: live } = await admin
			.from("matched_services")
			.select("report_id")
			.in("report_id", waitingIds)
			.not("match_status_type", "in", "(declined,cancelled)");
		for (const m of live ?? []) if (m.report_id) withLiveMatch.add(m.report_id);
	}
	for (const r of (unmatched ?? []).filter((x) => !withLiveMatch.has(x.report_id))) {
		out.push({
			kind: "unmatched_report",
			refId: r.report_id,
			reportId: r.report_id,
			reason: "Reported and still not matched with a service",
			hoursWaiting: hoursSince(r.submission_timestamp, now),
			incident: label(r.type_of_incident),
			urgency: r.urgency,
			area: r.state || r.city || null,
		});
	}

	// 2. Matched, but no one has responded.
	const { data: waiting, error: e2 } = await admin
		.from("matched_services")
		.select("id, report_id, match_status_type, updated_at, match_date")
		.in("match_status_type", [...WAITING])
		.lte("updated_at", cutoff)
		.gte("updated_at", floor)
		.order("updated_at", { ascending: true })
		.limit(MAX_PER_RUN);
	if (e2) throw new Error(`waiting-match query failed: ${e2.message}`);

	// 3. Accepted, but the conversation never started (or went silent).
	const { data: accepted, error: e3 } = await admin
		.from("matched_services")
		.select("id, report_id, chat_id, professional_accepted_at, updated_at")
		.eq("match_status_type", "accepted")
		.lte("professional_accepted_at", cutoff)
		.gte("professional_accepted_at", floor)
		.limit(MAX_PER_RUN);
	if (e3) throw new Error(`accepted-match query failed: ${e3.message}`);

	const chatIds = (accepted ?? []).map((m) => m.chat_id).filter((x): x is string => !!x);
	const lastMessage = new Map<string, string>();
	if (chatIds.length) {
		const { data: msgs } = await admin
			.from("messages")
			.select("chat_id, created_at")
			.in("chat_id", chatIds)
			.neq("type", "system")
			.order("created_at", { ascending: false })
			.limit(2000);
		for (const m of msgs ?? []) if (m.chat_id && m.created_at && !lastMessage.has(m.chat_id)) lastMessage.set(m.chat_id, m.created_at);
	}
	const silent = (accepted ?? []).filter((m) => {
		const last = m.chat_id ? lastMessage.get(m.chat_id) : undefined;
		return !last || last <= cutoff;
	});

	const matchRows = [
		...(waiting ?? []).map((m) => ({ id: m.id, report_id: m.report_id, since: m.updated_at ?? m.match_date, reason: `Matched, awaiting response (${label(m.match_status_type)})` })),
		...silent.map((m) => ({ id: m.id, report_id: m.report_id, since: lastMessage.get(m.chat_id ?? "") ?? m.professional_accepted_at, reason: "Match accepted but no messages exchanged" })),
	];
	const reportIds = [...new Set(matchRows.map((m) => m.report_id).filter((x): x is string => !!x))];
	const info = new Map<string, { type_of_incident: string | null; urgency: string | null; state: string | null; city: string | null }>();
	if (reportIds.length) {
		const { data } = await admin.from("reports").select("report_id, type_of_incident, urgency, state, city").in("report_id", reportIds);
		for (const r of data ?? []) info.set(r.report_id, r);
	}
	for (const m of matchRows) {
		const r = m.report_id ? info.get(m.report_id) : undefined;
		out.push({
			kind: "inactive_match",
			refId: m.id,
			reportId: m.report_id,
			reason: m.reason,
			hoursWaiting: hoursSince(m.since, now),
			incident: label(r?.type_of_incident ?? null),
			urgency: r?.urgency ?? null,
			area: r?.state || r?.city || null,
		});
	}
	return out;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/**
 * Deliberately contains no survivor-identifying detail (no name, phone, email
 * or narrative) — just enough for a coordinator to open the case in the admin
 * dashboard. Email is not a safe channel for survivor data.
 */
export function buildEscalationEmail(cases: StaleCase[], appUrl: string) {
	const rows = cases
		.sort((a, b) => b.hoursWaiting - a.hoursWaiting)
		.map(
			(c) => `<tr>
				<td style="padding:8px;border:1px solid #e5e7eb;font-family:monospace">${esc((c.reportId ?? c.refId).slice(0, 8))}</td>
				<td style="padding:8px;border:1px solid #e5e7eb">${esc(c.reason)}</td>
				<td style="padding:8px;border:1px solid #e5e7eb"><b>${c.hoursWaiting}h</b></td>
				<td style="padding:8px;border:1px solid #e5e7eb">${esc(c.urgency ?? "—")}</td>
				<td style="padding:8px;border:1px solid #e5e7eb">${esc(c.incident ?? "—")}</td>
				<td style="padding:8px;border:1px solid #e5e7eb">${esc(c.area ?? "—")}</td>
			</tr>`
		)
		.join("");
	const unmatched = cases.filter((c) => c.kind === "unmatched_report").length;
	const inactive = cases.length - unmatched;
	// The subject is intentionally just this; urgency is carried by the priority headers and the banner.
	const subject = "Delayed Support";
	const html = `<div style="font-family:Arial,sans-serif;max-width:720px;color:#1f2937">
		<div style="background:#b91c1c;color:#fff;padding:14px 18px;border-radius:10px 10px 0 0;font-size:18px;font-weight:bold">Delayed Support — action needed</div>
		<div style="border:1px solid #e5e7eb;border-top:0;padding:18px;border-radius:0 0 10px 10px">
			<p style="margin-top:0">${cases.length} case${cases.length === 1 ? " has" : "s have"} had no progress for more than ${ESCALATION_AFTER_HOURS} hours:
			<b>${unmatched}</b> reported but not matched, <b>${inactive}</b> matched with no activity.</p>
			<table style="border-collapse:collapse;width:100%;font-size:14px">
				<thead><tr style="background:#f3f4f6;text-align:left">
					<th style="padding:8px;border:1px solid #e5e7eb">Case</th><th style="padding:8px;border:1px solid #e5e7eb">Issue</th>
					<th style="padding:8px;border:1px solid #e5e7eb">Waiting</th><th style="padding:8px;border:1px solid #e5e7eb">Urgency</th>
					<th style="padding:8px;border:1px solid #e5e7eb">Type</th><th style="padding:8px;border:1px solid #e5e7eb">Area</th>
				</tr></thead><tbody>${rows}</tbody>
			</table>
			<p style="margin:18px 0"><a href="${appUrl}/dashboard/admin/matching" style="background:#b91c1c;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold">Open the matching dashboard</a></p>
			<p style="font-size:12px;color:#6b7280">Survivor details are intentionally left out of this email. Sign in to view and act on each case. You will not be alerted again for these cases.</p>
		</div></div>`;
	return { subject, html };
}

/**
 * Find stale cases, claim them in the ledger (so concurrent runs can't double
 * send), email the digest, and release the claim if the email fails so the
 * next run retries.
 */
export async function escalateStaleCases(appUrl: string) {
	const admin = createAdminClient();
	const stale = await findStaleCases();
	if (!stale.length) return { found: 0, sent: 0 };

	const claimed: StaleCase[] = [];
	for (const c of stale) {
		const { data, error } = await admin
			.from("case_escalation_alerts")
			.upsert({ kind: c.kind, ref_id: c.refId, report_id: c.reportId }, { onConflict: "kind,ref_id", ignoreDuplicates: true })
			.select("id");
		if (error) throw new Error(`ledger write failed: ${error.message}`);
		if (data?.length) claimed.push(c);
	}
	if (!claimed.length) return { found: stale.length, sent: 0 };

	const { subject, html } = buildEscalationEmail(claimed, appUrl);
	const res = await sendEmail([...ESCALATION_EMAIL_RECIPIENTS], subject, html, { email: "alerts@sautisalama.org", name: "Sauti Salama Alerts" }, { urgent: true, category: "Urgent Escalation" });
	if (!res.success) {
		for (const c of claimed) await admin.from("case_escalation_alerts").delete().eq("kind", c.kind).eq("ref_id", c.refId);
		throw new Error(`escalation email failed: ${String(res.error)}`);
	}
	return { found: stale.length, sent: claimed.length };
}
