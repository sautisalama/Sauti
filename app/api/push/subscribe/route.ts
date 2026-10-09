import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

type Sub = { endpoint?: string; keys?: { p256dh?: string; auth?: string } };

export async function POST(request: Request) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const sub = (await request.json().catch(() => null)) as Sub | null;
	if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth || !sub.endpoint.startsWith("https://")) {
		return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
	}

	// A device belongs to whoever is signed in on it now (shared phones): replace any prior owner.
	await supabase.from("push_subscriptions").delete().eq("endpoint", sub.endpoint);
	const { error } = await supabase.from("push_subscriptions").insert({
		user_id: user.id,
		endpoint: sub.endpoint,
		p256dh: sub.keys.p256dh,
		auth: sub.keys.auth,
		user_agent: request.headers.get("user-agent")?.slice(0, 200) ?? null,
	});
	if (error) return NextResponse.json({ error: "Could not save subscription" }, { status: 500 });
	return NextResponse.json({ success: true });
}

export async function DELETE(request: Request) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	const { endpoint } = (await request.json().catch(() => ({}))) as { endpoint?: string };
	if (!endpoint) return NextResponse.json({ error: "Missing endpoint" }, { status: 400 });
	await supabase.from("push_subscriptions").delete().eq("endpoint", endpoint).eq("user_id", user.id);
	return NextResponse.json({ success: true });
}
