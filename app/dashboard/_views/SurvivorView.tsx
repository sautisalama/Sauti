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
import { Button } from "@/components/ui/button";
import { Tables } from "@/types/db-schema";
import { useDashboard } from "../use-dashboard";
import { 
	SereneWelcomeHeader, 
	SereneQuickActionCard, 
	SereneSectionHeader, 
	SereneActivityCard,
    CalendarWidget,
    DashboardSearchOverlay,
    DashboardEmptyState
} from "../_components/SereneDashboardUI";

interface SurvivorViewProps {
	userId: string;
	profileDetails: Tables<"profiles">;
}

export default function SurvivorView({
	userId,
	profileDetails,
}: SurvivorViewProps) {
	const { 
        reports, 
        stats, 
        appointments, 
        getTimeOfDay, 
        isReportDialogOpen, 
        setIsReportDialogOpen 
    } = useDashboard();
    
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
		<div className="min-h-screen bg-serene-neutral-50 pb-24">
			<div className="max-w-4xl mx-auto px-4 lg:px-6 pt-4 lg:pt-8 space-y-8 min-h-[calc(100vh-80px)] relative">
				
                {searchQuery.length > 0 ? (
                    <DashboardSearchOverlay 
                        query={searchQuery} 
                        filteredReports={filteredReports} 
                        onClear={() => router.push(pathname)} 
                    />
                ) : (
                    <>
                        <SereneWelcomeHeader 
                            name={profileDetails.first_name || "Friend"} 
                            timeOfDay={getTimeOfDay()}
                            compact={isWelcomeCompact}
                            welcomeMessage={
                                (!profileDetails.first_name || profileDetails.first_name === "Anonymous") ? (
                                    <span className="flex flex-col sm:flex-row sm:items-center gap-2">
                                        <span>Please update your personal details for personalized support.</span>
                                        <Link href="/dashboard/profile" className="inline-flex items-center font-bold text-serene-blue-600 hover:underline text-sm">
                                            Complete Profile <ArrowRight className="ml-1 h-3 w-3" />
                                        </Link>
                                    </span>
                                ) : "Welcome back, you're safe here."
                            }
                        />

                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-serene-neutral-400 uppercase tracking-wider px-1">Dashboard</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">
                                <SereneQuickActionCard
                                    title="Reports"
                                    description={`${stats.activeReportsCount} Active`}
                                    icon={<Shield className="h-5 w-5 text-sauti-red" />}
                                    href="/dashboard/reports"
                                    variant="custom"
                                    className="bg-sauti-red-light border-sauti-red/10"
                                    badge={stats.activeReportsCount || undefined}
                                    badgeClassName="bg-sauti-red text-white"
                                    actionIcon={<Plus className="h-4 w-4" />}
                                    onActionClick={() => setIsReportDialogOpen(true)}
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
	);
}
