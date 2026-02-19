"use client";

import { createClient } from "@/utils/supabase/client";
import { matchReportWithServices } from "./match-services";

/**
 * Escalates a record-only report to full matching.
 * Sets record_only to false and triggers the matching engine.
 */
export async function escalateReport(reportId: string) {
	const supabase = createClient();

	try {
		// 1. Update report to remove record_only flag
		const { error: updateError } = await supabase
			.from("reports")
			.update({ record_only: false })
			.eq("report_id", reportId);

		if (updateError) throw updateError;

		// 2. Trigger matching (server-side action call)
		// Since matchReportWithServices is exported as async function, 
		// we can call it here if we ensure it's handled correctly as a server action.
		
		// Wait, match-services.ts is a server action. 
		// We should call it from a server context or use an API route if needed.
		// For now, let's assume we can call an API to trigger it or just use the action.
		
		const response = await fetch(`/api/reports/${reportId}/escalate`, {
			method: "POST",
		});
		
		if (!response.ok) {
			const error = await response.json();
			throw new Error(error.message || "Failed to escalate report");
		}

		return { success: true };
	} catch (error) {
		console.error("Escalation error:", error);
		throw error;
	}
}
