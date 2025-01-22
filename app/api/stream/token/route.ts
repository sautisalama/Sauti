import { StreamChat } from "stream-chat";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET() {
	const supabase = await createClient();

	try {
		const {
			data: { session },
		} = await supabase.auth.getSession();

		if (!session) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const streamClient = StreamChat.getInstance(
			process.env.NEXT_PUBLIC_STREAM_KEY!,
			process.env.STREAM_CHAT_SECRET!
		);

		// Get user details from Supabase
		const { data: profile } = await supabase
			.from("profiles")
			.select("first_name")
			.eq("id", session.user.id)
			.single();

		// Create or update the Stream user
		await streamClient.upsertUser({
			id: session.user.id,
			name: profile?.first_name || session.user.id,
			role: "user",
		});

		const token = streamClient.createToken(session.user.id);

		return NextResponse.json({ token });
	} catch (error) {
		console.error("Error generating stream token:", error);
		return NextResponse.json(
			{ error: "Failed to generate token" },
			{ status: 500 }
		);
	}
}
