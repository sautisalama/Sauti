"use server";

import { createClient } from "@/utils/supabase/server";
import { Database } from "@/types/db-schema";
import { SupabaseClient } from "@supabase/supabase-js";
import { sendNotification } from "@/lib/notifications";
import {
	matchFoundProfessionalEmail,
	matchFoundSurvivorEmail,
} from "@/lib/notifications/templates";

import {
	runMatchingPipeline,
	type MatchResult,
} from "@/lib/matching-engine";

/**
 * Matches a report with appropriate support services.
 *
 * Delegates completely to the shared matching engine pipeline.
 * Handles post-match notification dispatch.
 */
export async function matchReportWithServices(
	reportId: string,
	customClient?: SupabaseClient<Database>,
) {
	const supabase = customClient || (await createClient());

	try {
		// Run the shared matching pipeline
		const matches = await runMatchingPipeline(reportId, supabase);

		if (matches.length === 0) {
			return [];
		}

		// Fetch report details for notifications
		const { data: report } = await supabase
			.from("reports")
			.select("user_id, type_of_incident")
			.eq("report_id", reportId)
			.single();

		const isChildCase =
			report?.type_of_incident === "child_abuse" ||
			report?.type_of_incident === "child_labor";

		// Send notifications to matched professionals
		for (const m of matches) {
			if (m.candidate.owner_user_id) {
				await sendNotification({
					userId: m.candidate.owner_user_id,
					type: "match_found",
					title: isChildCase
						? "URGENT: Child Case Escalation"
						: "New Case Assignment",
					message: isChildCase
						? `Mandatory alert: You have been matched with a child-related case (${report?.type_of_incident || "incident"}).`
						: `You have been matched with a new case requiring ${m.candidate.service_capabilities[0] || "support"} services.`,
					link: "/dashboard/cases",
					metadata: { report_id: reportId },
					sendEmail: true,
					emailHtml: matchFoundProfessionalEmail(
						m.candidate.service_capabilities[0] || "Support",
					),
				});
			}
		}

		// Send notification to survivor
		if (report?.user_id) {
			await sendNotification({
				userId: report.user_id,
				type: "match_found",
				title: "Help is on the way",
				message: `We've matched your report with verified specialists. View them in your dashboard.`,
				link: "/dashboard/cases",
				metadata: { report_id: reportId },
				sendEmail: true,
				emailHtml: matchFoundSurvivorEmail(
					matches[0].candidate.display_name || "Specialist",
					matches[0].candidate.service_capabilities[0],
				),
			});
		}

		return matches;
	} catch (error) {
		console.error("Critical matching engine error:", error);
		throw error;
	}
}

/**
 * BACKFILL MATCHING
 * Searches for reports that currently have no matches and attempts to match them.
 * Usually triggered when a new professional or service is verified.
 */
export async function backfillUnmatchedReports() {
	const supabase = await createClient();

	try {
		// Find all reports that are not record-only and haven't been matched yet
		const { data: unmatchedReports, error } = await supabase
			.from("reports")
			.select("report_id")
			.eq("ismatched", false)
			.eq("record_only", false);

		if (error) throw error;
		if (!unmatchedReports || unmatchedReports.length === 0) return;

		console.log(
			`Starting backfill for ${unmatchedReports.length} unmatched reports...`,
		);

		// Process each unmatched report sequentially to avoid rate limits
		for (const report of unmatchedReports) {
			try {
				await matchReportWithServices(report.report_id);
			} catch (matchErr) {
				console.error(
					`Backfill failed for report ${report.report_id}:`,
					matchErr,
				);
			}
		}

		return { processed: unmatchedReports.length };
	} catch (error) {
		console.error("Backfill matching error:", error);
		throw error;
	}
}

/**
 * REVERSE MATCHING (Proactive matching for a professional)
 * Triggered when a professional who has no cases refreshes their dashboard.
 * Finds reports that match this professional's specific services.
 */
export async function matchProfessionalWithUnmatchedReports(
	professionalUserId: string,
) {
	const supabase = await createClient();

	try {
		// 1. Check if the professional has verified services
		const { data: services } = await supabase
			.from("support_services")
			.select("id, verification_status")
			.eq("user_id", professionalUserId)
			.eq("verification_status", "verified");

		if (!services || services.length === 0) return { matched: 0 };

		const serviceIds = services.map((s) => s.id);

		// 2. Check current active matches
		const { data: activeMatches } = await supabase
			.from("matched_services")
			.select("id, feedback, match_status_type")
			.in("service_id", serviceIds)
			.not("match_status_type", "eq", "completed")
			.not("match_status_type", "eq", "declined");

		// Filter out truly complete cases
		const trulyActiveMatches = (activeMatches || []).filter((m) => {
			try {
				if (m.feedback && typeof m.feedback === "object") {
					return !(m.feedback as Record<string, unknown>).is_prof_complete;
				}
				if (
					m.feedback &&
					typeof m.feedback === "string" &&
					(m.feedback as string).startsWith("{")
				) {
					const status = JSON.parse(m.feedback as string);
					return !status.is_prof_complete;
				}
			} catch { /* ignore */ }
			return true;
		});

		// Rule: Only proactive match if they have NO truly active cases
		if (trulyActiveMatches.length > 0)
			return { status: "has_cases", count: trulyActiveMatches.length };

		// 3. Find unmatched reports that are not record-only
		const { data: unmatchedReports } = await supabase
			.from("reports")
			.select("report_id")
			.eq("ismatched", false)
			.eq("record_only", false)
			.order("submission_timestamp", { ascending: false })
			.limit(15);

		if (!unmatchedReports || unmatchedReports.length === 0)
			return { status: "no_unmatched_reports" };

		console.log(
			`[Proactive Matching] Checking ${unmatchedReports.length} reports for professional ${professionalUserId}...`,
		);

		let newlyMatchedCount = 0;

		for (const report of unmatchedReports) {
			try {
				const matches = await matchReportWithServices(
					report.report_id,
					supabase,
				);
				if (
					matches &&
					Array.isArray(matches) &&
					matches.some((m: MatchResult) => serviceIds.includes(m.candidate.entity_id))
				) {
					newlyMatchedCount++;
				}
			} catch (err) {
				console.error(
					`Proactive match failed for report ${report.report_id}:`,
					err,
				);
			}
		}

		return { status: "success", matched: newlyMatchedCount };
	} catch (error) {
		console.error("Proactive matching critical error:", error);
		throw error;
	}
}
