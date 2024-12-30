import { StreamChat } from "stream-chat";

export const streamClient = StreamChat.getInstance(
	process.env.NEXT_PUBLIC_STREAM_KEY!
);

export async function connectToStream(userId: string, userName: string) {
	try {
		// Get token from our API
		const response = await fetch("/api/stream/token", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ userId, userName }),
		});

		if (!response.ok) {
			throw new Error("Failed to get chat token");
		}

		const { token } = await response.json();

		// Connect user with the token
		await streamClient.connectUser(
			{
				id: userId,
				name: userName,
			},
			token
		);

		return streamClient;
	} catch (error) {
		console.error("Error connecting to Stream:", error);
		throw error;
	}
}
