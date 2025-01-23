import { getUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { ChatComponent } from "@/app/dashboard/chat/_components/Chat";

export default async function ChatPage() {
	const user = await getUser();

	if (!user) {
		redirect("/signin");
	}

	return (
		<div className="h-screen">
			<ChatComponent 
				userId={user.id} 
				username={user.first_name || user.id}
			/>
		</div>
	);
}
