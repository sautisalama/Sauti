import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { sendPushToUser } from "@/lib/notifications/push";

/** Sends a test push to the signed-in user's own devices and reports what the server can see. */
export async function POST() {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { count } = await supabase.from("push_subscriptions").select("id", { count: "exact", head: true }).eq("user_id", user.id);
	const configured = Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY);
	if (!configured) return NextResponse.json({ configured, devices: count ?? 0, sent: 0 });

	const { sent } = await sendPushToUser(user.id, {
		title: "Notifications are on",
		body: "This is a test from Sauti Salama.",
		url: "/dashboard",
		tag: "push-test",
	});
	return NextResponse.json({ configured, devices: count ?? 0, sent });
}
