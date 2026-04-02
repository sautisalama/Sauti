"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Tables } from "@/types/db-schema";
import { 
	Users, 
	MessageCircle, 
	Briefcase, 
	BookOpen, 
	Plus,
	Shield,
	ChevronRight,
	FileText
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useDashboard } from "../use-dashboard";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import { 
	SereneWelcomeHeader, 
	SereneQuickActionCard, 
	SereneSectionHeader, 
	SereneActivityCard,
	VerificationBanner,
	CalendarWidget,
	DashboardSearchOverlay,
	DashboardEmptyState
} from "../_components/SereneDashboardUI";
import { CalendarConnectionStatus } from "../_components/CalendarConnectionStatus";
import { OutOfOfficeBanner } from "@/components/dashboard/OutOfOfficeBanner";
import { getMatchStatus, getStatusTheme } from "@/lib/utils/case-status";

interface ProfessionalViewProps {
	userId: string;
	profileDetails: Tables<"profiles">;
}

export default function ProfessionalView({
	userId,
	profileDetails,
}: ProfessionalViewProps) {
	const { 
		reports, 
		matchedServices, 
		supportServices, 
		appointments, 
		stats, 
		getTimeOfDay, 
		setIsReportDialogOpen 
	} = useDashboard();
    const dash = useDashboardData();

    // Set title on mount
    useEffect(() => {
        dash?.setTopBarTitle("Overview");
        return () => dash?.setTopBarTitle(null);
    }, [dash]);

    const searchParams = useSearchParams();
    const router = useRouter(); 
    const pathname = usePathname();
	const searchQuery = searchParams.get("q") || "";
	
	const [isWelcomeCompact, setIsWelcomeCompact] = useState(false);
	const [dashboardTab, setDashboardTab] = useState<'cases' | 'reports'>('cases');

	useEffect(() => {
		const timer = setTimeout(() => setIsWelcomeCompact(true), 30000);
		return () => clearTimeout(timer);
	}, []);

	// Auto-switch to reports if no cases but has reports
	useEffect(() => {
		if (matchedServices.length === 0 && reports.length > 0) {
			setDashboardTab('reports');
		}
	}, [matchedServices.length, reports.length]);

	const filteredCases = useMemo(() => {
		if (!searchQuery) return matchedServices;
		const q = searchQuery.toLowerCase();
		return matchedServices.filter(m =>
			(m.report?.type_of_incident || "").toLowerCase().includes(q) ||
			(m.report?.incident_description || "").toLowerCase().includes(q) ||
			(m.service_details?.name || "").toLowerCase().includes(q)
		);
	}, [matchedServices, searchQuery]);

	return (
		<div className="min-h-screen bg-serene-neutral-50 pb-24">
			<div className="max-w-4xl mx-auto px-4 lg:px-6 pt-4 lg:pt-8 space-y-8 min-h-[calc(100vh-80px)]">
				
				{searchQuery.length > 0 ? (
					<DashboardSearchOverlay 
						query={searchQuery} 
						filteredMatches={filteredCases}
						onClear={() => router.push(pathname)} 
					/>
				) : (
					<>
						<SereneWelcomeHeader
							name={profileDetails.first_name || "Partner"}
							timeOfDay={getTimeOfDay()}
							compact={isWelcomeCompact}
							welcomeMessage="Welcome back, ready to make a difference?"
						/>

						<OutOfOfficeBanner userId={userId} />

						<VerificationBanner 
							profileDetails={profileDetails} 
							supportServices={supportServices} 
						/>

						<div className="space-y-4">
							<h3 className="text-sm font-bold text-serene-neutral-400 uppercase tracking-wider px-1">Dashboard</h3>
							<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
								<SereneQuickActionCard
									title="Cases"
									description={`${stats.activeCasesCount} Active`}
									icon={<Users className="h-5 w-5 text-sauti-teal" />}
									href="/dashboard/cases"
									variant="custom"
									className="bg-sauti-teal-light border-sauti-teal/10"
									badge={stats.pendingCasesCount > 0 ? stats.pendingCasesCount : undefined}
                                    badgeClassName="bg-sauti-teal text-white"
                                    actionIcon={<Plus className="h-4 w-4" />}
                                    onActionClick={() => setIsReportDialogOpen(true)}
								/>
								<SereneQuickActionCard
									title="Messages"
									description="Support Chat"
									icon={<MessageCircle className="h-5 w-5 text-serene-blue-600" />}
									href="/dashboard/chat"
									variant="custom"
                                    className="bg-serene-blue-100 border-serene-blue-200"
									badge={stats.unreadChatCount || undefined}
                                    badgeClassName="bg-serene-blue-600 text-white"
								/>
								<SereneQuickActionCard
									title="Services"
									description={`${stats.totalServicesCount} Active`}
									icon={<Briefcase className="h-5 w-5 text-sauti-yellow" />}
									href="/dashboard/profile?section=services"
									variant="custom"
                                    className="bg-sauti-yellow-light border-sauti-yellow/10"
								/>
								<SereneQuickActionCard
									title="Blog Posts"
									description="Write & Share"
									icon={<BookOpen className="h-5 w-5 text-gray-500" />}
									href="/dashboard/blogs"
									variant="neutral"
								/>
							</div>
						</div>

						<CalendarConnectionStatus userId={userId} variant="alert" className="mb-4" />

						<CalendarWidget 
							appointments={appointments} 
							upcomingAppointmentsCount={stats.upcomingAppointmentsCount} 
						/>

						{/* Role Switcher Tab Toggle */}
						{reports.length > 0 && (
							<div className="bg-white rounded-2xl border border-serene-neutral-100 p-1.5 shadow-sm">
								<div className="flex gap-1">
									<button
										onClick={() => setDashboardTab('cases')}
										className={cn(
											"flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
											dashboardTab === 'cases' ? "bg-serene-blue-600 text-white shadow-sm" : "text-serene-neutral-600 hover:bg-serene-neutral-50"
										)}
									>
										<Users className="h-4 w-4" />
										Cases
										{matchedServices.length > 0 && (
											<span className={cn("text-xs px-1.5 py-0.5 rounded-full font-bold ml-1", dashboardTab === 'cases' ? "bg-white/20" : "bg-serene-blue-100 text-serene-blue-700")}>
												{matchedServices.length}
											</span>
										)}
									</button>
									<button
										onClick={() => setDashboardTab('reports')}
										className={cn(
											"flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
											dashboardTab === 'reports' ? "bg-serene-blue-600 text-white shadow-sm" : "text-serene-neutral-600 hover:bg-serene-neutral-50"
										)}
									>
										<FileText className="h-4 w-4" />
										My Reports
										{reports.length > 0 && (
											<span className={cn("text-xs px-1.5 py-0.5 rounded-full font-bold ml-1", dashboardTab === 'reports' ? "bg-white/20" : "bg-amber-100 text-amber-700")}>
												{reports.length}
											</span>
										)}
									</button>
								</div>
							</div>
						)}

						{dashboardTab === 'cases' ? (
							<div className="space-y-6">
								<SereneSectionHeader
									title="Recent Cases"
									description="Assigned support cases"
									action={{ label: "View All", href: "/dashboard/cases" }}
								/>

								<div className="space-y-3">
									{matchedServices.length > 0 ? (
										matchedServices.slice(0, 3).map((match) => (
											<Link href={`/dashboard/cases/${match.id}`} key={match.id} className="block group">
												<Card className="overflow-hidden border-serene-neutral-100 hover:border-serene-blue-200 transition-all duration-300 hover:shadow-md">
													<CardContent className="p-4 flex items-center gap-4">
														<div className={cn(
															"h-12 w-12 rounded-2xl flex items-center justify-center shrink-0",
															match.report?.urgency === 'high' ? "bg-red-50 text-red-600" : "bg-serene-blue-50 text-serene-blue-600"
														)}>
															<Shield className="h-5 w-5" />
														</div>
														<div className="flex-1 min-w-0">
															<div className="flex items-center gap-2 mb-1">
																<h4 className="font-semibold text-serene-neutral-900 truncate">
																	{match.report?.type_of_incident?.replace(/_/g, " ") || "Support Case"}
																</h4>
																<Badge variant="outline" className={cn("text-[10px] font-bold uppercase border-0 px-1.5 py-0.5", getStatusTheme(getMatchStatus(match)))}>
																	{getMatchStatus(match)}
																</Badge>
															</div>
															<p className="text-sm text-serene-neutral-500 truncate">{match.report?.incident_description}</p>
														</div>
														<ChevronRight className="h-4 w-4 text-serene-neutral-300 group-hover:text-serene-blue-400" />
													</CardContent>
												</Card>
											</Link>
										))
									) : (
										<DashboardEmptyState 
											icon={<Users className="h-6 w-6" />}
											title="No cases assigned yet"
											description="Matches will appear here as survivors reach out"
										/>
									)}
								</div>
							</div>
						) : (
							<div className="space-y-6">
								<SereneSectionHeader
									title="My Personal Reports"
									description="Incidents you've reported personally"
									action={{ label: "View All", href: "/dashboard/reports" }}
								/>
								<div className="space-y-3">
									{reports.slice(0, 5).map((report) => (
										<SereneActivityCard 
											key={report.report_id}
											report={report}
											href={`/dashboard/reports/${report.report_id}`}
										/>
									))}
								</div>
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}
