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
import { UpcomingAppointments } from "@/app/components/UpcomingAppointments";
import { CommunityCard } from "@/app/components/CommunityCard";
import { DailyProgress } from "@/app/components/DailyProgress";
import WelcomeHeader from "@/app/components/WelcomeHeader";
import { JoinCommunity } from "@/app/components/JoinCommunity";

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
	}, [userId]);

	// Add formatServiceName inside component
	const formatServiceName = (service: string) => {
		return service
			.split("_")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");
	};

	return (
		<div className="flex min-h-screen bg-white">
			{/* <MainSidebar /> */}
			<main className="flex-1 w-[calc(100%-80px)]">
				<div className="p-6">
					{/* Alert Banner */}
					{/* {showAlert && (
						<Alert className="mb-6 bg-[#FFF8F0] border-none">
							<AlertTitle className="flex items-center gap-2">
								<Info className="h-5 w-5" />
								Information
							</AlertTitle>
							<AlertDescription className="flex items-center justify-between">
								<span>
									This is a temporary account. It will be cleared after: 4days 24hrs 10
									Sec
								</span>
								<div className="flex gap-4">
									<Button
										variant="outline"
										className="border-teal-600 text-teal-600"
										asChild
									>
										<Link href="/signup">Create An Account</Link>
									</Button>
									<Button variant="ghost" onClick={() => setShowAlert(false)}>
										Dismiss
									</Button>
								</div>
							</AlertDescription>
						</Alert>
					)} */}

					{/* Header */}
					<WelcomeHeader profileDetails={profileDetails} />

					{/* Tabs */}
					<Tabs defaultValue="overview" className="mb-8">
						<TabsList>
							<TabsTrigger value="overview">Overview</TabsTrigger>
							<TabsTrigger value="reports" disabled>
								My Reports
							</TabsTrigger>
							<TabsTrigger value="toolkit" disabled>
								My Toolkit
							</TabsTrigger>
						</TabsList>

						<TabsContent value="overview">
							<div className="grid grid-cols-12 gap-6">
								<div className="col-span-8">
									{/* Reports Section */}
									<div className="mb-8">
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
															className={`flex items-center justify-between rounded-lg p-4 ${
																report.urgency === "high"
																	? "bg-[#FFF5F5]"
																	: report.urgency === "medium"
																	? "bg-[#FFF8F0]"
																	: "bg-[#F0F9FF]"
															}`}
														>
															<div className="flex items-center gap-3">
																<div className="h-10 w-10 rounded-full bg-[#1A3434] text-white flex items-center justify-center">
																	{report.type_of_incident?.[0]?.toUpperCase() || "?"}
																</div>
																<div>
																	<h4 className="font-medium">
																		{formatServiceName(
																			report.type_of_incident || "Unknown Incident"
																		)}
																	</h4>
																	<div className="flex items-center gap-2 text-sm text-gray-500">
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

															<div className="flex items-center gap-6">
																<div>
																	<p className="font-medium">
																		{matchedService?.support_services.name || "Pending Match"}
																	</p>
																	<p className="text-sm text-gray-500">
																		{matchedService?.match_status_type
																			? formatServiceName(matchedService.match_status_type)
																			: "Awaiting Response"}
																	</p>
																</div>
																<div className="flex gap-2">
																	{appointment && (
																		<Button
																			className="bg-[#00A5A5] hover:bg-[#008585]"
																			onClick={() => {
																				// Handle appointment view
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

									{/* Action Cards */}
									{/* <div className="mb-8 grid grid-cols-3 gap-6">
										<Card className="bg-[#F8FAF9]">
											<CardContent className="flex items-center justify-center p-6">
												<div className="text-center">
													<div className="mb-4 flex justify-center">
														<Image
															src="/icons/new-incident.svg"
															alt="New Incident"
															width={40}
															height={40}
														/>
													</div>
													<p>New Incident</p>
												</div>
											</CardContent>
										</Card> */}
									{/* Add other action cards */}
									{/* </div> */}

									{/* Existing components */}
									<UpcomingAppointments />
									<div className="mt-6 grid grid-cols-2 gap-6">
										<CommunityCard />
										<DailyProgress />
									</div>
								</div>

								{/* Right Column */}
								<div className="col-span-4">
									{/* Condition Check Card */}
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
													<Link href="/resources">Browse Resources</Link>
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
									{/* 
									<Card className="mb-6 bg-[#466D6D] text-white">
										<CardContent className="p-6">
											<h3 className="mb-2 text-lg font-bold">Check your condition</h3>
											<p className="mb-4">
												Take a simple test to evaluate how you are feeling
											</p>

											<div className="mt-4 flex justify-end">
												<Image
													src="/dashboard/watering-can.png"
													alt="Illustration"
													width={100}
													height={100}
												/>
											</div>
											<Button className="bg-teal-600">Check it now</Button>
										</CardContent>
									</Card> */}

									{/* Appointments Calendar */}
									{/* <div>
										<div className="mb-4 flex items-center justify-between">
											<h3 className="text-lg font-bold">List of Appointments</h3>
											<div className="flex gap-2">
												<Button variant="ghost" className="text-teal-600">
													Monthly
												</Button>
												<Button variant="ghost">Daily</Button>
											</div>
										</div>
										<Calendar
											mode="single"
											selected={new Date()}
											className="rounded-md border"
											components={{
												DayContent: (props) => {
													const date = props.date;
													const isHighlighted = [7, 28].includes(date.getDate());
													return (
														<div
															className={`relative ${
																isHighlighted ? "bg-teal-600 text-white rounded-full" : ""
															}`}
														>
															{date.getDate()}
														</div>
													);
												},
											}}
										/>
										<div className="mt-4 flex justify-end">
											<Button variant="link" className="text-teal-600">
												See More Schedule →
											</Button>
										</div>
									</div> */}

									{/* Community Card */}
									<JoinCommunity />
								</div>
							</div>
						</TabsContent>

						{/* <TabsContent value="reports">
							<div className="space-y-6">
								<div className="flex justify-between items-center mb-6">
									<div>
										<h2 className="text-xl font-semibold text-[#1A3434]">My Reports</h2>
										<p className="text-sm text-gray-500">
											{reports.length} {reports.length === 1 ? "report" : "reports"} found
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
													className={`flex items-center justify-between rounded-lg p-4 ${
														report.urgency === "high"
															? "bg-[#FFF5F5]"
															: report.urgency === "medium"
															? "bg-[#FFF8F0]"
															: "bg-[#F0F9FF]"
													}`}
												>
													<div className="flex items-center gap-3">
														<div className="h-10 w-10 rounded-full bg-[#1A3434] text-white flex items-center justify-center">
															{report.type_of_incident?.[0]?.toUpperCase() || "?"}
														</div>
														<div>
															<h4 className="font-medium">
																{formatServiceName(
																	report.type_of_incident || "Unknown Incident"
																)}
															</h4>
															<div className="flex items-center gap-2 text-sm text-gray-500">
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

													<div className="flex items-center gap-6">
														<div>
															<p className="font-medium">
																{matchedService?.support_services.name || "Pending Match"}
															</p>
															<p className="text-sm text-gray-500">
																{matchedService?.match_status_type
																	? formatServiceName(matchedService.match_status_type)
																	: "Awaiting Response"}
															</p>
														</div>
														<div className="flex gap-2">
															{appointment && (
																<Button
																	className="bg-[#00A5A5] hover:bg-[#008585]"
																	onClick={() => {
																		// Handle appointment view
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
						</TabsContent> */}

						{/* <TabsContent value="toolkit">
							<div className="grid gap-6">
								<h2 className="text-2xl font-bold">My Toolkit</h2>
								
							</div>
						</TabsContent> */}
					</Tabs>
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
