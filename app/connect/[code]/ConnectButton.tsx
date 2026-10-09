"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startDirectChat } from "@/app/actions/chat-social";

export function ConnectButton({ userId }: { userId: string }) {
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const router = useRouter();

	const go = async () => {
		setBusy(true);
		setError(null);
		try {
			router.replace(`/dashboard/chat?id=${await startDirectChat(userId)}`);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Could not start the chat.");
			setBusy(false);
		}
	};

	return (
		<>
			<Button onClick={go} disabled={busy} className="w-full gap-2">
				{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <MessageCircle className="h-4 w-4" />} Message
			</Button>
			{error && <p role="alert" className="mt-2 text-sm text-red-600">{error}</p>}
		</>
	);
}
