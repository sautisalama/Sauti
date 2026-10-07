import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/db-schema";
import { runMatchingPipeline, type MatchResult, type MatchingPipelineOptions } from "@/lib/matching-engine";
import { sendNotification } from "@/lib/notifications";
import { matchFoundProfessionalEmail, matchFoundSurvivorEmail } from "@/lib/notifications/templates";

/**
 * Trusted, server-side matching.
 *
 * Matching has to read verified providers, their profiles and their workload, and write
 * matches for other people. None of that is (or should be) visible to the person who
 * submitted the report, so this ALWAYS runs with the service-role client — callers are
 * responsible for authorising the request first. (Running it as the reporter used to
 * find zero candidates, so signed-in survivors were never matched.)
 */
export async function matchReport(
	reportId: string,
	admin: SupabaseClient<Database>,
	options: MatchingPipelineOptions = {}
): Promise<MatchResult[]> {
	const matches = await runMatchingPipeline(reportId, admin, options);
	if (matches.length === 0) return [];

	// It found someone, so any earlier "needs manual review" flag is stale.
	if (!options.dry_run) await admin.from("reports").update({ requires_manual_review: false }).eq("report_id", reportId);

	const { data: report } = await admin.from("reports").select("user_id, type_of_incident").eq("report_id", reportId).single();
	const isChildCase = report?.type_of_incident === "child_abuse" || report?.type_of_incident === "child_labor";

	for (const m of matches) {
		if (!m.candidate.owner_user_id) continue;
		await sendNotification({
			userId: m.candidate.owner_user_id,
			type: "match_found",
			title: isChildCase ? "URGENT: Child Case Escalation" : "New Case Assignment",
			message: isChildCase
				? `Mandatory alert: You have been matched with a child-related case (${report?.type_of_incident || "incident"}).`
				: `You have been matched with a new case requiring ${m.candidate.service_capabilities[0] || "support"} services.`,
			link: "/dashboard/cases",
			metadata: { report_id: reportId },
			sendEmail: true,
			emailHtml: matchFoundProfessionalEmail(m.candidate.service_capabilities[0] || "Support"),
		}).catch((e) => console.error("[matching] professional notification failed:", e));
	}

	if (report?.user_id) {
		await sendNotification({
			userId: report.user_id,
			type: "match_found",
			title: "Help is on the way",
			message: "We've matched your report with verified specialists. View them in your dashboard.",
			link: "/dashboard/cases",
			metadata: { report_id: reportId },
			sendEmail: true,
			emailHtml: matchFoundSurvivorEmail(matches[0].candidate.display_name || "Specialist", matches[0].candidate.service_capabilities[0]),
		}).catch((e) => console.error("[matching] survivor notification failed:", e));
	}

	return matches;
}

/** Highest cascade level already used for a report (a decline moves the report one level up). */
export async function nextCascadeLevel(reportId: string, admin: SupabaseClient<Database>): Promise<number> {
	const { data } = await admin.from("matched_services").select("cascade_level").eq("report_id", reportId).order("cascade_level", { ascending: false }).limit(1);
	return (data?.[0]?.cascade_level ?? 0) + 1;
}

/** Only reports newer than this are worth re-matching automatically. */
const BACKFILL_LOOKBACK_DAYS = 14;
const BACKFILL_MAX = 100;

/**
 * Match reports that are genuinely WAITING — no live match at all (e.g. after a provider is verified).
 * Reports that already have matches awaiting a response are handled by the escalation monitor, and
 * re-running them would only re-notify survivors and providers about cases they already know about.
 */
export async function backfillUnmatched(admin: SupabaseClient<Database>): Promise<{ processed: number }> {
	const since = new Date(Date.now() - BACKFILL_LOOKBACK_DAYS * 24 * 36e5).toISOString();
	const { data: reports, error } = await admin
		.from("reports")
		.select("report_id")
		.eq("ismatched", false)
		.eq("record_only", false)
		.gte("submission_timestamp", since)
		.order("submission_timestamp", { ascending: true })
		.limit(BACKFILL_MAX);
	if (error) throw error;
	const ids = (reports ?? []).map((r) => r.report_id);
	if (!ids.length) return { processed: 0 };

	const { data: live } = await admin.from("matched_services").select("report_id").in("report_id", ids).not("match_status_type", "in", "(declined,cancelled)");
	const hasLiveMatch = new Set((live ?? []).map((m) => m.report_id));

	let processed = 0;
	for (const id of ids.filter((x) => !hasLiveMatch.has(x))) {
		try {
			await matchReport(id, admin);
			processed++;
		} catch (e) {
			console.error(`[matching] backfill failed for ${id}:`, e);
		}
	}
	return { processed };
}
