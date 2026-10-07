import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { createAdminClient } from "@/utils/supabase/admin-client";

export const runtime = "nodejs";

const BUCKET = "report-audio";
const EXPIRES_SECONDS = 60 * 60;

/** Extract the object path ("reports/123-abc.webm") from a storage URL. */
function objectPath(raw: string): string | null {
	try {
		const u = new URL(raw);
		const m = u.pathname.match(/\/storage\/v1\/object\/(?:public|sign)\/report-audio\/(.+)$/);
		if (!m) return null;
		const path = decodeURIComponent(m[1]);
		return /^reports\/[\w.\-]+$/.test(path) ? path : null;
	} catch {
		return null;
	}
}

/**
 * Hand out a short-lived signed URL for a survivor's voice note, but only to a
 * signed-in person who can already see the report that references it.
 * Visibility is decided by row-level security on `reports`, not by this code:
 * if the viewer's own query cannot read a report pointing at this file, they get 404.
 */
export async function GET(req: Request) {
	const url = new URL(req.url).searchParams.get("url") ?? "";
	const path = objectPath(url);
	if (!path) return NextResponse.json({ error: "Invalid audio link" }, { status: 400 });

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Please sign in" }, { status: 401 });

	const { data: report } = await supabase
		.from("reports")
		.select("report_id")
		.filter("media->>url", "ilike", `%/${path}`)
		.limit(1)
		.maybeSingle();
	if (!report) return NextResponse.json({ error: "Not found" }, { status: 404 });

	const { data, error } = await createAdminClient().storage.from(BUCKET).createSignedUrl(path, EXPIRES_SECONDS);
	if (error || !data?.signedUrl) return NextResponse.json({ error: "Audio unavailable" }, { status: 404 });

	return NextResponse.json({ url: data.signedUrl }, { headers: { "Cache-Control": "private, max-age=0, no-store" } });
}
