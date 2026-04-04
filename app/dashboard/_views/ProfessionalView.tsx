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
	FileText,
	MapPin,
	Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
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
    const setTopBarTitle = dash?.setTopBarTitle;

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
		const base = matchedServices.filter(m => {
			const isCompleted = getMatchStatus(m) === 'completed';
			if (dashboardTab === 'cases') return !isCompleted;
			return true;
		});

		if (!searchQuery) return base;
		const q = searchQuery.toLowerCase();
		return base.filter(m =>
			(m.report?.type_of_incident || "").toLowerCase().includes(q) ||
			(m.report?.incident_description || "").toLowerCase().includes(q) ||
			(m.service_details?.name || "").toLowerCase().includes(q)
		);
	}, [matchedServices, searchQuery, dashboardTab]);

	const reportCardProps = useMemo(() => {
		if (reports.length === 0) {
			return {
				title: "Report Case",
				description: "Start a new report",
				icon: <Plus className="h-5 w-5 text-amber-600" />,
				onClick: () => setIsReportDialogOpen(true),
				className: "bg-amber-50 border-amber-100"
			};
		}
		return {
			title: "My Reports",
			description: `${reports.length} Reports`,
			icon: <FileText className="h-5 w-5 text-amber-600" />,
			href: "/dashboard/reports",
			actionIcon: <Plus className="h-4 w-4" />,
			onActionClick: (e: any) => {
				e.stopPropagation();
				setIsReportDialogOpen(true);
			},
			className: "bg-amber-50 border-amber-100"
		};
	}, [reports.length, setIsReportDialogOpen]);

	return (
		<div className="min-h-screen bg-serene-neutral-50 pb-24 overflow-x-hidden">
			<div className="max-w-4xl mx-auto px-4 lg:px-6 pt-4 lg:pt-8 space-y-8 min-h-[calc(100vh-80px)] w-full">
				
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
							<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 w-full auto-rows-fr min-w-0">
								<SereneQuickActionCard
									title="Cases"
									description={`${stats.activeCasesCount} Active`}
									icon={<Users className="h-5 w-5 text-sauti-teal" />}
									href="/dashboard/cases"
									variant="custom"
									className="bg-sauti-teal-light border-sauti-teal/10"
									badge={stats.pendingCasesCount > 0 ? stats.pendingCasesCount : undefined}
									badgeClassName="bg-sauti-teal text-white"
								/>
								<SereneQuickActionCard
									{...reportCardProps}
									variant="custom"
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

						{/* Underlined Tab Toggle (Matching Cases Style) */}
						{reports.length > 0 && (
							<div className="flex items-center gap-6 sm:gap-8 border-b border-serene-neutral-100/60 px-1">
								<button
									onClick={() => setDashboardTab('cases')}
									className={cn(
										"pb-4 text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all relative",
										dashboardTab === 'cases' ? "text-serene-blue-600" : "text-serene-neutral-400 hover:text-serene-neutral-600"
									)}
								>
									Active Cases
									{dashboardTab === 'cases' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-serene-blue-600 rounded-full animate-in fade-in zoom-in duration-300" />}
								</button>
								<button
									onClick={() => setDashboardTab('reports')}
									className={cn(
										"pb-4 text-[10px] sm:text-xs font-bold uppercase tracking-widest transition-all relative",
										dashboardTab === 'reports' ? "text-serene-blue-600" : "text-serene-neutral-400 hover:text-serene-neutral-600"
									)}
								>
									My Reports
									{dashboardTab === 'reports' && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-serene-blue-600 rounded-full animate-in fade-in zoom-in duration-300" />}
								</button>
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
									{filteredCases.length > 0 ? (
										filteredCases.slice(0, 3).map((match) => (
											<Link href={`/dashboard/cases/${match.id}`} key={match.id} className="block group">
												<Card className="overflow-hidden border-serene-neutral-100 hover:border-serene-blue-200 transition-all duration-300 hover:shadow-md cursor-pointer rounded-2xl sm:rounded-3xl">
													<CardContent className="p-4 flex items-center gap-4">
														<div className={cn(
															"h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0 shadow-sm",
															match.report?.urgency === 'high' ? "bg-red-50 text-red-600" : "bg-serene-blue-50 text-serene-blue-600"
														)}>
															{match.report?.type_of_incident?.charAt(0).toUpperCase() || "S"}
														</div>
														<div className="flex-1 min-w-0">
															<div className="flex items-center justify-between mb-1">
                                                                <div className="flex flex-wrap items-center gap-2 min-w-0">
                                                                    <h4 className="font-bold text-serene-neutral-900 truncate">
                                                                        {match.report?.type_of_incident?.replace(/_/g, " ") || "Support Case"}
                                                                    </h4>
                                                                    <Badge variant="outline" className={cn("text-[10px] font-bold uppercase border-0 px-1.5 py-0.5", getStatusTheme(getMatchStatus(match)))}>
                                                                        {getMatchStatus(match)}
                                                                    </Badge>
                                                                    {(match.report?.additional_info as any)?.is_for_child && (
                                                                        <Badge className="bg-amber-100 text-amber-700 border-0 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-md">
                                                                            Child Abuse
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                                {match.match_date && (
                                                                    <span suppressHydrationWarning className="text-xs text-serene-neutral-400 font-medium ml-2 shrink-0 hidden sm:block">
                                                                        {format(new Date(match.match_date), "EEEE, MMM d")}
                                                                    </span>
                                                                )}
															</div>
															<p className="text-sm text-serene-neutral-500 line-clamp-2 leading-relaxed mb-3">
                                                                {match.report?.incident_description || "No description provided."}
                                                            </p>
                                                            <div className="flex flex-wrap items-center gap-2">
                                                                <div className="flex items-center gap-1 text-serene-neutral-400 text-[10px] font-bold uppercase tracking-wider bg-serene-neutral-50 px-2.5 py-1 rounded-md border border-serene-neutral-100">
                                                                    <MapPin className="h-3 w-3" />
                                                                    <span className="truncate">
                                                                        {match.report?.city || "Region Confidential"}
                                                                    </span>
                                                                </div>
                                                                {match.match_date && (
                                                                     <div className="flex items-center gap-1 text-serene-neutral-400 text-[10px] font-bold uppercase tracking-wider bg-serene-neutral-50 px-2.5 py-1 rounded-md border border-serene-neutral-100 sm:hidden">
                                                                        <Clock className="h-3 w-3" />
                                                                        {format(new Date(match.match_date), "MMM d")}
                                                                    </div>
                                                                )}
                                                                {match.report?.urgency === 'high' && (
                                                                    <div className="flex items-center gap-1 text-red-600 bg-red-50 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider border border-red-100">
                                                                        High Urgency
                                                                    </div>
                                                                )}
                                                            </div>
														</div>
														<ChevronRight className="h-4 w-4 shrink-0 text-serene-neutral-200 group-hover:text-serene-blue-400 group-hover:translate-x-1 transition-all" />
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
