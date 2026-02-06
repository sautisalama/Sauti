import { getUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { EnhancedSidebar } from "@/components/navigation/EnhancedSidebar";
import { EnhancedBottomNav } from "@/components/navigation/EnhancedBottomNav";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { MobileProfileButton } from "@/components/navigation/MobileProfileButton";
import { ChatPreloader } from "./_components/ChatPreloader";
import { DashboardDataProvider } from "@/components/providers/DashboardDataProvider";
import { fetchDashboardData } from "./_data/aggregate";
import { UnreadSync } from "./_components/UnreadSync";

export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const user = await getUser();

	if (!user) {
		redirect("/signin");
	}

	const initialData = await fetchDashboardData();

	// Fallback data if full aggregation fails but we have a base user
	const fallbackData: any = {
		userId: user.id,
		profile: user,
		userType: user.user_type,
		reports: [],
		matchedServices: [],
		supportServices: [],
		appointments: [],
		casesCount: 0,
		unreadChatCount: 0,
		preloaded: false,
	};

	return (
		<div className="flex min-h-screen bg-serene-neutral-50 dark:bg-neutral-950 overflow-x-hidden">
			<DashboardDataProvider initialData={initialData || fallbackData}>
				{/* Desktop Sidebar */}
				<EnhancedSidebar />

				{/* Main Content Area - Handles dynamic margins for sidebar */}
				<DashboardContent>
					{/* Keep Stream client warm across all dashboard pages */}
					<ChatPreloader userId={user.id} username={user.first_name || user.id} />
					
					{/* Sync unread count into provider if authenticated */}
					<UnreadSync userId={user.id} username={user.first_name || user.id} />

					<div id="main-content" className="pb-20 lg:pb-0 min-h-screen">
						{children}
					</div>

					{/* Mobile Profile Button - Floating on mobile only */}
					<MobileProfileButton />
				</DashboardContent>

				{/* Mobile Bottom Navigation */}
				<EnhancedBottomNav />
			</DashboardDataProvider>
		</div>
	);
}
