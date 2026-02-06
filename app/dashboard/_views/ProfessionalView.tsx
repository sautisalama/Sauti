"use client";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useToast } from "@/hooks/use-toast";
import { CommunityCard } from "@/app/components/CommunityCard";
import { JoinCommunity } from "@/app/components/JoinCommunity";
import { ConditionCheckCard } from "@/app/components/ConditionCheckCard";
import { Tables } from "@/types/db-schema";
import { createClient } from "@/utils/supabase/client";
import { deleteReport, fetchUserReports } from "./actions/reports";
import {
	fetchUserSupportServices,
	deleteSupportService,
} from "./actions/support-services";
import { DailyProgress } from "@/app/components/DailyProgress";
import { fetchMatchedServices } from "./actions/matched-services";
import { useState, useEffect, useMemo } from "react";
import SurvivorView from "./SurvivorView";
import { OverviewTab } from "../_components/tabs/OverviewTab";
import { ReportsTab } from "../_components/tabs/ReportsTab";
import { SupportServicesTab } from "../_components/tabs/SupportServicesTab";
import { ReportWithRelations, MatchedServiceWithRelations } from "../_types";
import { MatchCard } from "../_components/MatchCard";
import { MatchedCasesTab } from "../_components/tabs/MatchedCasesTab";
import { AppointmentsTab } from "../_components/tabs/AppointmentsTab";
import { CalScheduler } from "../_components/CalScheduler";
import { Calendar as UIDateCalendar } from "@/components/ui/calendar";
import { EnhancedAppointmentScheduler } from "../_components/EnhancedAppointmentScheduler";
import { SafetyPlanCard } from "@/components/SafetyPlanCard";
import {
	WelcomeHeader,
	StatsCard,
	SectionHeader,
} from "@/components/dashboard/DashboardComponents";
import { QuickActions } from "@/components/dashboard/QuickActions";
import {
	ClipboardList,
	Users,
	CalendarDays,
	MessageCircle,
	PlusCircle,
	Lock,
	Clock,
} from "lucide-react";
import Link from "next/link";
import { fetchUserAppointments } from "./actions/appointments";
import { SamplePlaceholder } from "@/components/dashboard/SamplePlaceholder";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
} from "@/components/ui/dialog";
import AuthenticatedReportAbuseForm from "@/components/AuthenticatedReportAbuseForm";
import { getPreloadedChat, preloadChat } from "@/utils/chat/preload";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";

interface ProfessionalViewProps {
	userId: string;
	profileDetails: Tables<"profiles">;
}

export default function ProfessionalView({
	userId,
	profileDetails,
}: ProfessionalViewProps) {
	const dash = useDashboardData();
	const [open, setOpen] = useState(false);
	const [deleteReportId, setDeleteReportId] = useState<string | null>(null);
	const [deleteServiceId, setDeleteServiceId] = useState<string | null>(null);
	const [reportDialogOpen, setReportDialogOpen] = useState(false);
	const { toast } = useToast();

	// State with proper typing
	const [reports, setReports] = useState<ReportWithRelations[]>([]);
	const [supportServices, setSupportServices] = useState<
		Tables<"support_services">[]
	>([]);
	const [matchedServices, setMatchedServices] = useState<
		MatchedServiceWithRelations[]
	>([]);
	const [appointments, setAppointments] = useState<any[]>([]);
	const [unreadCount, setUnreadCount] = useState<number>(0);

	const handleDelete = async (reportId: string) => {
		try {
			await deleteReport(reportId);
			const updatedReports = await fetchUserReports(userId);
			setReports(updatedReports as ReportWithRelations[]);
			toast({
				title: "Report deleted",
				description: "The report has been successfully deleted.",
			});
		} catch (error) {
			toast({
				title: "Error",
				description: "Failed to delete the report. Please try again.",
				variant: "destructive",
			});
		}
		setDeleteReportId(null);
	};

	const handleDeleteService = async (serviceId: string) => {
		try {
			await deleteSupportService(serviceId);
			const updatedServices = await fetchUserSupportServices(userId);
			setSupportServices(updatedServices);
			// Also refresh matched services as they might be affected
			const updatedMatches = await fetchMatchedServices(userId);
			setMatchedServices(updatedMatches);
			toast({
				title: "Service deleted",
				description: "The support service has been successfully deleted.",
			});
		} catch (error) {
			toast({
				title: "Error",
				description: "Failed to delete the support service. Please try again.",
				variant: "destructive",
			});
		}
		setDeleteServiceId(null);
	};

	const formatServiceName = (service: string) => {
		return service
			.split("_")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");
	};

	useEffect(() => {
		const loadData = async () => {
			try {
				const [userReports, userServices, userMatches, userAppointments] =
					await Promise.all([
						fetchUserReports(userId),
						fetchUserSupportServices(userId),
						fetchMatchedServices(userId),
						fetchUserAppointments(userId, "professional", true),
					]);

				setReports(userReports as ReportWithRelations[]);
				setSupportServices(userServices);
				setMatchedServices(userMatches);
				setAppointments(userAppointments || []);
			} catch (error) {
				toast({
					title: "Error",
					description: "Failed to load data. Please try again.",
					variant: "destructive",
				});
			}
		};

		// If provider data is available, use it and skip initial fetch
		if (dash?.data && dash.data.userId === userId) {
			setReports((dash.data.reports as ReportWithRelations[]) || []);
			setSupportServices(dash.data.supportServices || []);
			setMatchedServices((dash.data.matchedServices as any) || []);
			setAppointments(dash.data.appointments || []);
			return;
		}
		loadData();
	}, [userId, toast, dash?.data]);

	// Live unread messages count (Stream Chat)
	useEffect(() => {
		let cleanup: (() => void) | undefined;
		const init = async () => {
			try {
				const username = profileDetails.first_name || userId;
				let pre = getPreloadedChat(userId);
				if (!pre) {
					pre = await preloadChat(userId, username);
				}
				const computeUnread = () => {
					try {
						const total = (pre?.dmChannels || []).reduce((sum: number, ch: any) => {
							const n = typeof ch.countUnread === "function" ? ch.countUnread() : 0;
							return sum + (Number.isFinite(n) ? n : 0);
						}, 0);
						setUnreadCount(total);
					} catch {
						setUnreadCount(0);
					}
				};
				computeUnread();
				const client = pre?.client as any;
				if (client && typeof client.on === "function") {
					const handler = () => computeUnread();
					client.on("notification.message_new", handler);
					client.on("message.new", handler);
					client.on("notification.mark_read", handler);
					client.on("notification.channel_marked_read", handler);
					client.on("notification.added_to_channel", handler);
					cleanup = () => {
						try {
							client.off("notification.message_new", handler);
							client.off("message.new", handler);
							client.off("notification.mark_read", handler);
							client.off("notification.channel_marked_read", handler);
							client.off("notification.added_to_channel", handler);
						} catch {
							console.log("");
						}
					};
				}
			} catch {
				setUnreadCount(0);
			}
		};
		init();
		return () => {
			if (cleanup) cleanup();
		};
	}, [userId, profileDetails.first_name]);

	// Determine verification and gating conditions
	const hasServices = supportServices.length > 0;
	const hasMatches = matchedServices.length > 0;
	const hasPendingMatches = useMemo(
		() =>
			matchedServices.some(
				(ms) => (ms.match_status_type || "").toLowerCase() === "pending"
			),
		[matchedServices]
	);
	const profileIncomplete = useMemo(() => {
		const required = [
			profileDetails?.first_name,
			profileDetails?.phone,
			profileDetails?.professional_title,
		];
		return required.some((v) => !v || (typeof v === "string" && v.trim() === ""));
	}, [profileDetails]);
	// Prefer backend verification status from provider when available, fallback to profile completeness heuristic
	const isVerified =
		(dash?.data as any)?.verification?.overallStatus === "verified"
			? true
			: !profileIncomplete;

	// Persist verification state for mobile nav to adapt
	useEffect(() => {
		try {
			window.localStorage.setItem("ss_pro_verified", isVerified ? "1" : "0");
			// Keep legacy key for compatibility
			window.localStorage.setItem("ss_pro_restricted", !isVerified ? "1" : "0");
		} catch {
			// Ignore localStorage errors
		}
	}, [isVerified]);

	// Tailored banner content
	const renderGateBanner = () => {
		const verificationStatus =
			(dash?.data as any)?.verification?.overallStatus ||
			profileDetails?.verification_status ||
			"pending";

		// If user has uploaded documents in both tabs, show awaiting verification message
		if (verificationStatus === "under_review") {
			return (
				<Alert className="mb-4 border-blue-300 bg-blue-50 text-blue-900">
					<AlertTitle className="font-semibold flex items-center gap-2">
						<Clock className="h-4 w-4" /> Awaiting Verification
					</AlertTitle>
					<AlertDescription>
						Your documents have been submitted and are under review. You can still
						report incidents while waiting for verification.
						<div className="mt-3 flex flex-wrap gap-2">
							<Button
								size="sm"
								variant="default"
								onClick={() => setReportDialogOpen(true)}
							>
								Report Incident
							</Button>
						</div>
					</AlertDescription>
				</Alert>
			);
		}

		// Default verification required message
		const title = "Complete your professional profile";
		const description =
			hasServices && !hasMatches
				? "You have services listed but no matches yet. Verify and complete your profile to be discoverable."
				: "Update your profile details for verification so you can be matched with cases.";
		return (
			<Alert className="mb-4 border-amber-300 bg-amber-50 text-amber-900">
				<AlertTitle className="font-semibold flex items-center gap-2">
					<Lock className="h-4 w-4" /> Verification required
				</AlertTitle>
				<AlertDescription>
					{description}
					<div className="mt-3 flex flex-wrap gap-2">
						<Link href="/dashboard/profile?tab=verification">
							<Button size="sm" variant="default">
								Update profile
							</Button>
						</Link>
					</div>
				</AlertDescription>
			</Alert>
		);
	};

	return (
		<>
			<div className="max-w-7xl mx-auto p-4 lg:p-6">
			<WelcomeHeader 
						name={profileDetails.first_name || "Partner"} 
						userType={profileDetails.user_type === "ngo" ? "ngo" : "professional"} 
						timeOfDay={(() => {
							const hour = new Date().getHours();
							if (hour < 12) return "morning";
							if (hour < 18) return "afternoon";
							return "evening";
						})()}
					/>

					{/* Persistent verification banner for unverified */}
					{!isVerified && renderGateBanner()}

					{/* KPI Row */}
					<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
						{/* 1) Cases matched */}
						<Link href="/dashboard/cases">
							<StatsCard
								title="Cases matched"
								value={matchedServices.length}
								icon={<Users className="h-5 w-5" />}
								variant="success"
								description="Direct impact cases"
							/>
						</Link>
						{/* 2) Appointments */}
						<Link href="/dashboard/appointments">
							<StatsCard
								title="Appointments"
								value={appointments.length}
								icon={<CalendarDays className="h-5 w-5" />}
								variant="warning"
								description="Scheduled sessions"
							/>
						</Link>
						{/* 3) Services */}
						<Link href="/dashboard/services">
							<StatsCard
								title="Services"
								value={supportServices.length}
								icon={<Users className="h-5 w-5" />}
								variant="default"
								description="Active service listings"
							/>
						</Link>
						{/* 4) Reports */}
						<Link href="/dashboard/reports">
							<StatsCard
								title="Reports"
								value={reports.length}
								icon={<ClipboardList className="h-5 w-5" />}
								variant="error"
								description="Total filed reports"
							/>
						</Link>
					</div>

					{/* Quick Actions */}
					<div className="my-4">
						<QuickActions
							actions={[
								{
									label: "Report Now",
									description: "Quick incident reporting",
									onClick: () => setReportDialogOpen(true),
									icon: ClipboardList,
								},
								{
									label: "Messages",
									description: "Open chat",
									href: "/dashboard/chat",
									icon: MessageCircle,
								},
								{
									label: "Schedule",
									description: "Manage appointments",
									href: "/dashboard/appointments",
									icon: CalendarDays,
									disabled: !isVerified,
								},
								{
									label: "My Reports",
									description: "View or submit reports",
									href: "/dashboard/reports",
									icon: ClipboardList,
								},
							]}
						/>
					</div>

					{/* Quick Agenda + Queues */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
						<div className="rounded-2xl border-0 p-5 bg-sauti-teal-light shadow-sm relative overflow-hidden group">
              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-sauti-teal/40" />
							<p className="text-xs font-black uppercase tracking-wider text-sauti-teal/60 mb-2">My Agenda</p>
							{appointments.length > 0 ? (
								<div className="space-y-3 text-sm relative z-10">
									{[...appointments]
										.filter((a) => a.appointment_date)
										.sort(
											(a, b) =>
												new Date(a.appointment_date).getTime() -
												new Date(b.appointment_date).getTime()
										)
										.slice(0, 2)
										.map((a, idx) => (
											<div key={idx} className="flex items-center justify-between bg-white/50 p-2 rounded-xl">
												<span className="font-bold text-sauti-dark">
													{new Date(a.appointment_date).toLocaleTimeString([], {
														hour: "2-digit",
														minute: "2-digit",
													})}{" "}
													• {a.matched_service?.support_service?.name || "Session"}
												</span>
												<Link href="/dashboard/appointments" className="text-sauti-teal font-black hover:underline px-2 py-1 bg-white rounded-lg text-xs">
													Open
												</Link>
											</div>
										))}
								</div>
							) : (
								<SamplePlaceholder label="Sample">
									<div className="space-y-3 text-sm relative z-10">
										<div className="flex items-center justify-between bg-white/50 p-2 rounded-xl">
											<span className="font-bold text-sauti-dark">10:00 • Intake call</span>
											<Link href="/dashboard/appointments" className="text-sauti-teal font-black hover:underline px-2 py-1 bg-white rounded-lg text-xs">
												Open
											</Link>
										</div>
										<div className="flex items-center justify-between bg-white/50 p-2 rounded-xl">
											<span className="font-bold text-sauti-dark">14:00 • Follow-up</span>
											<Link
												href="/dashboard?tab=appointments"
												className="text-sauti-teal font-black hover:underline px-2 py-1 bg-white rounded-lg text-xs"
											>
												Open
											</Link>
										</div>
									</div>
								</SamplePlaceholder>
							)}
						</div>
						<div className="rounded-2xl border-0 p-5 bg-sauti-red-light shadow-sm relative overflow-hidden group">
              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-sauti-red/40" />
							<p className="text-xs font-black uppercase tracking-wider text-sauti-red/60 mb-2">Queues</p>
							{reports.length > 0 ? (
								<div className="grid grid-cols-3 gap-3 text-sm relative z-10">
									{(() => {
										const counts = reports.reduce((acc, r) => {
											const k = (r.urgency || "low").toLowerCase();
											acc[k] = ((acc[k] || 0) as number) + 1;
											return acc;
										}, {} as Record<string, number>);
										return (
											<>
												<div className="rounded-xl bg-white/60 p-3 text-center shadow-sm">
													<p className="text-[10px] text-sauti-red font-black uppercase tracking-wider">High</p>
													<p className="text-xl font-black text-sauti-red">{counts["high"] || 0}</p>
												</div>
												<div className="rounded-xl bg-white/60 p-3 text-center shadow-sm">
													<p className="text-[10px] text-sauti-yellow-dark font-black uppercase tracking-wider">Med</p>
													<p className="text-xl font-black text-sauti-yellow-dark">{counts["medium"] || 0}</p>
												</div>
												<div className="rounded-xl bg-white/60 p-3 text-center shadow-sm">
													<p className="text-[10px] text-sauti-teal font-black uppercase tracking-wider">Low</p>
													<p className="text-xl font-black text-sauti-teal">{counts["low"] || 0}</p>
												</div>
											</>
										);
									})()}
								</div>
							) : (
								<SamplePlaceholder label="Sample">
									<div className="grid grid-cols-3 gap-3 text-sm relative z-10">
										<div className="rounded-xl bg-white/60 p-3 text-center shadow-sm">
											<p className="text-[10px] text-sauti-red font-black uppercase tracking-wider">High</p>
											<p className="text-xl font-black text-sauti-red">2</p>
										</div>
										<div className="rounded-xl bg-white/60 p-3 text-center shadow-sm">
											<p className="text-[10px] text-sauti-yellow-dark font-black uppercase tracking-wider">Med</p>
											<p className="text-xl font-black text-sauti-yellow-dark">5</p>
										</div>
										<div className="rounded-xl bg-white/60 p-3 text-center shadow-sm">
											<p className="text-[10px] text-sauti-teal font-black uppercase tracking-wider">Low</p>
											<p className="text-xl font-black text-sauti-teal">9</p>
										</div>
									</div>
								</SamplePlaceholder>
							)}
						</div>
						<div className="rounded-2xl border-0 p-5 bg-sauti-yellow-light shadow-sm relative overflow-hidden group">
              <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-sauti-yellow/40" />
							<p className="text-xs font-black uppercase tracking-wider text-sauti-yellow-dark/60 mb-2">Quick Chat</p>
							<p className="text-sm font-bold text-sauti-dark mb-3 relative z-10">Open your messages to coordinate care.</p>
							<Link href="/dashboard/chat" className="text-sauti-teal font-black hover:underline bg-white px-3 py-1.5 rounded-lg text-xs shadow-sm relative z-10 inline-block">
								Open chat →
							</Link>
						</div>
					</div>

					<div className="flex flex-col md:flex-row gap-6">
						<div className="flex-1">
							<Tabs defaultValue="overview" className="mb-8">
								<TabsList className="w-full overflow-x-auto flex whitespace-nowrap gap-1 px-1">
									<TabsTrigger value="overview" className="text-xs px-2 py-1">
										Overview
									</TabsTrigger>
									<TabsTrigger value="reports" className="text-xs px-2 py-1">
										Reports
									</TabsTrigger>
									<TabsTrigger value="matched-cases" className="text-xs px-2 py-1">
										Cases
									</TabsTrigger>
									<TabsTrigger
										value="support-services"
										className="text-xs px-2 py-1 hidden sm:inline-flex"
									>
										Services
									</TabsTrigger>
									<TabsTrigger value="appointments" className="text-xs px-2 py-1">
										Appointments
									</TabsTrigger>
									<TabsTrigger
										value="scheduling"
										className="text-xs px-2 py-1 hidden sm:inline-flex"
									>
										Scheduling
									</TabsTrigger>
								</TabsList>

								<TabsContent value="overview">
									<OverviewTab
										reports={reports}
										matchedServices={matchedServices}
										supportServices={supportServices}
										onDeleteReport={setDeleteReportId}
										formatServiceName={formatServiceName}
									/>
								</TabsContent>

								<TabsContent value="reports">
									<ReportsTab
										reports={reports}
										onDeleteReport={setDeleteReportId}
										formatServiceName={formatServiceName}
										userId={userId}
										reportDialogOpen={reportDialogOpen}
										setReportDialogOpen={setReportDialogOpen}
										onRefresh={async () => {
											const updatedReports = await fetchUserReports(userId);
											setReports(updatedReports as ReportWithRelations[]);
										}}
									/>
								</TabsContent>

								<TabsContent value="matched-cases">
									<div
										className={
											"relative " + (!isVerified ? "opacity-50 pointer-events-none" : "")
										}
									>
										<MatchedCasesTab
											userId={userId}
											matchedServices={matchedServices}
											onRefresh={async () => {
												const [updatedMatches, updatedServices] = await Promise.all([
													fetchMatchedServices(userId),
													fetchUserSupportServices(userId),
												]);
												setMatchedServices(updatedMatches);
												setSupportServices(updatedServices);
											}}
										/>
										{!isVerified && (
											<div className="absolute inset-0 flex items-center justify-center">
												<p className="text-sm bg-white/90 px-3 py-1 rounded border">
													Verification required to manage cases
												</p>
											</div>
										)}
									</div>
								</TabsContent>

								<TabsContent value="support-services">
									<SupportServicesTab
										supportServices={supportServices}
										formatServiceName={formatServiceName}
										onDeleteService={setDeleteServiceId}
										open={open}
										setOpen={setOpen}
										userId={userId}
										onRefresh={async () => {
											const updatedServices = await fetchUserSupportServices(userId);
											setSupportServices(updatedServices);
										}}
									/>
								</TabsContent>

								<TabsContent value="appointments">
									<div
										className={
											"relative " + (!isVerified ? "opacity-50 pointer-events-none" : "")
										}
									>
										<AppointmentsTab
											userId={userId}
											userType="professional"
											username={profileDetails.first_name || userId}
											onAppointmentsChange={async () => {
												const updatedMatches = await fetchMatchedServices(userId);
												setMatchedServices(updatedMatches);
											}}
										/>
										{!isVerified && (
											<div className="absolute inset-0 flex items-center justify-center">
												<p className="text-sm bg-white/90 px-3 py-1 rounded border">
													Verification required to manage appointments
												</p>
											</div>
										)}
									</div>
								</TabsContent>

								<TabsContent value="scheduling">
									<div className="space-y-6">
										<div>
											<h2 className="text-xl font-black text-sauti-dark tracking-tight mb-1">
												Professional Scheduling
											</h2>
											<p className="text-sm font-bold text-neutral-400 mb-4">
												Manage your availability and let clients schedule appointments with
												you.
											</p>
										</div>

										<CalScheduler
											professionalId={userId}
											calLink={profileDetails.cal_link || undefined}
										/>
									</div>
								</TabsContent>
							</Tabs>

							<div className="space-y-8">
								<div className="grid grid-cols-1 gap-6">
									<CommunityCard />
									<div className="md:hidden">
										<DailyProgress />
									</div>
								</div>
							</div>
						</div>

						<div className="hidden md:block w-[350px] space-y-6 sticky top-6 self-start">
							<ConditionCheckCard />
							<JoinCommunity />
							<SafetyPlanCard userId={userId} />
						</div>
					</div>

			{/* Delete Report Dialog */}
			<AlertDialog
				open={!!deleteReportId}
				onOpenChange={(open) => !open && setDeleteReportId(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete the report.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() => deleteReportId && handleDelete(deleteReportId)}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			{/* Delete Service Dialog */}
			<AlertDialog
				open={!!deleteServiceId}
				onOpenChange={(open) => !open && setDeleteServiceId(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
						<AlertDialogDescription>
							This action cannot be undone. This will permanently delete the support
							service.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancel</AlertDialogCancel>
						<AlertDialogAction
							className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
							onClick={() => deleteServiceId && handleDeleteService(deleteServiceId)}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
				<DialogContent className="max-w-4xl p-0 overflow-hidden rounded-[32px] h-[90vh] min-h-[600px] z-[1000]">
					<DialogTitle className="sr-only">Report Abuse</DialogTitle>
					<DialogDescription className="sr-only">
						Please fill out this form to report an incident. All information will be
						kept confidential.
					</DialogDescription>
					<AuthenticatedReportAbuseForm
						onClose={() => setReportDialogOpen(false)}
						userId={userId}
					/>
				</DialogContent>
			</Dialog>
		</div>
		</>
	);
}
