import { getUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { MainSidebar } from "./_views/MainSidebar";
import { ChatPreloader } from "./_components/ChatPreloader";

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const user = await getUser();

	if (!user) {
		redirect("/signin");
	}

	return (
		<div className="flex">
			<MainSidebar />
			<main className="flex-1">
				{/* Keep Stream client warm across all dashboard pages */}
				<ChatPreloader userId={user.id} username={user.first_name || user.id} />
				{children}
			</main>
		</div>
	);
}
