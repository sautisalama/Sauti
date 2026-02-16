"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Tables } from "@/types/db-schema";
import { createClient } from "@/utils/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	Search,
	ClipboardList,
	Users,
	CalendarDays,
	MessageCircle,
	BookOpen,
	Briefcase,
	ChevronRight,
	ChevronUp,
	ChevronDown,
	SlidersHorizontal,
	Lock,
	Clock,
	Plus,
	AlertTriangle,
	FileText,
	TrendingUp,
	Shield,
	Calendar
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import {
	SereneWelcomeHeader,
	SereneQuickActionCard,
	SereneSectionHeader
} from "../_components/SurvivorDashboardComponents";
import { ReportWithRelations, MatchedServiceWithRelations } from "../_types";
import { fetchUserReports, deleteReport } from "./actions/reports";
import { fetchUserSupportServices, deleteSupportService } from "./actions/support-services";
import { fetchMatchedServices } from "./actions/matched-services";
import { fetchUserAppointments } from "./actions/appointments";
import AuthenticatedReportAbuseForm from "@/components/AuthenticatedReportAbuseForm";

interface ProfessionalViewProps {
	userId: string;
	profileDetails: Tables<"profiles">;
}

export default function ProfessionalView({
	userId,
	profileDetails,
}: ProfessionalViewProps) {
	const dash = useDashboardData();
	const { toast } = useToast();
    const searchParams = useSearchParams();
    const router = useRouter(); 
    const pathname = usePathname();
	const searchQuery = searchParams.get("q") || "";
	const [reportDialogOpen, setReportDialogOpen] = useState(false);
	const [isWelcomeCompact, setIsWelcomeCompact] = useState(false);
	const [isCalendarExpanded, setIsCalendarExpanded] = useState(false);
	const [selectedDate, setSelectedDate] = useState(new Date());
	const [calendarViewMode, setCalendarViewMode] = useState<'week' | 'month'>('week');
	const [dashboardTab, setDashboardTab] = useState<'cases' | 'reports'>('cases');

	// State
	const [reports, setReports] = useState<ReportWithRelations[]>([]);
	const [supportServices, setSupportServices] = useState<Tables<"support_services">[]>([]);
	const [matchedServices, setMatchedServices] = useState<MatchedServiceWithRelations[]>([]);
	const [appointments, setAppointments] = useState<any[]>([]);

	const getTimeOfDay = (): "morning" | "afternoon" | "evening" => {
		const hour = new Date().getHours();
		if (hour < 12) return "morning";
		if (hour < 18) return "afternoon";
		return "evening";
	};

	// Auto-compact welcome after 30s
	useEffect(() => {
		const timer = setTimeout(() => setIsWelcomeCompact(true), 30000);
		return () => clearTimeout(timer);
	}, []);

	// Load data from provider or fetch
	useEffect(() => {
		const loadData = async () => {
			try {
				const [userReports, userServices, userMatches, userAppointments] = await Promise.all([
					fetchUserReports(userId),
					fetchUserSupportServices(userId),
					fetchMatchedServices(userId),
					fetchUserAppointments(userId, "professional", true),
				]);
				setReports(userReports as ReportWithRelations[]);
				setSupportServices(userServices);
				setMatchedServices(userMatches);
				setAppointments(userAppointments || []);
			} catch {
				toast({
					title: "Error",
					description: "Failed to load data. Please try again.",
					variant: "destructive",
				});
			}
		};

		if (dash?.data && dash.data.userId === userId) {
			setReports((dash.data.reports as ReportWithRelations[]) || []);
			setSupportServices(dash.data.supportServices || []);
			setMatchedServices((dash.data.matchedServices as any) || []);
			setAppointments(dash.data.appointments || []);
			return;
		}
		loadData();
	}, [userId, toast, dash?.data]);

	// Computed stats
	const activeCasesCount = matchedServices.length;
	const pendingCasesCount = useMemo(
		() => matchedServices.filter(m => m.match_status_type?.toLowerCase() === 'pending').length,
		[matchedServices]
	);
	const upcomingAppointments = useMemo(
		() => appointments.filter(a => a.appointment_date && new Date(a.appointment_date) > new Date()).length,
		[appointments]
	);


	// Verification status
	const isVerified = useMemo(() => {
		const verStatus = (dash?.data as any)?.verification?.overallStatus;
		if (verStatus === "verified") return true;
		const required = [profileDetails?.first_name, profileDetails?.phone, profileDetails?.professional_title];
		return required.every(v => v && v.trim() !== "");
	}, [dash?.data, profileDetails]);

	// Filter cases by search
	const filteredCases = useMemo(() => {
		if (!searchQuery) return matchedServices.slice(0, 5);
		const q = searchQuery.toLowerCase();
		return matchedServices.filter(m =>
			(m.report?.type_of_incident || "").toLowerCase().includes(q) ||
			(m.report?.incident_description || "").toLowerCase().includes(q) ||
			(m.service_details?.name || "").toLowerCase().includes(q)
		);
	}, [matchedServices, searchQuery]);

	// Get week days for calendar
	const getWeekDays = (baseDate: Date) => {
		const start = new Date(baseDate);
		start.setDate(start.getDate() - start.getDay());
		return Array.from({ length: 7 }, (_, i) => {
			const day = new Date(start);
			day.setDate(start.getDate() + i);
			return day;
		});
	};

	const weekDays = useMemo(() => getWeekDays(selectedDate), [selectedDate]);

	// Get month days for calendar (full grid including prev/next month days)
	const getMonthDays = (baseDate: Date) => {
		const year = baseDate.getFullYear();
		const month = baseDate.getMonth();
		const firstDay = new Date(year, month, 1);
		const lastDay = new Date(year, month + 1, 0);
		const startPadding = firstDay.getDay();
		const totalDays = lastDay.getDate();
		const weeks = Math.ceil((startPadding + totalDays) / 7);
		const days: { date: Date; isCurrentMonth: boolean }[] = [];
		
		for (let i = 0; i < weeks * 7; i++) {
			const day = new Date(year, month, 1 - startPadding + i);
			days.push({
				date: day,
				isCurrentMonth: day.getMonth() === month
			});
		}
		return days;
	};

	const monthDays = useMemo(() => getMonthDays(selectedDate), [selectedDate]);

	// Get appointments for a specific day
	const getAppointmentsForDay = (date: Date) => {
		return appointments.filter(a => {
			if (!a.appointment_date) return false;
			const apptDate = new Date(a.appointment_date);
			return apptDate.toDateString() === date.toDateString();
		});
	};

	const selectedDayAppointments = useMemo(
		() => getAppointmentsForDay(selectedDate),
		// eslint-disable-next-line react-hooks/exhaustive-deps
		[selectedDate, appointments]
	);

	return (
		<div className="min-h-screen bg-serene-neutral-50 pb-24">


			<div className="max-w-4xl mx-auto px-4 lg:px-6 pt-4 lg:pt-8 space-y-8 min-h-[calc(100vh-80px)]">
				{/* Search Results Mode */}
				{searchQuery.length > 0 ? (
					<div className="space-y-6 animate-in fade-in zoom-in-95 duration-200">
						<div className="flex items-center justify-between pb-2 border-b border-serene-neutral-200">
							<h3 className="text-lg font-bold text-serene-neutral-900">Search Results</h3>
							<button
								onClick={() => router.push(pathname)}
								className="text-sm font-medium text-serene-neutral-500 hover:text-serene-red-500 transition-colors"
							>
								Clear Search
							</button>
						</div>
						<div className="space-y-3">
							{filteredCases.length > 0 ? (
								filteredCases.map((match) => (
									<Link href={`/dashboard/cases/${match.id}`} key={match.id} className="block group">
										<Card className="overflow-hidden border-serene-neutral-100 hover:border-serene-blue-200 transition-all duration-300 hover:shadow-md cursor-pointer">
											<CardContent className="p-4 flex items-center gap-4">
												<div className={cn(
													"h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold shrink-0",
													"bg-serene-blue-50 text-serene-blue-600"
												)}>
													{match.report?.type_of_incident?.charAt(0).toUpperCase() || "C"}
												</div>
												<div className="flex-1 min-w-0">
													<h4 className="font-semibold text-serene-neutral-900 truncate">
														{match.report?.type_of_incident?.replace(/_/g, " ") || "Case"}
													</h4>
													<p className="text-sm text-serene-neutral-500 truncate">
														{match.service_details?.name || "Support case"}
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
										We couldn't find any cases matching "{searchQuery}"
									</p>
								</div>
							)}
						</div>
					</div>
				) : (
					<>
						{/* Welcome Header */}
						<SereneWelcomeHeader
							name={profileDetails.first_name || "Partner"}
							timeOfDay={getTimeOfDay()}
							compact={isWelcomeCompact}
							welcomeMessage="Welcome back, ready to make a difference?"
						/>

						{/* Verification Banner */}
						{(() => {
							const verifiedCount = supportServices.filter(s => s.verification_status === 'verified').length;
							const reviewCount = supportServices.filter(s => s.verification_status === 'under_review').length;
							const rejectedServices = supportServices.filter(s => s.verification_status === 'rejected');
							const rejectedCount = rejectedServices.length;
							const isProfileRejected = profileDetails.verification_status === 'rejected';
							const total = supportServices.length;

							if (total > 0 && verifiedCount === total && !isProfileRejected) return null;

							let bannerTitle = "Complete your verification";
							let bannerDesc = "Verify your profile to be matched with survivors seeking support.";
							let bannerVariant: "default" | "destructive" | "warning" = "warning";
							let BannerIcon = AlertTriangle;
							let rejectionReason = "";

							if (rejectedCount > 0 || isProfileRejected) {
								bannerTitle = "Action Required: Verification Rejected";
								bannerVariant = "destructive";
								
								// Find specific rejection note
								if (isProfileRejected && profileDetails.verification_notes) {
									rejectionReason = `Profile issues: ${profileDetails.verification_notes}`;
								} else if (rejectedCount > 0) {
									const rejectedNames = rejectedServices.slice(0, 2).map(s => s.name).join(', ');
									rejectionReason = `Service(s) ${rejectedNames} rejected. Reason: ${rejectedServices[0].verification_notes || "Please check documents."}`;
								} else {
									rejectionReason = "Please review your documents and resubmit.";
								}

								bannerDesc = rejectionReason;
							
							} else if (verifiedCount > 0 && reviewCount > 0) {
								bannerTitle = "Verification in Progress";
								bannerDesc = `You have ${verifiedCount} verified service and ${reviewCount} under review. We'll notify you once all are approved.`;
								BannerIcon = Clock;
							} else if (reviewCount > 0) {
								bannerTitle = "Documents Under Review";
								bannerDesc = "We are currently reviewing your documents. This usually takes 24-48 hours.";
								BannerIcon = Clock;
							} else if (total === 0) {
								bannerTitle = "Register your first service";
								bannerDesc = "Add a support service to start helping survivors and complete your provider profile.";
							}

							return (
								<Alert className={cn(
									"border-0 shadow-sm rounded-[2rem] p-5 sm:p-6 transition-all duration-300",
									bannerVariant === "destructive" ? "bg-red-50 text-red-900 shadow-red-100/50" : 
									bannerVariant === "warning" ? "bg-amber-50 text-amber-900 shadow-amber-100/50" : 
									"bg-serene-blue-50 text-serene-blue-900 shadow-serene-blue-100/50"
								)}>
									<div className="flex flex-col sm:flex-row gap-4 sm:items-center">
										<div className={cn(
											"h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm",
											bannerVariant === "destructive" ? "bg-red-100 text-red-600" :
											bannerVariant === "warning" ? "bg-amber-100 text-amber-600" :
											"bg-serene-blue-100 text-serene-blue-600"
										)}>
											<BannerIcon className="h-6 w-6" />
										</div>
										<div className="flex-1">
											<AlertTitle className="font-bold text-base sm:text-lg tracking-tight mb-1">{bannerTitle}</AlertTitle>
											<AlertDescription className="text-sm font-medium opacity-80 leading-relaxed whitespace-pre-line">
												{bannerDesc}
												{bannerVariant === 'destructive' && (
													<div className="flex gap-3 mt-2">
														{(isProfileRejected || !verifiedCount) && (
															<Link href="/dashboard/profile?section=account" className="font-bold border-b border-red-300 hover:border-red-600 transition-colors">
																Fix Personal Details →
															</Link>
														)}
														{(rejectedCount > 0 || total === 0) && (
															<Link href="/dashboard/profile?section=services" className="font-bold border-b border-red-300 hover:border-red-600 transition-colors">
																{rejectedCount > 0 ? "Fix Service Documents →" : "Add Service →"}
															</Link>
														)}
													</div>
												)}
												{bannerVariant !== 'destructive' && (
													<Link href="/dashboard/profile?section=services" className="block sm:inline sm:ml-2 font-bold text-inherit hover:underline underline-offset-4 mt-2 sm:mt-0">
														Manage services →
													</Link>
												)}
											</AlertDescription>
										</div>
									</div>
								</Alert>
							);
						})()}

						{/* Quick Actions Grid */}
						<div className="space-y-4">
							<h3 className="text-sm font-bold text-serene-neutral-400 uppercase tracking-wider px-1">Dashboard</h3>
							<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
								<SereneQuickActionCard
									title="Cases"
									description={`${activeCasesCount} Active`}
									icon={<Users className="h-5 w-5 text-sauti-teal" />}
									href="/dashboard/cases"
									variant="custom"
									className="bg-sauti-teal-light border-sauti-teal/10 shadow-sm hover:shadow-md transition-all"
									badge={pendingCasesCount > 0 ? pendingCasesCount : undefined}
                                    badgeClassName="bg-sauti-teal text-white"
								/>
								<SereneQuickActionCard
									title="Messages"
									description="Support Chat"
									icon={<MessageCircle className="h-5 w-5 text-serene-blue-600" />}
									href="/dashboard/chat"
									variant="custom"
                                    className="bg-serene-blue-100 border-serene-blue-200 shadow-sm hover:shadow-md transition-all"
									badge={dash?.data?.unreadChatCount || undefined}
                                    badgeClassName="bg-serene-blue-600 text-white"
								/>
								<SereneQuickActionCard
									title="Services"
									description={`${supportServices.length} Active`}
									icon={<Briefcase className="h-5 w-5 text-sauti-yellow" />}
									href="/dashboard/profile?tab=services"
									variant="custom"
                                    className="bg-sauti-yellow-light border-sauti-yellow/10 shadow-sm hover:shadow-md transition-all"
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

							{/* Weekly Schedule Calendar */}
							<div className="bg-white rounded-2xl border border-serene-neutral-100 overflow-hidden shadow-sm">
								<button 
									onClick={() => setIsCalendarExpanded(!isCalendarExpanded)}
									className="w-full flex items-center justify-between px-5 py-4 hover:bg-serene-neutral-50/50 transition-colors"
								>
									<div className="flex items-center gap-3">
										<div className="h-10 w-10 bg-serene-blue-50 rounded-xl flex items-center justify-center">
											<Calendar className="h-5 w-5 text-serene-blue-600" />
										</div>
										<div className="text-left">
											<h3 className="font-semibold text-serene-neutral-900">Schedule</h3>
											<p className="text-sm text-serene-neutral-500">
												{upcomingAppointments} upcoming appointment{upcomingAppointments !== 1 ? 's' : ''}
											</p>
										</div>
									</div>
									{isCalendarExpanded ? (
										<ChevronUp className="h-5 w-5 text-serene-neutral-400" />
									) : (
										<ChevronDown className="h-5 w-5 text-serene-neutral-400" />
									)}
								</button>

								{isCalendarExpanded && (
									<div className="border-t border-serene-neutral-100 p-4 space-y-4">
										{/* View Mode Toggle + Navigation */}
										<div className="flex items-center justify-between">
											{/* Week/Month Toggle */}
											<div className="flex bg-serene-neutral-100 rounded-lg p-0.5">
												<button
													onClick={() => setCalendarViewMode('week')}
													className={cn(
														"px-3 py-1.5 text-xs font-medium rounded-md transition-all",
														calendarViewMode === 'week' 
															? "bg-white text-serene-blue-700 shadow-sm"
															: "text-serene-neutral-600 hover:text-serene-neutral-900"
													)}
												>
													Week
												</button>
												<button
													onClick={() => setCalendarViewMode('month')}
													className={cn(
														"px-3 py-1.5 text-xs font-medium rounded-md transition-all",
														calendarViewMode === 'month' 
															? "bg-white text-serene-blue-700 shadow-sm"
															: "text-serene-neutral-600 hover:text-serene-neutral-900"
													)}
												>
													Month
												</button>
											</div>
											
											{/* Date range label */}
											<p className="text-sm font-medium text-serene-neutral-700">
												{calendarViewMode === 'week' 
													? `${weekDays[0].toLocaleDateString('default', { month: 'short', day: 'numeric' })} - ${weekDays[6].toLocaleDateString('default', { month: 'short', day: 'numeric' })}`
													: selectedDate.toLocaleDateString('default', { month: 'long', year: 'numeric' })
												}
											</p>
											
											{/* Navigation */}
											<div className="flex gap-1">
												<Button
													variant="ghost"
													size="sm"
													className="h-8 w-8 p-0"
													onClick={() => {
														const prev = new Date(selectedDate);
														prev.setDate(prev.getDate() - (calendarViewMode === 'week' ? 7 : 30));
														setSelectedDate(prev);
													}}
												>
													←
												</Button>
												<Button
													variant="ghost"
													size="sm"
													className="h-8 w-8 p-0"
													onClick={() => {
														const next = new Date(selectedDate);
														next.setDate(next.getDate() + (calendarViewMode === 'week' ? 7 : 30));
														setSelectedDate(next);
													}}
												>
													→
												</Button>
											</div>
										</div>

								{/* Days Grid - Week or Month */}
								<div className="grid grid-cols-7 gap-1">
									{['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
										<div key={day} className="text-center text-xs font-medium text-serene-neutral-400 py-1">
											{day}
										</div>
									))}
									{calendarViewMode === 'week' ? (
										// Week View
										weekDays.map((day, idx) => {
											const dayAppointments = getAppointmentsForDay(day);
											const isToday = day.toDateString() === new Date().toDateString();
											const isSelected = day.toDateString() === selectedDate.toDateString();
											
											return (
												<button
													key={idx}
													onClick={() => setSelectedDate(day)}
													className={cn(
														"relative aspect-square rounded-xl flex flex-col items-center justify-center transition-all",
														isSelected 
															? "bg-serene-blue-600 text-white" 
															: isToday 
																? "bg-serene-blue-50 text-serene-blue-700" 
																: "hover:bg-serene-neutral-50 text-serene-neutral-700"
													)}
												>
													<span className="text-sm font-semibold">{day.getDate()}</span>
													{dayAppointments.length > 0 && (
														<div className="flex gap-0.5 mt-0.5">
															{Array.from({ length: Math.min(dayAppointments.length, 3) }).map((_, i) => (
																<div 
																	key={i} 
																	className={cn(
																		"h-1 w-1 rounded-full",
																		isSelected ? "bg-white/80" : "bg-serene-blue-500"
																	)} 
																/>
															))}
														</div>
													)}
												</button>
											);
										})
									) : (
										// Month View
										monthDays.map((dayInfo, idx) => {
											const { date: day, isCurrentMonth } = dayInfo;
											const dayAppointments = getAppointmentsForDay(day);
											const isToday = day.toDateString() === new Date().toDateString();
											const isSelected = day.toDateString() === selectedDate.toDateString();
											
											return (
												<button
													key={idx}
													onClick={() => setSelectedDate(day)}
													className={cn(
														"relative h-10 rounded-lg flex flex-col items-center justify-center transition-all text-xs",
														!isCurrentMonth && "opacity-40",
														isSelected 
															? "bg-serene-blue-600 text-white" 
															: isToday 
																? "bg-serene-blue-50 text-serene-blue-700 font-bold" 
																: "hover:bg-serene-neutral-50 text-serene-neutral-700"
													)}
												>
													<span className="font-medium">{day.getDate()}</span>
													{dayAppointments.length > 0 && isCurrentMonth && (
														<div className={cn(
															"h-1 w-1 rounded-full mt-0.5",
															isSelected ? "bg-white/80" : "bg-serene-blue-500"
														)} />
													)}
												</button>
											);
										})
									)}
								</div>

										{/* Selected Day Appointments */}
										<div className="pt-2 border-t border-serene-neutral-100">
											<p className="text-sm font-semibold text-serene-neutral-700 mb-3">
												{selectedDate.toLocaleDateString('default', { weekday: 'long', month: 'long', day: 'numeric' })}
											</p>
											{selectedDayAppointments.length > 0 ? (
												<div className="space-y-2">
													{selectedDayAppointments.map((appt, idx) => (
														<div key={idx} className="flex items-center gap-3 p-3 bg-serene-neutral-50/80 rounded-xl">
															<div className="h-10 w-10 bg-serene-blue-100 rounded-lg flex items-center justify-center text-serene-blue-700">
																<Clock className="h-4 w-4" />
															</div>
															<div className="flex-1 min-w-0">
																<p className="font-medium text-serene-neutral-900 text-sm truncate">
																	{appt.matched_service?.service_details?.name || 'Appointment'}
																</p>
																<p className="text-xs text-serene-neutral-500">
																	{new Date(appt.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
																</p>
															</div>
															<Badge className="bg-serene-blue-50 text-serene-blue-700 border-0 text-xs">
																{appt.status || 'Scheduled'}
															</Badge>
														</div>
													))}
												</div>
											) : (
												<p className="text-sm text-serene-neutral-400 text-center py-4">
													No appointments scheduled for this day
												</p>
											)}
										</div>
									</div>
								)}
							</div>

						{/* Cases/Reports Tab Toggle - Only show if user has reports */}
						{reports.length > 0 && (
							<div className="bg-white rounded-2xl border border-serene-neutral-100 p-1.5 shadow-sm">
								<div className="flex gap-1">
									<button
										onClick={() => setDashboardTab('cases')}
										className={cn(
											"flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
											dashboardTab === 'cases'
												? "bg-serene-blue-600 text-white shadow-sm"
												: "text-serene-neutral-600 hover:bg-serene-neutral-50"
										)}
									>
										<Users className="h-4 w-4" />
										Cases
										{matchedServices.length > 0 && (
											<span className={cn(
												"text-xs px-1.5 py-0.5 rounded-full font-bold",
												dashboardTab === 'cases' ? "bg-white/20" : "bg-serene-blue-100 text-serene-blue-700"
											)}>
												{matchedServices.length}
											</span>
										)}
									</button>
									<button
										onClick={() => setDashboardTab('reports')}
										className={cn(
											"flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all",
											dashboardTab === 'reports'
												? "bg-serene-blue-600 text-white shadow-sm"
												: "text-serene-neutral-600 hover:bg-serene-neutral-50"
										)}
									>
										<FileText className="h-4 w-4" />
										My Reports
										{reports.length > 0 && (
											<span className={cn(
												"text-xs px-1.5 py-0.5 rounded-full font-bold",
												dashboardTab === 'reports' ? "bg-white/20" : "bg-amber-100 text-amber-700"
											)}>
												{reports.length}
											</span>
										)}
									</button>
								</div>
							</div>
						)}

						{/* Content based on selected tab */}
						{dashboardTab === 'cases' ? (
							<>
								{/* Recent Cases */}
								<div>
							<SereneSectionHeader
								title="Recent Cases"
								description="Your assigned support cases"
								action={{ label: "View All", href: "/dashboard/cases" }}
							/>

							<div className="space-y-3">
								{matchedServices.length > 0 ? (
									matchedServices.slice(0, 3).map((match) => (
										<Link href={`/dashboard/cases/${match.id}`} key={match.id} className="block group">
											<Card className="overflow-hidden border-serene-neutral-100 hover:border-serene-blue-200 transition-all duration-300 hover:shadow-md cursor-pointer">
												<CardContent className="p-4 flex items-center gap-4">
													<div className={cn(
														"h-12 w-12 rounded-2xl flex items-center justify-center shrink-0",
														match.report?.urgency === 'high' ? "bg-red-50 text-red-600" :
														match.report?.urgency === 'medium' ? "bg-amber-50 text-amber-600" :
														"bg-serene-blue-50 text-serene-blue-600"
													)}>
														<Shield className="h-5 w-5" />
													</div>
													<div className="flex-1 min-w-0">
														<div className="flex items-center gap-2 mb-1">
															<h4 className="font-semibold text-serene-neutral-900 truncate">
																{match.report?.type_of_incident?.replace(/_/g, " ") || "Support Case"}
															</h4>
															<Badge variant="outline" className={cn(
																"text-[10px] font-bold uppercase border-0 px-1.5 py-0.5",
																match.match_status_type === 'active' ? "bg-serene-green-50 text-serene-green-700" :
																match.match_status_type === 'pending' ? "bg-amber-50 text-amber-700" :
																"bg-serene-neutral-50 text-serene-neutral-600"
															)}>
																{match.match_status_type || 'pending'}
															</Badge>
														</div>
														<p className="text-sm text-serene-neutral-500 truncate">
															{match.report?.incident_description || "No description available"}
														</p>
													</div>
													<ChevronRight className="h-4 w-4 text-serene-neutral-300 group-hover:text-serene-blue-400 transition-colors" />
												</CardContent>
											</Card>
										</Link>
									))
								) : (
									<div className="text-center py-12 bg-white rounded-3xl border border-dashed border-serene-neutral-200">
										<div className="h-12 w-12 bg-serene-neutral-100 rounded-full flex items-center justify-center mx-auto mb-3">
											<Users className="h-6 w-6 text-serene-neutral-400" />
										</div>
										<p className="text-serene-neutral-500 mb-1">No cases assigned yet</p>
										<p className="text-sm text-serene-neutral-400">
											Complete your verification to start receiving cases
										</p>
									</div>
								)}
							</div>
						</div>

						{/* Upcoming Appointments */}
						{appointments.length > 0 && (
							<div>
								<SereneSectionHeader
									title="Upcoming Appointments"
									description="Your scheduled sessions"
								/>

								<div className="space-y-3">
									{appointments
										.filter(a => a.appointment_date && new Date(a.appointment_date) > new Date())
										.slice(0, 2)
										.map((appt, idx) => (
											<Card key={idx} className="overflow-hidden border-serene-neutral-100 hover:border-serene-blue-200 transition-all duration-300 hover:shadow-md">
												<CardContent className="p-4 flex items-center gap-4">
													<div className="h-12 w-12 bg-serene-blue-50 rounded-2xl flex flex-col items-center justify-center text-serene-blue-600">
														<span className="text-xs font-medium uppercase">
															{new Date(appt.appointment_date).toLocaleString('default', { month: 'short' })}
														</span>
														<span className="text-lg font-bold leading-none">
															{new Date(appt.appointment_date).getDate()}
														</span>
													</div>
													<div className="flex-1 min-w-0">
														<h4 className="font-semibold text-serene-neutral-900">
															{appt.matched_service?.support_service?.name || "Appointment"}
														</h4>
														<p className="text-sm text-serene-neutral-500">
															{new Date(appt.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
														</p>
													</div>
													<Badge className="bg-serene-blue-600 text-white border-0 text-xs">
														Upcoming
													</Badge>
												</CardContent>
											</Card>
										))}
								</div>
							</div>
						)}
					</>
				) : (
					/* My Reports Tab Content */
					<div>
						<SereneSectionHeader
							title="My Reports"
							description="Reports you've submitted personally"
							action={{ label: "View All", href: "/dashboard/reports" }}
						/>

						<div className="space-y-3">
							{reports.length > 0 ? (
								reports.slice(0, 5).map((report) => (
									<Link href={`/dashboard/reports/${report.report_id}`} key={report.report_id} className="block group">
										<Card className="overflow-hidden border-serene-neutral-100 hover:border-amber-200 transition-all duration-300 hover:shadow-md cursor-pointer">
											<CardContent className="p-4 flex items-center gap-4">
												<div className={cn(
													"h-12 w-12 rounded-2xl flex items-center justify-center shrink-0",
													report.urgency === 'high' ? "bg-red-50 text-red-600" :
													report.urgency === 'medium' ? "bg-amber-50 text-amber-600" :
													"bg-serene-blue-50 text-serene-blue-600"
												)}>
													<FileText className="h-5 w-5" />
												</div>
												<div className="flex-1 min-w-0">
													<div className="flex items-center gap-2 mb-1">
														<h4 className="font-semibold text-serene-neutral-900 truncate">
															{report.type_of_incident?.replace(/_/g, " ") || "Report"}
														</h4>
														<Badge variant="outline" className={cn(
															"text-[10px] font-bold uppercase border-0 px-1.5 py-0.5",
															report.match_status === 'accepted' ? "bg-serene-green-50 text-serene-green-700" :
															report.match_status === 'pending' ? "bg-amber-50 text-amber-700" :
															"bg-serene-neutral-50 text-serene-neutral-600"
														)}>
															{report.match_status || 'pending'}
														</Badge>
													</div>
													<p className="text-sm text-serene-neutral-500 truncate">
														{report.incident_description || "No description available"}
													</p>
												</div>
												<ChevronRight className="h-5 w-5 text-serene-neutral-300 group-hover:text-serene-neutral-500 transition-colors" />
											</CardContent>
										</Card>
									</Link>
								))
							) : (
								<Card className="border-dashed border-2 border-serene-neutral-200">
									<CardContent className="p-8 text-center">
										<FileText className="h-10 w-10 text-serene-neutral-300 mx-auto mb-3" />
										<p className="text-serene-neutral-500">You haven't submitted any personal reports</p>
									</CardContent>
								</Card>
							)}
						</div>
					</div>
				)}
					</>
				)}
			</div>

			{/* Report Dialog */}
			<Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
				<DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl">
					<DialogHeader>
						<DialogTitle className="text-xl font-bold">Report Incident</DialogTitle>
						<DialogDescription>
							Your safety is our priority. All information is kept confidential.
						</DialogDescription>
					</DialogHeader>
					<AuthenticatedReportAbuseForm userId={userId} onClose={() => setReportDialogOpen(false)} />
				</DialogContent>
			</Dialog>
		</div>
	);
}
