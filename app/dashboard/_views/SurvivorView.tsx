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
import { useState, useEffect } from "react";
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
import CaseCard from "@/app/components/CaseCard";
import { Bell, Search, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { Calendar } from "@/components/ui/calendar";
// import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { MainSidebar } from "./MainSidebar";
import { CommunityCard } from "@/app/components/CommunityCard";
import { DailyProgress } from "@/app/components/DailyProgress";
import WelcomeHeader from "@/app/components/WelcomeHeader";
import { JoinCommunity } from "@/app/components/JoinCommunity";
import { AppointmentsTab } from "../_components/tabs/AppointmentsTab";
import { SafetyPlanCard } from "@/components/SafetyPlanCard";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { StatCard } from "@/components/dashboard/StatCard";
import { Megaphone, CalendarDays, MessageCircle, BookOpen } from "lucide-react";

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
	const [reports, setReports] = useState<ReportWithRelations[]>([]);
	const [open, setOpen] = useState(false);
	const searchParams = useSearchParams();
	const initialTab = (searchParams?.get("tab") as "overview" | "reports" | "appointments" | null) || "overview";
	const [activeTab, setActiveTab] = useState<"overview" | "reports" | "appointments">(initialTab);
	const supabase = createClient();
	const { toast } = useToast();
	const [deleteReport, setDeleteReport] = useState<string | null>(null);
	const [showAlert, setShowAlert] = useState(true);

	// Move fetchReports outside useEffect so it can be called from handlers
	const fetchReports = async () => {
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
					return;
				}
			}
		}

		// If no appointments needed to be fetched or if there was an error, just set the reports
		console.log("Fetched reports:", data);
		setReports(data || []);
	};

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
		fetchReports();

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
	}, [userId, toast, fetchReports]);

	// Add formatServiceName inside component
	const formatServiceName = (service: string) => {
		return service
			.split("_")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");
	};

	return (
		<div className="flex min-h-screen bg-white">
			<main className="flex-1 w-full">
				<div className="p-4 md:p-6 mt-14 md:mt-0 mb-20 md:mb-0">
					<WelcomeHeader profileDetails={profileDetails} />

					{/* Quick Actions */}
					<div className="my-4">
						<QuickActions
							actions={[
								{ label: "Report Now", description: "Start a new report", onClick: () => setOpen(true), icon: Megaphone },
								{ label: "Appointments", description: "View your schedule", href: "/dashboard?tab=appointments", icon: CalendarDays },
								{ label: "Messages", description: "Open chat", href: "/dashboard/chat", icon: MessageCircle },
								{ label: "Resources", description: "Learn and grow", href: "/dashboard/resources", icon: BookOpen },
							]}
						/>
					</div>

					{/* Safety Plan (local) */}
					<div className="my-4">
						<SafetyPlanCard userId={userId} />
					</div>

					{/* Content Tabs */}
					<div className="flex flex-col md:flex-row gap-6">
						<div className="flex-1">
							<Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)} className="mb-8">
								<TabsList className="w-full overflow-x-auto flex whitespace-nowrap">
								<TabsTrigger value="overview">Overview</TabsTrigger>
								<TabsTrigger value="reports">Reports</TabsTrigger>
								<TabsTrigger value="appointments">Appointments</TabsTrigger>
								</TabsList>

								<TabsContent value="overview">
									<div className="space-y-8">
										<div className="space-y-6">
											<div className="flex justify-between items-center">
												<div>
													<h2 className="text-xl font-semibold text-[#1A3434]">
														My Reports
													</h2>
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

								<TabsContent value="appointments">
									<AppointmentsTab
										userId={userId}
										userType="survivor"
										username={profileDetails.first_name || profileDetails.id.slice(0, 8)}
									/>
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
			</main>

			{/* Existing Alert Dialog */}
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
		</div>
	);
}
