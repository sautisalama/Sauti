import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

/** Called by the service worker when a chat push reaches the device: marks the messages delivered (double tick). */
export async function POST(request: Request) {
	const supabase = await createClient();
	const { data: { user } } = await supabase.auth.getUser();
	if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

	const { chatId } = (await request.json().catch(() => ({}))) as { chatId?: string };
	if (!chatId || !/^[0-9a-f-]{36}$/i.test(chatId)) return NextResponse.json({ error: "Invalid chat" }, { status: 400 });

	await supabase.rpc("mark_messages_delivered", { p_chat: chatId });
	return NextResponse.json({ success: true });
}
