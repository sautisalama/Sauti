import { Suspense } from "react";
import { ChatLayout } from "@/components/chat/ChatLayout";
import { MjengoLoader } from "../_components/MjengoLoader";

/** The platform chats, inside the suite, so nobody has to leave it to reach their conversations. */
export default function MjengoChatPage() {
	return (
		<Suspense fallback={<MjengoLoader label="Opening your chats" className="h-full min-h-0" />}>
			<ChatLayout basePath="/dashboard/mjengo/chat" embedded />
		</Suspense>
	);
}
