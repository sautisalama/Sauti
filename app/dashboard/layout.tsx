import { getUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { EnhancedSidebar } from "@/components/navigation/EnhancedSidebar";
import { EnhancedBottomNav } from "@/components/navigation/EnhancedBottomNav";
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

	return (
		<div className="flex min-h-screen bg-neutral-50 dark:bg-neutral-900">
			{/* Wrap the whole dashboard in data provider */}
			{initialData ? (
				<DashboardDataProvider initialData={initialData}>
					{/* Desktop Sidebar */}
					<EnhancedSidebar />
					{/* Main Content */}
					<main className="flex-1 lg:ml-72">
						{/* Keep Stream client warm across all dashboard pages */}
						<ChatPreloader userId={user.id} username={user.first_name || user.id} />
						{/* Sync unread count into provider */}
						<UnreadSync userId={user.id} username={user.first_name || user.id} />
						{/* Content with proper spacing for mobile nav */}
						<div id="main-content" className="pb-20 lg:pb-0">
							{children}
						</div>
						{/* Mobile Profile Button */}
						<MobileProfileButton />
					</main>
					{/* Mobile Bottom Navigation */}
					<EnhancedBottomNav />
				</DashboardDataProvider>
			) : (
				<>
					<EnhancedSidebar />
					<main className="flex-1 lg:ml-72">
						<ChatPreloader userId={user.id} username={user.first_name || user.id} />
						<div id="main-content" className="pb-20 lg:pb-0">
							{children}
						</div>
						<MobileProfileButton />
					</main>
					<EnhancedBottomNav />
				</>
			)}
		</div>
	);
}
