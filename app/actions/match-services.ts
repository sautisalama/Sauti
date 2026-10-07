"use server";

import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin-client";
import { requireAdmin } from "@/lib/auth/require-admin";
import { backfillUnmatched, matchReport } from "@/lib/matching-engine/service";
import type { MatchResult } from "@/lib/matching-engine";

/**
 * Client-callable matching actions.
 *
 * These are reachable by any browser, so each one authorises the caller before running
 * the (trusted, service-role) matching service in `lib/matching-engine/service.ts`.
 * Server code that has already authorised the request (API routes, other actions)
 * should call that service directly instead.
 */

/** Match one report. Allowed for the reporter or an admin. */
export async function matchReportWithServices(reportId: string): Promise<MatchResult[]> {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) throw new Error("Unauthorized");

	const admin = createAdminClient();
	const { data: report } = await admin.from("reports").select("user_id").eq("report_id", reportId).maybeSingle();
	if (!report) throw new Error("Report not found");
	if (report.user_id !== user.id) {
		const { data: me } = await admin.from("profiles").select("is_admin").eq("id", user.id).maybeSingle();
		if (!me?.is_admin) throw new Error("Unauthorized");
	}
	return matchReport(reportId, admin);
}

/**
 * Match every waiting report (run when a provider is verified). Admin only.
 * (Previously callable by anyone, and it ran with the caller's permissions, so for an
 * admin it silently found no reports at all.)
 */
export async function backfillUnmatchedReports() {
	const auth = await requireAdmin();
	if (!auth.ok) throw new Error(auth.error);
	return backfillUnmatched(createAdminClient());
}

/**
 * A professional with no active cases asks to be matched with waiting reports.
 * The caller can only do this for themselves.
 */
export async function matchProfessionalWithUnmatchedReports(professionalUserId: string) {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user || user.id !== professionalUserId) throw new Error("Unauthorized");

	const admin = createAdminClient();
	const { data: services } = await admin
		.from("support_services")
		.select("id")
		.eq("user_id", professionalUserId)
		.eq("verification_status", "verified")
		.eq("is_active", true);
	if (!services?.length) return { matched: 0 };
	const serviceIds = services.map((s) => s.id);

	// Only proactively match someone who has no truly active cases.
	const { data: activeMatches } = await admin
		.from("matched_services")
		.select("id, feedback, match_status_type")
		.in("service_id", serviceIds)
		.not("match_status_type", "in", "(completed,declined,cancelled)");
	const trulyActive = (activeMatches ?? []).filter((m) => {
		try {
			const fb = typeof m.feedback === "string" && m.feedback.startsWith("{") ? JSON.parse(m.feedback) : m.feedback;
			if (fb && typeof fb === "object") return !(fb as Record<string, unknown>).is_prof_complete;
		} catch {
			/* ignore */
		}
		return true;
	});
	if (trulyActive.length > 0) return { status: "has_cases", count: trulyActive.length };

	const { data: unmatched } = await admin
		.from("reports")
		.select("report_id")
		.eq("ismatched", false)
		.eq("record_only", false)
		.order("submission_timestamp", { ascending: false })
		.limit(15);
	if (!unmatched?.length) return { status: "no_unmatched_reports" };

	let matched = 0;
	for (const r of unmatched) {
		try {
			const res = await matchReport(r.report_id, admin);
			if (res.some((m) => serviceIds.includes(m.candidate.entity_id))) matched++;
		} catch (e) {
			console.error(`[matching] proactive match failed for ${r.report_id}:`, e);
		}
	}
	return { status: "success", matched };
}
