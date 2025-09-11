import { StreamChat } from "stream-chat";
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function POST() {
	const supabase = await createClient();

	try {
	const {
		data: { session },
	} = await supabase.auth.getSession();

	if (!session?.user) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

		const streamClient = StreamChat.getInstance(
			process.env.NEXT_PUBLIC_STREAM_KEY!,
			process.env.STREAM_CHAT_SECRET!
		);

		// Delete all channels (this will also delete all messages)
		const channels = await streamClient.queryChannels({});
		for (const channel of channels) {
			await channel.delete();
		}

		// Delete all users
		const { users } = await streamClient.queryUsers({});
		for (const user of users) {
			await streamClient.deleteUser(user.id, {
				mark_messages_deleted: true,
				hard_delete: true,
			});
		}

		return NextResponse.json({ message: "Reset successful" });
	} catch (error) {
		console.error("Error resetting Stream:", error);
		return NextResponse.json(
			{ error: "Failed to reset Stream" },
			{ status: 500 }
		);
	}
}
