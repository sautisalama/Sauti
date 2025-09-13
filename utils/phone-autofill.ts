/**
 * Phone number autofill utilities for report forms
 */

import { createClient } from "@/utils/supabase/client";

export interface PhoneAutofillResult {
	phone: string | null;
	source: "profile" | "previous_report" | null;
}

/**
 * Attempts to autofill phone number from user profile or previous reports
 */
export async function getPhoneForAutofill(
	userId?: string
): Promise<PhoneAutofillResult> {
	if (!userId) {
		return { phone: null, source: null };
	}

	try {
		const supabase = createClient();

		// First, try to get phone from user profile
		const { data: profile } = await supabase
			.from("profiles")
			.select("phone")
			.eq("id", userId)
			.single();

		if (profile?.phone) {
			return { phone: profile.phone, source: "profile" };
		}

		// If no profile phone, try to get from most recent report
		const { data: recentReport } = await supabase
			.from("reports")
			.select("phone")
			.eq("user_id", userId)
			.not("phone", "is", null)
			.order("submission_timestamp", { ascending: false })
			.limit(1)
			.single();

		if (recentReport?.phone) {
			return { phone: recentReport.phone, source: "previous_report" };
		}

		return { phone: null, source: null };
	} catch (error) {
		console.debug("Phone autofill error:", error);
		return { phone: null, source: null };
	}
}

/**
 * Gets phone number from anonymous reports by email
 */
export async function getPhoneFromEmail(
	email: string
): Promise<PhoneAutofillResult> {
	if (!email) {
		return { phone: null, source: null };
	}

	try {
		const supabase = createClient();

		// Try to get phone from most recent report with this email
		const { data: recentReport } = await supabase
			.from("reports")
			.select("phone")
			.eq("email", email)
			.not("phone", "is", null)
			.order("submission_timestamp", { ascending: false })
			.limit(1)
			.single();

		if (recentReport?.phone) {
			return { phone: recentReport.phone, source: "previous_report" };
		}

		return { phone: null, source: null };
	} catch (error) {
		console.debug("Phone autofill from email error:", error);
		return { phone: null, source: null };
	}
}
