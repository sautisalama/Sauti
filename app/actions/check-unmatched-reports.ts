"use server";

import { requireAdmin } from "@/lib/auth/require-admin";
import { createAdminClient } from "@/utils/supabase/admin-client";
import { backfillUnmatched } from "@/lib/matching-engine/service";

/** Re-run matching for every waiting report. Admin only. */
export async function checkUnmatchedReports() {
	const auth = await requireAdmin();
	if (!auth.ok) throw new Error(auth.error);
	return backfillUnmatched(createAdminClient());
}
