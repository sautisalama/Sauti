import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { flushVerificationAlerts } from "@/lib/notifications/verification-alerts";

export const dynamic = "force-dynamic";

/**
 * Called right after a provider saves verification documents so the team hears about it at once.
 * Any signed-in user may call it: it only sends submissions the database has already recorded
 * (claimed atomically, so repeated calls cannot send duplicates) and takes no input.
 */
export async function POST() {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	try {
		const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "https://sautisalama.org").replace(/\/$/, "");
		const { sent } = await flushVerificationAlerts(appUrl.startsWith("http") ? appUrl : `https://${appUrl}`);
		return NextResponse.json({ ok: true, sent });
	} catch (e) {
		console.error("[verification-alerts]", e);
		return NextResponse.json({ ok: false }, { status: 500 });
	}
}
