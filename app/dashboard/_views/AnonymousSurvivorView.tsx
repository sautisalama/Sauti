"use client";

import { useMemo, useState, useEffect } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { 
	MessageCircle, 
	Shield, 
	Heart, 
	ArrowRight, 
	Plus,
	Search,
	BookOpen
} from "lucide-react";
import Link from "next/link";
import { Tables } from "@/types/db-schema";
import { useDashboard } from "../use-dashboard";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import { 
	SereneWelcomeHeader, 
	SereneQuickActionCard, 
	SereneSectionHeader, 
	SereneActivityCard,
	CalendarWidget,
	DashboardSearchOverlay,
	DashboardEmptyState
} from "../_components/SereneDashboardUI";
import { UpgradeAccountBanner } from "../_components/UpgradeAccountBanner";
import { PolicyModal } from "../_components/PolicyModal";
import { useToast } from "@/hooks/use-toast";

interface AnonymousSurvivorViewProps {
	userId: string;
	profileDetails: Tables<"profiles">;
}

export default function AnonymousSurvivorView({
	userId,
	profileDetails,
}: AnonymousSurvivorViewProps) {
	const { 
		reports, 
		stats, 
		appointments, 
		getTimeOfDay, 
		isReportDialogOpen, 
		setIsReportDialogOpen 
	} = useDashboard();
	
	const dash = useDashboardData();
	const setTopBarTitle = dash?.setTopBarTitle;
	const { toast } = useToast();

	const [hasAcceptedPolicies, setHasAcceptedPolicies] = useState(
		!!(profileDetails.policies as any)?.all_policies_accepted
	);

	// Set title on mount
	useEffect(() => {
		if (setTopBarTitle) setTopBarTitle("Overview");
		return () => {
			if (setTopBarTitle) setTopBarTitle(null);
		};
	}, [setTopBarTitle]);
	
	const searchParams = useSearchParams();
	const router = useRouter();
	const pathname = usePathname();
	const searchQuery = searchParams.get("q") || "";

	const [isWelcomeCompact, setIsWelcomeCompact] = useState(false);

	useEffect(() => {
		const timer = setTimeout(() => setIsWelcomeCompact(true), 30000);
		return () => clearTimeout(timer);
	}, []);

	const filteredReports = useMemo(() => {
		if (!searchQuery) return reports;
		const q = searchQuery.toLowerCase();
		return reports.filter(r => 
			(r.incident_description || "").toLowerCase().includes(q) ||
			(r.type_of_incident || "").toLowerCase().includes(q) ||
			(r.city || "").toLowerCase().includes(q)
		);
	}, [reports, searchQuery]);

	return (
		<>
			{!hasAcceptedPolicies && (
				<PolicyModal 
					userId={userId} 
					initialPolicies={profileDetails.policies} 
					onAccepted={() => {
						setHasAcceptedPolicies(true);
						toast({
							title: "Policies Accepted",
							description: "Welcome to your secure support space.",
						});
					}}
				/>
			)}
			
			<div className="min-h-screen bg-serene-neutral-50 pb-24 overflow-x-hidden">
				<div className="max-w-4xl mx-auto px-4 lg:px-6 pt-4 lg:pt-8 space-y-8 min-h-[calc(100vh-80px)] w-full">
					
					<UpgradeAccountBanner userEmail={profileDetails.email || ""} />

					{searchQuery.length > 0 ? (
						<DashboardSearchOverlay 
							query={searchQuery} 
							filteredReports={filteredReports} 
							onClear={() => router.push(pathname)} 
						/>
					) : (
						<>
							<SereneWelcomeHeader 
								name="Anonymous User" 
								timeOfDay={getTimeOfDay()}
								compact={isWelcomeCompact}
								welcomeMessage={
									<span className="flex flex-col sm:flex-row sm:items-center gap-2">
										<span>This is a temporary secure session. We are here to support you.</span>
									</span>
								}
							/>

							<div className="space-y-4">
								<h3 className="text-sm font-bold text-serene-neutral-400 uppercase tracking-wider px-1">Dashboard</h3>
								<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full auto-rows-fr min-w-0">
									<SereneQuickActionCard
										title="Reports"
										description={`${stats.activeReportsCount} Active`}
										icon={<Shield className="h-5 w-5 text-sauti-red" />}
										href="/dashboard/reports"
										variant="custom"
										className="bg-sauti-red-light border-sauti-red/10"
										badge={stats.activeReportsCount || undefined}
										badgeClassName="bg-sauti-red text-white"
									/>
									<SereneQuickActionCard
										title="Matches"
										description={`${stats.matchedReportsCount} Found`}
										icon={<Heart className="h-5 w-5 text-sauti-yellow" />}
										href="/dashboard/reports"
										variant="custom"
										className="bg-sauti-yellow-light border-sauti-yellow/10"
										badge={stats.matchedReportsCount || undefined}
										badgeClassName="bg-sauti-yellow text-white"
									/>
									<SereneQuickActionCard
										title="Messages"
										description="Support Chat"
										icon={<MessageCircle className="h-5 w-5 text-sauti-teal" />}
										href="/dashboard/chat"
										variant="custom"
										className="bg-sauti-teal-light border-sauti-teal/10"
										badge={stats.unreadChatCount || undefined}
										badgeClassName="bg-sauti-teal text-white"
									/>
									<SereneQuickActionCard
										title="Resources"
										description="Help & Guides"
										icon={<BookOpen className="h-5 w-5 text-gray-500" />}
										href="/dashboard/resources"
										variant="neutral"
									/>
								</div>
							</div>

							<CalendarWidget 
								appointments={appointments} 
								upcomingAppointmentsCount={stats.upcomingAppointmentsCount} 
							/>

							<div>
								<SereneSectionHeader 
									title="Recent Activity" 
									description="Latest updates on your cases"
									action={{ label: "View All", href: "/dashboard/reports" }}
								/>
								
								<div className="space-y-3">
									{reports.length > 0 ? (
										reports.slice(0, 3).map((report) => (
											<SereneActivityCard 
												key={report.report_id}
												report={report}
												href={`/dashboard/reports/${report.report_id}`}
											/>
										))
									) : (
										<DashboardEmptyState 
											icon={<Shield className="h-6 w-6" />}
											title="No active cases found"
											description="Start a new report to get support"
											action={{ label: "Start a new report", href: "/report-abuse" }}
										/>
									)}
								</div>
							</div>
						</>
					)}
				</div>
			</div>
		</>
	);
}
