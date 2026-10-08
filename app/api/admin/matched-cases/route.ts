import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin-client";

// Admins have no row-level access to reports, so the review queue reads them here, after an admin check.
// Only the columns the queue shows are returned (no narrative, contact or location detail).
export async function GET() {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { data: me } = await supabase.from("profiles").select("is_admin").eq("id", user.id).single();
	if (!me?.is_admin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

	const { data, error } = await createAdminClient()
		.from("reports")
		.select("report_id, type_of_incident, urgency, submission_timestamp, ismatched, matched_services(id, match_status_type)")
		.eq("ismatched", true)
		.order("submission_timestamp", { ascending: false });

	if (error) return NextResponse.json({ error: "Failed to load matched cases" }, { status: 500 });
	return NextResponse.json({ data: data || [] });
}
