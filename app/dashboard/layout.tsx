import { getUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { EnhancedSidebar } from "@/components/navigation/EnhancedSidebar";
import { EnhancedBottomNav } from "@/components/navigation/EnhancedBottomNav";
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
		<div className="flex min-h-screen bg-neutral-50 dark:bg-neutral-900">
			{/* Desktop Sidebar */}
			<EnhancedSidebar />
			
			{/* Main Content */}
			<main className="flex-1 lg:ml-0">
				{/* Keep Stream client warm across all dashboard pages */}
				<ChatPreloader userId={user.id} username={user.first_name || user.id} />
				
				{/* Content with proper spacing for mobile nav */}
				<div className="pb-20 lg:pb-0">
					{children}
				</div>
			</main>
			
			{/* Mobile Bottom Navigation */}
			<EnhancedBottomNav />
		</div>
	);
}
