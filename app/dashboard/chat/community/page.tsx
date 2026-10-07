import { redirect } from "next/navigation";

// The old standalone community screen wrote messages to a non-existent chat. Communities now live
// in the main messaging view (Messages → Communities).
export default function CommunityChatPage() {
	redirect("/dashboard/chat");
}
