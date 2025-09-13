"use client";

import { createClient } from "@/utils/supabase/client";
import { Database, Tables } from "@/types/db-schema";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Info, Plus, Trash2 } from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import AuthenticatedReportAbuseForm from "@/components/AuthenticatedReportAbuseForm";
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
import { useToast } from "@/hooks/use-toast";
import {
	Bell,
	Search,
	Users,
	Megaphone,
	CalendarDays,
	MessageCircle,
	BookOpen,
	Shield,
	Heart,
	TrendingUp,
	AlertCircle,
	CheckCircle,
	Clock,
	Star,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
	WelcomeHeader,
	QuickActionCard,
	StatsCard,
	ProgressRing,
	ActivityItem,
	SectionHeader,
} from "@/components/dashboard/DashboardComponents";
import { AppointmentsTab } from "../_components/tabs/AppointmentsTab";
import { SafetyPlanCard } from "@/components/SafetyPlanCard";
import { CommunityCard } from "@/app/components/CommunityCard";
import { DailyProgress } from "@/app/components/DailyProgress";
import { JoinCommunity } from "@/app/components/JoinCommunity";
import { SamplePlaceholder } from "@/components/dashboard/SamplePlaceholder";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";

// Add this interface to type the joined data
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
	const [reports, setReports] = useState<ReportWithRelations[]>([]);
	const [open, setOpen] = useState(false);
	const searchParams = useSearchParams();
	const initialTab =
		(searchParams?.get("tab") as "overview" | "reports" | null) || "overview";
	const [activeTab, setActiveTab] = useState<"overview" | "reports">(initialTab);
	const supabase = useMemo(() => createClient(), []);
	const { toast } = useToast();
	const [deleteReport, setDeleteReport] = useState<string | null>(null);
	const [showAlert, setShowAlert] = useState(true);

	// Move fetchReports outside useEffect so it can be called from handlers
	const fetchReports = useCallback(async () => {
		console.log("Fetching reports for user:", userId);

		const { data, error } = await supabase
			.from("reports")
			.select(
				`
				*,
				matched_services (
					id,
					match_status_type,
					match_date,
					match_score,
					support_services (
						id,
						name,
						service_types
					)
				)
			`
			)
			.eq("user_id", userId)
			.order("submission_timestamp", { ascending: false });

		if (error) {
			console.error("Error fetching reports:", error);
			toast({
				title: "Error",
				description: "Failed to fetch reports. Please try again.",
				variant: "destructive",
			});
			return;
		}

		// If we need appointments data, we'll need to fetch it separately
		if (data && data.length > 0) {
			// Get all matched service IDs
			const matchedServiceIds = data
				.flatMap((report) => report.matched_services || [])
				.map((service) => service.id);

			if (matchedServiceIds.length > 0) {
				const { data: appointmentsData, error: appointmentsError } = await supabase
					.from("appointments")
					.select("*")
					.in("professional_id", matchedServiceIds);

				if (!appointmentsError && appointmentsData) {
					// Merge appointments data with the reports
					const reportsWithAppointments = data.map((report) => ({
						...report,
						matched_services: report.matched_services?.map(
							(service: { id: string }) => ({
								...service,
								appointments: appointmentsData.filter(
									(apt) => apt.professional_id === service.id
								),
							})
						),
					}));

					console.log("Reports with appointments:", reportsWithAppointments);
					setReports(reportsWithAppointments);
					try {
						localStorage.setItem(
							`reports-cache-${userId}`,
							JSON.stringify(reportsWithAppointments)
						);
					} catch (e) {
						/* ignore cache write */
					}
					return;
				}
			}
		}

		// If no appointments needed to be fetched or if there was an error, just set the reports
		console.log("Fetched reports:", data);
		setReports(data || []);
		try {
			localStorage.setItem(`reports-cache-${userId}`, JSON.stringify(data || []));
		} catch (e) {
			/* ignore cache write */
		}
	}, [userId, toast]);

	const handleDelete = async (reportId: string) => {
		try {
			const response = await fetch(`/api/reports/${reportId}`, {
				method: "DELETE",
			});

			if (!response.ok) {
				throw new Error("Failed to delete report");
			}

			toast({
				title: "Report deleted",
				description: "The report has been successfully deleted.",
				variant: "default",
			});

			// Refresh data after successful deletion
			fetchReports();
		} catch (error) {
			toast({
				title: "Error",
				description: "Failed to delete the report. Please try again.",
				variant: "destructive",
			});
			console.error("Error deleting report:", error);
		}
		setDeleteReport(null);
	};

	useEffect(() => {
		// Use provider data when present
		if (dash?.data && dash.data.userId === userId && dash.data.reports) {
			setReports(dash.data.reports as any);
		} else {
			fetchReports();
		}

		// Set up real-time subscription
		const channel = supabase
			.channel("reports_changes")
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "reports",
					filter: `user_id=eq.${userId}`,
				},
				(payload) => {
					console.log("Real-time update received:", payload); // Debug log
					fetchReports();
				}
			)
			.subscribe();

		// Cleanup subscription
		return () => {
			supabase.removeChannel(channel);
		};
	}, [userId, dash?.data]); // Removed supabase and fetchReports from deps to prevent loop

	// Add formatServiceName inside component
	const formatServiceName = (service: string) => {
		return service
			.split("_")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");
	};

	const matchedCount = useMemo(
		() => reports.filter((r) => (r.matched_services?.length || 0) > 0).length,
		[reports]
	);
	const latestReportDate = useMemo(() => {
		const ts = reports
			.map((r) => r.submission_timestamp)
			.filter(Boolean) as string[];
		if (ts.length === 0) return null;
		return new Date(
			ts.sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0]
		);
	}, [reports]);
	const daysActive = useMemo(() => {
		const ts = reports
			.map((r) => r.submission_timestamp)
			.filter(Boolean) as string[];
		if (ts.length === 0) return null;
		const minDate = new Date(
			ts.reduce((min, cur) => (new Date(cur) < new Date(min) ? cur : min), ts[0])
		);
		const diff = Math.max(
			1,
			Math.ceil((Date.now() - minDate.getTime()) / (1000 * 60 * 60 * 24))
		);
		return diff;
	}, [reports]);
	const safetyProgress = useMemo(() => {
		if (reports.length === 0 && matchedCount === 0) return null;
		const base = reports.length * 10 + matchedCount * 15;
		return Math.max(15, Math.min(95, base));
	}, [reports, matchedCount]);

	// Helper function to get time of day
	const getTimeOfDay = (): "morning" | "afternoon" | "evening" => {
		const hour = new Date().getHours();
		if (hour < 12) return "morning";
		if (hour < 18) return "afternoon";
		return "evening";
	};

	return (
		<>
			<div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
				<div className="max-w-7xl mx-auto p-4 lg:p-6">
					{/* Welcome Header */}
					<WelcomeHeader
						name={profileDetails.first_name || "Friend"}
						userType="survivor"
						timeOfDay={getTimeOfDay()}
					/>

					{/* Quick Actions Grid */}
					<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
						<QuickActionCard
							icon={<Megaphone className="h-5 w-5 text-sauti-orange" />}
							title="Report Now"
							description="Quick & secure incident reporting"
							onClick={() => setOpen(true)}
							variant="primary"
						/>
						<QuickActionCard
							icon={<MessageCircle className="h-5 w-5 text-sauti-orange" />}
							title="Messages"
							description="Chat with professionals"
							href="/dashboard/chat"
							badge={3}
						/>
						<QuickActionCard
							icon={<CalendarDays className="h-5 w-5 text-sauti-orange" />}
							title="Appointments"
							description="Your upcoming sessions"
							href="/dashboard/reports"
						/>
						<QuickActionCard
							icon={<BookOpen className="h-5 w-5 text-sauti-orange" />}
							title="Resources"
							description="Educational content"
							href="/dashboard/resources"
						/>
					</div>

					{/* Stats Overview */}
					<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4 mb-6">
						<Link href="/dashboard/reports">
							<StatsCard
								title="My Reports"
								value={reports.length}
								icon={<Shield className="h-4 w-4" />}
								description="Total incidents reported"
								className="cursor-pointer hover:shadow-md"
							/>
						</Link>
						<StatsCard
							title="Support Matches"
							value={matchedCount}
							icon={<Heart className="h-4 w-4" />}
							variant="success"
							description="Connected to help"
						/>
						{typeof safetyProgress === "number" ? (
							<StatsCard
								title="Safety Score"
								value={`${safetyProgress}%`}
								icon={<TrendingUp className="h-4 w-4" />}
								change={{
									value: Math.max(1, Math.round(safetyProgress / 10)),
									type: "increase",
								}}
								variant="success"
								description="Your progress this month"
							/>
						) : (
							<SamplePlaceholder label="Sample">
								<StatsCard
									title="Safety Score"
									value="87%"
									icon={<TrendingUp className="h-4 w-4" />}
									change={{ value: 12, type: "increase" }}
									variant="success"
									description="Your progress this month"
								/>
							</SamplePlaceholder>
						)}
						<SamplePlaceholder label="Sample">
							<StatsCard
								title="Next Steps"
								value={"2"}
								icon={<CheckCircle className="h-4 w-4" />}
								description="Recommended actions"
								variant="warning"
							/>
						</SamplePlaceholder>
					</div>

					{/* Safety Progress Ring */}
					<Card className="mb-6">
						<CardContent className="p-6">
							{typeof safetyProgress === "number" ? (
								<div className="flex flex-col lg:flex-row items-center gap-6">
									<div className="flex flex-col items-center">
										<ProgressRing progress={safetyProgress} size={120}>
											<div className="text-center">
												<div className="text-2xl font-bold text-sauti-orange">
													{safetyProgress}%
												</div>
												<div className="text-xs text-neutral-500">Safety</div>
											</div>
										</ProgressRing>
										<p className="text-sm text-neutral-600 mt-2 text-center">
											Your safety progress
										</p>
									</div>
									<div className="flex-1 w-full">
										<h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
											Your Journey to Safety
										</h3>
										<p className="text-neutral-600 dark:text-neutral-400 text-sm mb-4">
											You've made significant progress on your path to safety and healing.
											Keep taking small steps forward - you're doing great.
										</p>
										<div className="grid grid-cols-3 gap-3 text-center">
											<div>
												<div className="text-lg font-bold text-success-600">
													{reports.length}
												</div>
												<div className="text-xs text-neutral-500">Reports Filed</div>
											</div>
											<div>
												<div className="text-lg font-bold text-sauti-orange">
													{Math.max(1, Math.round(safetyProgress / 20) + matchedCount)}
												</div>
												<div className="text-xs text-neutral-500">Resources Used</div>
											</div>
											<div>
												<div className="text-lg font-bold text-primary-600">
													{daysActive ?? 1}
												</div>
												<div className="text-xs text-neutral-500">Days Active</div>
											</div>
										</div>
									</div>
								</div>
							) : (
								<SamplePlaceholder label="Sample">
									<div className="flex flex-col lg:flex-row items-center gap-6">
										<div className="flex flex-col items-center">
											<ProgressRing progress={87} size={120}>
												<div className="text-center">
													<div className="text-2xl font-bold text-sauti-orange">87%</div>
													<div className="text-xs text-neutral-500">Safety</div>
												</div>
											</ProgressRing>
											<p className="text-sm text-neutral-600 mt-2 text-center">
												Your safety progress
											</p>
										</div>
										<div className="flex-1 w-full">
											<h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-3">
												Your Journey to Safety
											</h3>
											<p className="text-neutral-600 dark:text-neutral-400 text-sm mb-4">
												You've made significant progress on your path to safety and healing.
												Keep taking small steps forward - you're doing great.
											</p>
											<div className="grid grid-cols-3 gap-3 text-center">
												<div>
													<div className="text-lg font-bold text-success-600">0</div>
													<div className="text-xs text-neutral-500">Reports Filed</div>
												</div>
												<div>
													<div className="text-lg font-bold text-sauti-orange">5</div>
													<div className="text-xs text-neutral-500">Resources Used</div>
												</div>
												<div>
													<div className="text-lg font-bold text-primary-600">12</div>
													<div className="text-xs text-neutral-500">Days Active</div>
												</div>
											</div>
										</div>
									</div>
								</SamplePlaceholder>
							)}
						</CardContent>
					</Card>

					{/* Next Steps & Quick Links */}
					<Card className="mb-6">
						<CardContent className="p-4">
							<div className="grid grid-cols-1 md:grid-cols-3 gap-3">
								<div className="rounded-xl bg-[#F0F9FF] p-4">
									<p className="text-sm text-neutral-600 mb-1">Next Step</p>
									<p className="font-medium">Review your last report match</p>
									<Link href="/dashboard/reports" className="text-sauti-orange text-sm">
										Open reports →
									</Link>
								</div>
								<div className="rounded-xl bg-[#FFF8F0] p-4">
									<p className="text-sm text-neutral-600 mb-1">Connect</p>
									<p className="font-medium">Message a professional</p>
									<Link href="/dashboard/chat" className="text-sauti-orange text-sm">
										Open chat →
									</Link>
								</div>
								<div className="rounded-xl bg-[#F5F7FF] p-4">
									<p className="text-sm text-neutral-600 mb-1">Next-of-Kin</p>
									<p className="font-medium">Keep details up to date</p>
									<Link href="/dashboard/settings" className="text-sauti-orange text-sm">
										Manage →
									</Link>
								</div>
							</div>
						</CardContent>
					</Card>

					{/* Main Content Tabs */}
					<div className="flex flex-col lg:flex-row gap-6">
						<div className="flex-1">
							<Tabs
								value={activeTab}
								onValueChange={(v) => setActiveTab(v as any)}
								className="mb-8"
							>
								<TabsList className="grid w-full grid-cols-2 lg:w-auto lg:inline-flex mb-6">
									<TabsTrigger value="overview" className="text-sm">
										Overview
									</TabsTrigger>
									<TabsTrigger value="reports" className="text-sm">
										My Reports
									</TabsTrigger>
								</TabsList>

								<TabsContent value="overview">
									<div className="space-y-6">
										{/* Recent Activity */}
										<Card>
											<CardHeader>
												<SectionHeader
													title="Recent Activity"
													description="Your latest interactions and updates"
												/>
											</CardHeader>
											<CardContent className="p-0">
												<div className="divide-y divide-neutral-100 dark:divide-neutral-800">
													{reports.length > 0 ? (
														<>
															<ActivityItem
																icon={<CheckCircle className="h-4 w-4" />}
																title="Report submitted"
																description="Your incident report was recorded successfully."
																timestamp={
																	latestReportDate
																		? latestReportDate.toLocaleString()
																		: "Recently"
																}
																status="success"
															/>
															{matchedCount > 0 && (
																<ActivityItem
																	icon={<Star className="h-4 w-4" />}
																	title="Service match found"
																	description="You've been matched with a support service."
																	timestamp="Recently"
																	status="success"
																/>
															)}
														</>
													) : (
														<SamplePlaceholder label="Sample">
															<ActivityItem
																icon={<CheckCircle className="h-4 w-4" />}
																title="Report submitted successfully"
																description="Your incident report has been securely recorded and is being reviewed by our team."
																timestamp="2 hours ago"
																status="success"
															/>
															<ActivityItem
																icon={<MessageCircle className="h-4 w-4" />}
																title="New message from Dr. Sarah M."
																description="Response to your recent consultation request with recommended next steps."
																timestamp="5 hours ago"
																onClick={() => (window.location.href = "/dashboard/chat")}
															/>
															<ActivityItem
																icon={<CalendarDays className="h-4 w-4" />}
																title="Appointment scheduled"
																description="Counseling session with Jane Smith on March 15th at 2:00 PM."
																timestamp="1 day ago"
																status="pending"
															/>
															<ActivityItem
																icon={<Star className="h-4 w-4" />}
																title="Safety milestone achieved"
																description="Congratulations! You've completed your safety plan and accessed 3 new resources."
																timestamp="2 days ago"
																status="success"
															/>
														</SamplePlaceholder>
													)}
												</div>
											</CardContent>
										</Card>

										{/* Recent Reports Summary */}
										<Card>
											<CardHeader>
												<SectionHeader
													title="My Reports"
													description={`${reports.length} ${
														reports.length === 1 ? "report" : "reports"
													} on file`}
													action={{
														label: "View All",
														onClick: () => {
															window.location.href = "/dashboard/reports";
														},
													}}
												/>
											</CardHeader>
											<CardContent>
												<Dialog open={open} onOpenChange={setOpen}>
													<DialogTrigger asChild>
														<Button>
															<Plus className="h-4 w-4 mr-2" />
															New Report
														</Button>
													</DialogTrigger>
													<DialogContent className="sm:max-w-4xl">
														<DialogHeader>
															<DialogTitle>Report Abuse</DialogTitle>
															<DialogDescription>
																Please fill out this form to report an incident. All information
																will be kept confidential.
															</DialogDescription>
														</DialogHeader>
														<AuthenticatedReportAbuseForm
															onClose={() => setOpen(false)}
															userId={userId}
														/>
													</DialogContent>
												</Dialog>

												{reports.length > 0 ? (
													<div className="space-y-3">
														{reports.map((report) => {
															// Get the most recent matched service if any
															const matchedService = report.matched_services?.[0];
															const appointment = matchedService?.appointments?.[0];

															return (
																<div
																	key={report.report_id}
																	className={`flex flex-col md:flex-row md:items-center justify-between rounded-lg p-3 md:p-4 space-y-3 md:space-y-0 ${
																		report.urgency === "high"
																			? "bg-[#FFF5F5]"
																			: report.urgency === "medium"
																			? "bg-[#FFF8F0]"
																			: "bg-[#F0F9FF]"
																	}`}
																>
																	<div className="flex md:hidden flex-col space-y-3">
																		<div className="flex items-start justify-between">
																			<div className="flex items-start gap-2 flex-1">
																				<div className="h-8 w-8 shrink-0 rounded-full bg-[#1A3434] text-white flex items-center justify-center text-sm">
																					{report.type_of_incident?.[0]?.toUpperCase() || "?"}
																				</div>
																				<div className="min-w-0">
																					<h4 className="font-medium text-sm">
																						{formatServiceName(
																							report.type_of_incident || "Unknown Incident"
																						)}
																					</h4>
																					{report.incident_description && (
																						<p className="text-sm text-gray-600 mt-1 line-clamp-2">
																							{report.incident_description}
																						</p>
																					)}
																					<div className="flex flex-wrap gap-2 text-xs text-gray-500 mt-1">
																						<span>
																							{new Date(
																								report.submission_timestamp || ""
																							).toLocaleDateString()}
																						</span>
																						<span
																							className={`
																						px-2 py-0.5 rounded-full text-xs
																						${
																							report.urgency === "high"
																								? "bg-red-100 text-red-700"
																								: report.urgency === "medium"
																								? "bg-yellow-100 text-yellow-700"
																								: "bg-blue-100 text-blue-700"
																						}
																					`}
																						>
																							{formatServiceName(report.urgency || "low")}
																						</span>
																					</div>
																				</div>
																			</div>
																			<Button
																				variant="ghost"
																				size="icon"
																				className="text-destructive hover:text-destructive hover:bg-destructive/10 -mt-1"
																				onClick={() => setDeleteReport(report.report_id)}
																			>
																				<Trash2 className="h-4 w-4" />
																			</Button>
																		</div>

																		<div className="bg-white/50 p-2 rounded-md">
																			<p className="font-medium text-sm">
																				{matchedService?.support_services.name || "Pending Match"}
																			</p>
																			<p className="text-xs text-gray-500">
																				{matchedService?.match_status_type
																					? formatServiceName(matchedService.match_status_type)
																					: "Awaiting Response"}
																			</p>
																		</div>

																		{appointment && (
																			<Button
																				className="w-full bg-[#00A5A5] hover:bg-[#008585] text-sm"
																				onClick={() => {
																					console.log("View appointment:", appointment);
																				}}
																			>
																				{appointment.status === "confirmed"
																					? "Join Meeting"
																					: "View Appointment"}
																			</Button>
																		)}
																	</div>

																	<div className="hidden md:flex items-start gap-3">
																		<div className="h-10 w-10 shrink-0 rounded-full bg-[#1A3434] text-white flex items-center justify-center">
																			{report.type_of_incident?.[0]?.toUpperCase() || "?"}
																		</div>
																		<div className="min-w-0">
																			<h4 className="font-medium">
																				{formatServiceName(
																					report.type_of_incident || "Unknown Incident"
																				)}
																			</h4>
																			{report.incident_description && (
																				<p className="text-sm text-gray-600 mt-1 line-clamp-2">
																					{report.incident_description}
																				</p>
																			)}
																			<div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 mt-1">
																				<span>
																					{new Date(
																						report.submission_timestamp || ""
																					).toLocaleDateString()}
																				</span>
																				<span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
																				<span
																					className={`
																				px-2 py-0.5 rounded-full text-xs
																				${
																					report.urgency === "high"
																						? "bg-red-100 text-red-700"
																						: report.urgency === "medium"
																						? "bg-yellow-100 text-yellow-700"
																						: "bg-blue-100 text-blue-700"
																				}
																			`}
																				>
																					{formatServiceName(report.urgency || "low")} Priority
																				</span>
																			</div>
																		</div>
																	</div>

																	<div className="hidden md:flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
																		<div className="w-full md:w-auto">
																			<p className="font-medium">
																				{matchedService?.support_services.name || "Pending Match"}
																			</p>
																			<p className="text-sm text-gray-500">
																				{matchedService?.match_status_type
																					? formatServiceName(matchedService.match_status_type)
																					: "Awaiting Response"}
																			</p>
																		</div>
																		<div className="flex w-full md:w-auto gap-2">
																			{appointment && (
																				<Button
																					className="flex-1 md:flex-none bg-[#00A5A5] hover:bg-[#008585]"
																					onClick={() => {
																						console.log("View appointment:", appointment);
																					}}
																				>
																					{appointment.status === "confirmed"
																						? "Join Meeting"
																						: "View Appointment"}
																				</Button>
																			)}
																			<Button
																				variant="ghost"
																				size="icon"
																				className="text-destructive hover:text-destructive hover:bg-destructive/10"
																				onClick={() => setDeleteReport(report.report_id)}
																			>
																				<Trash2 className="h-4 w-4" />
																			</Button>
																		</div>
																	</div>
																</div>
															);
														})}
													</div>
												) : (
													<div className="text-center py-12 bg-gray-50 rounded-lg">
														<div className="space-y-3">
															<p className="text-gray-500">No reports found</p>
															<p className="text-sm text-gray-400">
																Click "New Report" to create your first report
															</p>
														</div>
													</div>
												)}
											</CardContent>
										</Card>
									</div>
								</TabsContent>

								<TabsContent value="reports">
									<div className="space-y-6">
										<div className="flex justify-between items-center mb-6">
											<div>
												<h2 className="text-xl font-semibold text-[#1A3434]">My Reports</h2>
												<p className="text-sm text-gray-500">
													{reports.length} {reports.length === 1 ? "report" : "reports"}{" "}
													found
												</p>
											</div>
											<Dialog open={open} onOpenChange={setOpen}>
												<DialogTrigger asChild>
													<Button>
														<Plus className="h-4 w-4 mr-2" />
														New Report
													</Button>
												</DialogTrigger>
												<DialogContent className="sm:max-w-4xl">
													<DialogHeader>
														<DialogTitle>Report Abuse</DialogTitle>
														<DialogDescription>
															Please fill out this form to report an incident. All information
															will be kept confidential.
														</DialogDescription>
													</DialogHeader>
													<AuthenticatedReportAbuseForm
														onClose={() => setOpen(false)}
														userId={userId}
													/>
												</DialogContent>
											</Dialog>
										</div>

										{reports.length > 0 ? (
											<div className="space-y-3">
												{reports.map((report) => {
													// Get the most recent matched service if any
													const matchedService = report.matched_services?.[0];
													const appointment = matchedService?.appointments?.[0];

													return (
														<div
															key={report.report_id}
															className={`flex flex-col md:flex-row md:items-center justify-between rounded-lg p-3 md:p-4 space-y-3 md:space-y-0 ${
																report.urgency === "high"
																	? "bg-[#FFF5F5]"
																	: report.urgency === "medium"
																	? "bg-[#FFF8F0]"
																	: "bg-[#F0F9FF]"
															}`}
														>
															<div className="flex md:hidden flex-col space-y-3">
																<div className="flex items-start justify-between">
																	<div className="flex items-start gap-2 flex-1">
																		<div className="h-8 w-8 shrink-0 rounded-full bg-[#1A3434] text-white flex items-center justify-center text-sm">
																			{report.type_of_incident?.[0]?.toUpperCase() || "?"}
																		</div>
																		<div className="min-w-0">
																			<h4 className="font-medium text-sm">
																				{formatServiceName(
																					report.type_of_incident || "Unknown Incident"
																				)}
																			</h4>
																			{report.incident_description && (
																				<p className="text-sm text-gray-600 mt-1 line-clamp-2">
																					{report.incident_description}
																				</p>
																			)}
																			<div className="flex flex-wrap gap-2 text-xs text-gray-500 mt-1">
																				<span>
																					{new Date(
																						report.submission_timestamp || ""
																					).toLocaleDateString()}
																				</span>
																				<span
																					className={`
																								px-2 py-0.5 rounded-full text-xs
																								${
																									report.urgency === "high"
																										? "bg-red-100 text-red-700"
																										: report.urgency === "medium"
																										? "bg-yellow-100 text-yellow-700"
																										: "bg-blue-100 text-blue-700"
																								}
																						`}
																				>
																					{formatServiceName(report.urgency || "low")}
																				</span>
																			</div>
																		</div>
																	</div>
																	<Button
																		variant="ghost"
																		size="icon"
																		className="text-destructive hover:text-destructive hover:bg-destructive/10 -mt-1"
																		onClick={() => setDeleteReport(report.report_id)}
																	>
																		<Trash2 className="h-4 w-4" />
																	</Button>
																</div>

																<div className="bg-white/50 p-2 rounded-md">
																	<p className="font-medium text-sm">
																		{matchedService?.support_services.name || "Pending Match"}
																	</p>
																	<p className="text-xs text-gray-500">
																		{matchedService?.match_status_type
																			? formatServiceName(matchedService.match_status_type)
																			: "Awaiting Response"}
																	</p>
																</div>

																{appointment && (
																	<Button
																		className="w-full bg-[#00A5A5] hover:bg-[#008585] text-sm"
																		onClick={() => {
																			console.log("View appointment:", appointment);
																		}}
																	>
																		{appointment.status === "confirmed"
																			? "Join Meeting"
																			: "View Appointment"}
																	</Button>
																)}
															</div>

															<div className="hidden md:flex items-start gap-3">
																<div className="h-10 w-10 shrink-0 rounded-full bg-[#1A3434] text-white flex items-center justify-center">
																	{report.type_of_incident?.[0]?.toUpperCase() || "?"}
																</div>
																<div className="min-w-0">
																	<h4 className="font-medium">
																		{formatServiceName(
																			report.type_of_incident || "Unknown Incident"
																		)}
																	</h4>
																	{report.incident_description && (
																		<p className="text-sm text-gray-600 mt-1 line-clamp-2">
																			{report.incident_description}
																		</p>
																	)}
																	<div className="flex flex-wrap items-center gap-2 text-sm text-gray-500 mt-1">
																		<span>
																			{new Date(
																				report.submission_timestamp || ""
																			).toLocaleDateString()}
																		</span>
																		<span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
																		<span
																			className={`
																								px-2 py-0.5 rounded-full text-xs
																								${
																									report.urgency === "high"
																										? "bg-red-100 text-red-700"
																										: report.urgency === "medium"
																										? "bg-yellow-100 text-yellow-700"
																										: "bg-blue-100 text-blue-700"
																								}
																						`}
																		>
																			{formatServiceName(report.urgency || "low")} Priority
																		</span>
																	</div>
																</div>
															</div>

															<div className="hidden md:flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-6">
																<div className="w-full md:w-auto">
																	<p className="font-medium">
																		{matchedService?.support_services.name || "Pending Match"}
																	</p>
																	<p className="text-sm text-gray-500">
																		{matchedService?.match_status_type
																			? formatServiceName(matchedService.match_status_type)
																			: "Awaiting Response"}
																	</p>
																</div>
																<div className="flex w-full md:w-auto gap-2">
																	{appointment && (
																		<Button
																			className="flex-1 md:flex-none bg-[#00A5A5] hover:bg-[#008585]"
																			onClick={() => {
																				console.log("View appointment:", appointment);
																			}}
																		>
																			{appointment.status === "confirmed"
																				? "Join Meeting"
																				: "View Appointment"}
																		</Button>
																	)}
																	<Button
																		variant="ghost"
																		size="icon"
																		className="text-destructive hover:text-destructive hover:bg-destructive/10"
																		onClick={() => setDeleteReport(report.report_id)}
																	>
																		<Trash2 className="h-4 w-4" />
																	</Button>
																</div>
															</div>
														</div>
													);
												})}
											</div>
										) : (
											<div className="text-center py-12 bg-gray-50 rounded-lg">
												<div className="space-y-3">
													<p className="text-gray-500">No reports found</p>
													<p className="text-sm text-gray-400">
														Click "New Report" to create your first report
													</p>
												</div>
											</div>
										)}
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

						{/* Desktop Sidebar */}
						<div className="hidden md:block w-[350px] space-y-6 sticky top-6 self-start">
							<Card className="mb-6 bg-[#466D6D] text-white">
								<CardContent className="p-6">
									<h3 className="mb-2 text-lg font-bold">Explore Support Resources</h3>
									<p className="mb-4">
										Did you know? Having access to the right resources can increase your
										chances of recovery by 70%. Discover personalized support options
										tailored for you.
									</p>

									<div className="mt-4 flex justify-between items-center">
										<Button asChild className="bg-teal-600 hover:bg-teal-700">
											<Link href="/dashboard/resources">Browse Resources</Link>
										</Button>
										<Image
											src="/dashboard/watering-can.png"
											alt="Growth and Support Illustration"
											width={100}
											height={100}
											className="opacity-90"
										/>
									</div>
								</CardContent>
							</Card>
							<JoinCommunity />
						</div>
					</div>
				</div>
			</div>

			{/* Alert Dialog */}
			<AlertDialog
				open={!!deleteReport}
				onOpenChange={(open) => !open && setDeleteReport(null)}
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
							onClick={() => deleteReport && handleDelete(deleteReport)}
						>
							Delete
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
