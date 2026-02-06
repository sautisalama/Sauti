"use client";

import { createClient } from "@/utils/supabase/client";
import { Database, Tables } from "@/types/db-schema";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import {
	Search,
	MessageCircle,
	CalendarDays,
	BookOpen,
	Shield,
	Heart,
	TrendingUp,
	CheckCircle,
	Plus,
	Trash2,
	ChevronRight,
	SlidersHorizontal
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import {
	SereneWelcomeHeader,
	SereneQuickActionCard,
	SereneStatsCard,
	SereneSectionHeader
} from "../_components/SurvivorDashboardComponents";
import { Badge } from "@/components/ui/badge";
import {
	Sheet,
	SheetContent,
	SheetHeader,
	SheetTitle,
	SheetTrigger,
} from "@/components/ui/sheet";
import AuthenticatedReportAbuseForm from "@/components/AuthenticatedReportAbuseForm";

interface ReportWithRelations extends Tables<"reports"> {
	matched_services?: Array<{
		id: string;
		match_status_type: Database["public"]["Enums"]["match_status_type"];
		match_date: string | null;
		match_score: number | null;
		support_services: {
			id: string;
			name: string;
			service_types: Database["public"]["Enums"]["support_service_type"];
		};
		appointments?: Array<{
			id: string;
			date: string;
			status: Database["public"]["Enums"]["appointment_status_type"] | null;
			professional_id: string | null;
			survivor_id: string | null;
		}>;
	}>;
}

interface SurvivorViewProps {
	userId: string;
	profileDetails: Tables<"profiles">;
}

export default function SurvivorView({
	userId,
	profileDetails,
}: SurvivorViewProps) {
	const dash = useDashboardData();
	const [reports, setReports] = useState<ReportWithRelations[]>(() => {
		const seeded = (dash?.data?.reports as any) || [];
		if (seeded && Array.isArray(seeded) && seeded.length) return seeded as any;
		return [];
	});
	const [searchQuery, setSearchQuery] = useState("");
	const { toast } = useToast();

	// Computed stats
	const activeCasesCount = useMemo(() => reports.length, [reports]);
	const matchedCount = useMemo(
		() => reports.filter((r) => (r.matched_services?.length || 0) > 0).length,
		[reports]
	);
	const upcomingAppointments = useMemo(() => {
		// Flatten appointments from matches
		const apps: any[] = [];
		reports.forEach(r => {
			r.matched_services?.forEach(m => {
				if (m.appointments) apps.push(...m.appointments);
			});
		});
		return apps.filter(a => new Date(a.date) > new Date()).length;
	}, [reports]);

	const getTimeOfDay = (): "morning" | "afternoon" | "evening" => {
		const hour = new Date().getHours();
		if (hour < 12) return "morning";
		if (hour < 18) return "afternoon";
		return "evening";
	};
	
	const [isReportSheetOpen, setIsReportSheetOpen] = useState(false);

	const [isWelcomeCompact, setIsWelcomeCompact] = useState(false);

	useEffect(() => {
		const timer = setTimeout(() => {
			setIsWelcomeCompact(true);
		}, 30000);
		return () => clearTimeout(timer);
	}, []);

	const filteredReports = useMemo(() => {
		if (!searchQuery) return reports;
		const q = searchQuery.toLowerCase();
		return reports.filter(r => 
			(r.incident_description || "").toLowerCase().includes(q) ||
			(r.type_of_incident || "").toLowerCase().includes(q) ||
			(r.city || "").toLowerCase().includes(q) ||
			(r.match_status || "").toLowerCase().includes(q)
		);
	}, [reports, searchQuery]);

	return (
		<div className="min-h-screen bg-serene-neutral-50 pb-24">
			{/* Floating Search Bar (Mobile/Desktop) */}
			<div className="sticky top-0 z-40 bg-serene-neutral-50/90 backdrop-blur-md px-4 py-3 lg:px-8 border-b border-serene-neutral-200/50">
				<div className="max-w-xl mx-auto relative">
					<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-serene-neutral-400" />
					<Input 
						placeholder="Search your cases, resources..." 
						className="pl-10 pr-10 bg-white border-serene-neutral-200 rounded-full h-11 shadow-sm focus-visible:ring-serene-blue-200"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
					<div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-1">
						{/* Desktop "New" shortcut in search bar */}
						<Button size="sm" variant="ghost" className="hidden sm:flex h-8 w-8 rounded-full text-serene-blue-600 hover:bg-serene-blue-50" onClick={() => setIsReportSheetOpen(true)}>
							<Plus className="h-4 w-4" />
						</Button>
						<Button size="icon" variant="ghost" className="h-9 w-9 text-serene-neutral-400 hover:text-serene-blue-600 rounded-full">
							<SlidersHorizontal className="h-4 w-4" />
						</Button>
					</div>
				</div>
			</div>

			<div className="max-w-4xl mx-auto px-4 lg:px-6 pt-4 lg:pt-8 space-y-8 min-h-[calc(100vh-80px)] relative">
				
                {/* Search Overlay Mode */}
                {searchQuery.length > 0 ? (
                    <div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between pb-2 border-b border-serene-neutral-200">
                            <h3 className="text-lg font-bold text-serene-neutral-900">
                                Search Results
                            </h3>
                            <button 
                                onClick={() => setSearchQuery("")}
                                className="text-sm font-medium text-serene-neutral-500 hover:text-serene-red-500 transition-colors"
                            >
                                Clear Search
                            </button>
                        </div>
                        
                        <div className="space-y-3">
                            {filteredReports.length > 0 ? (
                                filteredReports.map((report) => (
                                    <Link href={`/dashboard/reports/${report.report_id}`} key={report.report_id} className="block group">
                                        <Card className="overflow-hidden border-serene-neutral-100 hover:border-serene-blue-200 transition-all duration-300 hover:shadow-md cursor-pointer">
                                            <CardContent className="p-4 flex items-center gap-4">
                                                <div className={cn(
                                                    "h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0",
                                                    "bg-serene-blue-50 text-serene-blue-600"
                                                )}>
                                                    {report.type_of_incident?.charAt(0).toUpperCase() || "R"}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <h4 className="font-semibold text-serene-neutral-900 truncate">
                                                            {report.type_of_incident?.replace(/_/g, " ") || "Incident Report"}
                                                        </h4>
                                                        <span className="text-xs text-serene-neutral-400 font-medium">
                                                            {report.submission_timestamp ? new Date(report.submission_timestamp).toLocaleDateString() : ""}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-serene-neutral-500 truncate">
                                                        {report.incident_description || "No description provided."}
                                                    </p>
                                                </div>
                                                <ChevronRight className="h-4 w-4 text-serene-neutral-300 group-hover:text-serene-blue-400 transition-colors" />
                                            </CardContent>
                                        </Card>
                                    </Link>
                                ))
                            ) : (
                                <div className="text-center py-24">
                                    <div className="h-16 w-16 bg-serene-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Search className="h-8 w-8 text-serene-neutral-400" />
                                    </div>
                                    <h3 className="text-lg font-semibold text-serene-neutral-900 mb-1">No results found</h3>
                                    <p className="text-serene-neutral-500">
                                        We couldn't find any reports matching "{searchQuery}"
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    <>
                        {/* Hero & Greeting */}
                        <SereneWelcomeHeader 
                            name={profileDetails.first_name || "Friend"} 
                            timeOfDay={getTimeOfDay()}
                            compact={isWelcomeCompact}
                        />

                        {/* Quick Stats Overview */}
                        {/* Quick Actions Grid with Embedded Stats */}
                        <div className="space-y-4">
                            <h3 className="text-sm font-bold text-serene-neutral-400 uppercase tracking-wider px-1">Dashboard</h3>
                            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
                                <SereneQuickActionCard
                                    title="Cases"
                                    description={`${activeCasesCount} Active`}
                                    icon={<Shield className="h-5 w-5" />}
                                    href="/dashboard/reports"
                                    variant="blue"
                                    badge={activeCasesCount || undefined}
                                />
                                <SereneQuickActionCard
                                    title="Matches"
                                    description={`${matchedCount} Found`}
                                    icon={<Heart className="h-5 w-5" />}
                                    href="/dashboard/reports"
                                    variant="blue"
                                    badge={matchedCount || undefined}
                                />
                                <SereneQuickActionCard
                                    title="Appointments"
                                    description={`${upcomingAppointments} Upcoming`}
                                    icon={<CalendarDays className="h-5 w-5" />}
                                    href="/dashboard/reports"
                                    variant="blue"
                                    badge={upcomingAppointments || undefined}
                                />
                                <SereneQuickActionCard
                                    title="Messages"
                                    description="Support Chat"
                                    icon={<MessageCircle className="h-5 w-5" />}
                                    href="/dashboard/chat"
                                    variant="green"
                                    badge={dash?.data?.unreadChatCount || undefined}
                                />
                                <SereneQuickActionCard
                                    title="Resources"
                                    description="Help & Guides"
                                    icon={<BookOpen className="h-5 w-5" />}
                                    href="/dashboard/resources"
                                    variant="neutral"
                                />
                            </div>
                        </div>


                        {/* Recent Activity / Active Cases Preview */}
                        <div>
                            <SereneSectionHeader 
                                title="Recent Activity" 
                                description="Latest updates on your cases"
                                action={{ label: "View All", href: "/dashboard/reports" }}
                            />
                            
                            <div className="space-y-3">
                                {reports.length > 0 ? (
                                    reports.slice(0, 3).map((report) => (
                                        <Link href={`/dashboard/reports/${report.report_id}`} key={report.report_id} className="block group">
                                            <Card className="overflow-hidden border-serene-neutral-100 hover:border-serene-blue-200 transition-all duration-300 hover:shadow-md cursor-pointer">
                                                <CardContent className="p-4 flex items-center gap-4">
                                                    <div className={cn(
                                                        "h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0",
                                                        "bg-serene-blue-50 text-serene-blue-600"
                                                    )}>
                                                        {report.type_of_incident?.charAt(0).toUpperCase() || "R"}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-center justify-between mb-1">
                                                            <h4 className="font-semibold text-serene-neutral-900 truncate">
                                                                {report.type_of_incident?.replace(/_/g, " ") || "Incident Report"}
                                                            </h4>
                                                            <span className="text-xs text-serene-neutral-400 font-medium">
                                                                {report.submission_timestamp ? new Date(report.submission_timestamp).toLocaleDateString() : ""}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-serene-neutral-500 truncate">
                                                            {report.incident_description || "No description provided."}
                                                        </p>
                                                    </div>
                                                    <ChevronRight className="h-4 w-4 text-serene-neutral-300 group-hover:text-serene-blue-400 transition-colors" />
                                                </CardContent>
                                            </Card>
                                        </Link>
                                    ))
                                ) : (
                                    <div className="text-center py-12 bg-white rounded-3xl border border-dashed border-serene-neutral-200">
                                        <p className="text-serene-neutral-400 mb-2">No active cases found</p>
                                        <Button className="text-serene-blue-600 font-semibold" variant="link" asChild>
                                            <Link href="/report-abuse">Start a new report</Link>
                                        </Button>
                                    </div>
                                )}
                            </div>
                        </div>
                    </>
                )}
			</div>
		</div>
	);
}
