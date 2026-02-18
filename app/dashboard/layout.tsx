import { getUser } from "@/utils/supabase/server";
import { redirect } from "next/navigation";
import { EnhancedSidebar } from "@/components/navigation/EnhancedSidebar";
import { EnhancedBottomNav } from "@/components/navigation/EnhancedBottomNav";
import { DashboardContent } from "@/components/dashboard/DashboardContent";
import { MobileTopBar } from "@/components/navigation/MobileTopBar";
import { MobileReportFAB } from "@/components/reports/MobileReportFAB";

import { DashboardDataProvider } from "@/components/providers/DashboardDataProvider";
import { fetchDashboardData } from "./_data/aggregate";
import { DeviceRegistration } from "./_components/DeviceRegistration";


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
				{/* Device session tracking */}
				<DeviceRegistration />
				{/* Desktop Sidebar */}
				<EnhancedSidebar />

				{/* Mobile Top Bar */}
				<MobileTopBar />

				{/* Main Content Area - Handles dynamic margins for sidebar */}
				<DashboardContent>

					<div id="main-content" className="lg:pt-0 lg:pb-0 min-h-screen">
						{children}
					</div>

				</DashboardContent>

				{/* Mobile Bottom Navigation */}
				<EnhancedBottomNav />
                
                {/* Mobile Report FAB */}
                <MobileReportFAB />
			</DashboardDataProvider>
		</div>
	);
}
