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

		try {
			// First try to get the user
			const existingUser = await streamClient.queryUsers({ id: session.user.id });

			// If user doesn't exist or was deleted, create a new one
			if (!existingUser.users.length) {
				await streamClient.upsertUsers([
					{
						id: session.user.id,
						name: profile?.first_name || session.user.id,
						role: "user",
					},
				]);
			}

			const token = streamClient.createToken(session.user.id);
			return NextResponse.json({ token });
		} catch (error: any) {
			// Check if it's a rate limit error
			if (error.response?.status === 429) {
				return NextResponse.json(
					{
						error:
							"Too many connection attempts. Please wait a moment before trying again.",
						retryAfter: error.response.headers.get("retry-after") || 60,
					},
					{ status: 429 }
				);
			}
			throw error;
		}
	} catch (error) {
		console.error("Error generating stream token:", error);
		return NextResponse.json(
			{ error: "Failed to generate token" },
			{ status: 500 }
		);
	}
}
