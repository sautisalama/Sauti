import { StreamChat } from "stream-chat";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: Request) {
	return NextResponse.json({ error: "Chat is currently deactivated" }, { status: 503 });
}
