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

// Add this interface near the top with other interfaces
interface SupportService {
	id: string;
	name: string;
	service_types: string;
	phone_number: string | null;
	availability: string | null;
	latitude: number | null;
	longitude: number | null;
	created_at: string;
}

// Add this interface near the top with other interfaces
interface MatchedCase {
	id: string;
	match_status_type: Database["public"]["Enums"]["match_status_type"];
	match_date: string | null;
	match_score: number | null;
	report: {
		report_id: string;
		type_of_incident: string;
		urgency: string;
		submission_timestamp: string;
	};
	support_service: {
		id: string;
		name: string;
		service_types: string;
	};
	appointments?: {
		id: string;
		date: string;
		status: Database["public"]["Enums"]["appointment_status_type"];
	}[];
}

export default function ProfessionalView({
	userId,
	profileDetails,
}: SurvivorViewProps) {
	const [reports, setReports] = useState<ReportWithRelations[]>([]);
	const [open, setOpen] = useState(false);
	const supabase = createClient();
	const { toast } = useToast();
	const [deleteReport, setDeleteReport] = useState<string | null>(null);
	const [showAlert, setShowAlert] = useState(true);
	const [supportServices, setSupportServices] = useState<SupportService[]>([]);
	const [matchedCases, setMatchedCases] = useState<MatchedCase[]>([]);

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

	// Add this function to fetch support services
	const fetchSupportServices = async () => {
		const { data, error } = await supabase
			.from("support_services")
			.select("*")
			.eq("user_id", userId)
			.order("created_at", { ascending: false });

		if (error) {
			console.error("Error fetching support services:", error);
			toast({
				title: "Error",
				description: "Failed to fetch support services. Please try again.",
				variant: "destructive",
			});
			return;
		}

		setSupportServices(data || []);
	};

	// Add this function to fetch matched cases
	const fetchMatchedCases = async () => {
		const { data, error } = await supabase
			.from("matched_services")
			.select(
				`
				id,
				match_status_type,
				match_date,
				match_score,
				report:reports!inner(
					report_id,
					type_of_incident,
					urgency,
					submission_timestamp
				)::report!inner(*)::single,
				support_service:support_services!inner(
					id,
					name,
					service_types
				)::support_services!inner(*)::single,
				appointments(
					id,
					date,
					status
				)
			`
			)
			.eq("professional_id", userId);

		if (error) throw error;
		setMatchedCases(data || []);
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

	useEffect(() => {
		fetchSupportServices();
	}, [userId]);

	useEffect(() => {
		fetchMatchedCases();
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
			<main className="flex-1 w-[calc(100%-80px)]">
				<div className="p-6">
					<WelcomeHeader profileDetails={profileDetails} />

					{/* New layout structure */}
					<div className="flex gap-6">
						{/* Left side with tabs - taking up more space */}
						<div className="flex-1">
							<Tabs defaultValue="overview" className="mb-8">
								<TabsList>
									<TabsTrigger value="overview">Overview</TabsTrigger>
									<TabsTrigger value="reports">My Reports</TabsTrigger>
									<TabsTrigger value="matched-cases">Matched Cases</TabsTrigger>
									<TabsTrigger value="support-services">Support Services</TabsTrigger>
								</TabsList>

								{/* Tab contents now take full width of their container */}
								<TabsContent value="overview">
									<div className="space-y-8">
										{/* Reports Section */}
										<div className="space-y-6">
											<div className="flex justify-between items-center">
												<div>
													<h2 className="text-xl font-semibold text-[#1A3434]">
														Recent Reports
													</h2>
													<p className="text-sm text-gray-500">
														{reports.length} {reports.length === 1 ? "report" : "reports"}{" "}
														found
													</p>
												</div>
											</div>

											{reports.length > 0 ? (
												<div className="space-y-3">
													{reports.map((report) => {
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
																{/* Existing report card content */}
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
																				className={`px-2 py-0.5 rounded-full text-xs ${
																					report.urgency === "high"
																						? "bg-red-100 text-red-700"
																						: report.urgency === "medium"
																						? "bg-yellow-100 text-yellow-700"
																						: "bg-blue-100 text-blue-700"
																				}`}
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
																	{appointment && (
																		<Button className="bg-[#00A5A5] hover:bg-[#008585]">
																			{appointment.status === "confirmed"
																				? "Join Meeting"
																				: "View Appointment"}
																		</Button>
																	)}
																</div>
															</div>
														);
													})}
												</div>
											) : (
												<div className="text-center py-6 bg-gray-50 rounded-lg">
													<p className="text-gray-500">No reports found</p>
												</div>
											)}
										</div>

										{/* Matched Cases Section */}
										<div className="space-y-6">
											<div>
												<h2 className="text-xl font-semibold text-[#1A3434]">
													Recent Matched Cases
												</h2>
												<p className="text-sm text-gray-500">
													{matchedCases.length}{" "}
													{matchedCases.length === 1 ? "case" : "cases"} matched
												</p>
											</div>

											{matchedCases.length > 0 ? (
												<div className="space-y-4">
													{matchedCases.slice(0, 3).map((matchedCase) => (
														<div
															key={matchedCase.id}
															className={`rounded-lg p-4 ${
																matchedCase.report.urgency === "high"
																	? "bg-[#FFF5F5]"
																	: matchedCase.report.urgency === "medium"
																	? "bg-[#FFF8F0]"
																	: "bg-[#F0F9FF]"
															}`}
														>
															{/* Existing matched case card content */}
															<div className="flex items-center justify-between">
																<div className="flex items-center gap-3">
																	<div className="h-10 w-10 rounded-full bg-[#1A3434] text-white flex items-center justify-center">
																		{matchedCase.report.type_of_incident?.[0]?.toUpperCase() ||
																			"?"}
																	</div>
																	<div>
																		<h4 className="font-medium">
																			{formatServiceName(matchedCase.report.type_of_incident)}
																		</h4>
																		<div className="flex items-center gap-2 text-sm text-gray-500">
																			<span>
																				Matched on{" "}
																				{new Date(
																					matchedCase.match_date || ""
																				).toLocaleDateString()}
																			</span>
																		</div>
																	</div>
																</div>

																<div className="flex items-center gap-4">
																	<div className="text-right">
																		<p className="font-medium">
																			{matchedCase.support_service.name}
																		</p>
																		<p className="text-sm text-gray-500">
																			{formatServiceName(matchedCase.match_status_type)}
																		</p>
																	</div>
																</div>
															</div>
														</div>
													))}
												</div>
											) : (
												<div className="text-center py-6 bg-gray-50 rounded-lg">
													<p className="text-gray-500">No matched cases found</p>
												</div>
											)}
										</div>

										{/* Support Services Section */}
										<div className="space-y-6">
											<div>
												<h2 className="text-xl font-semibold text-[#1A3434]">
													Your Support Services
												</h2>
												<p className="text-sm text-gray-500">
													{supportServices.length}{" "}
													{supportServices.length === 1 ? "service" : "services"} registered
												</p>
											</div>

											{supportServices.length > 0 ? (
												<div className="grid gap-4">
													{supportServices.slice(0, 3).map((service) => (
														<div
															key={service.id}
															className="p-4 rounded-lg border bg-card flex justify-between items-start"
														>
															<div className="space-y-2">
																<h3 className="font-medium">{service.name}</h3>
																<div className="flex flex-wrap gap-2">
																	{service.service_types.split(",").map((type, index) => (
																		<span
																			key={index}
																			className="px-2 py-1 text-xs rounded-full bg-secondary text-secondary-foreground"
																		>
																			{formatServiceName(type.trim())}
																		</span>
																	))}
																</div>
															</div>
														</div>
													))}
												</div>
											) : (
												<div className="text-center py-6 bg-gray-50 rounded-lg">
													<p className="text-gray-500">No support services found</p>
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
								</TabsContent>

								<TabsContent value="matched-cases">
									<div className="space-y-6">
										<div className="flex justify-between items-center">
											<div>
												<h2 className="text-xl font-semibold text-[#1A3434]">
													Matched Cases
												</h2>
												<p className="text-sm text-gray-500">
													{matchedCases.length}{" "}
													{matchedCases.length === 1 ? "case" : "cases"} matched
												</p>
											</div>
										</div>

										{matchedCases.length > 0 ? (
											<div className="space-y-4">
												{matchedCases.map((matchedCase) => (
													<div
														key={matchedCase.id}
														className={`rounded-lg p-4 ${
															matchedCase.report.urgency === "high"
																? "bg-[#FFF5F5]"
																: matchedCase.report.urgency === "medium"
																? "bg-[#FFF8F0]"
																: "bg-[#F0F9FF]"
														}`}
													>
														<div className="flex items-center justify-between">
															<div className="flex items-center gap-3">
																<div className="h-10 w-10 rounded-full bg-[#1A3434] text-white flex items-center justify-center">
																	{matchedCase.report.type_of_incident?.[0]?.toUpperCase() ||
																		"?"}
																</div>
																<div>
																	<h4 className="font-medium">
																		{formatServiceName(matchedCase.report.type_of_incident)}
																	</h4>
																	<div className="flex items-center gap-2 text-sm text-gray-500">
																		<span>
																			Matched on{" "}
																			{new Date(matchedCase.match_date || "").toLocaleDateString()}
																		</span>
																		<span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
																		<span
																			className={`
																			px-2 py-0.5 rounded-full text-xs
																			${
																				matchedCase.report.urgency === "high"
																					? "bg-red-100 text-red-700"
																					: matchedCase.report.urgency === "medium"
																					? "bg-yellow-100 text-yellow-700"
																					: "bg-blue-100 text-blue-700"
																			}
																		`}
																		>
																			{formatServiceName(matchedCase.report.urgency)} Priority
																		</span>
																	</div>
																</div>
															</div>

															<div className="flex items-center gap-4">
																<div className="text-right">
																	<p className="font-medium">
																		{matchedCase.support_service.name}
																	</p>
																	<p className="text-sm text-gray-500">
																		{formatServiceName(matchedCase.match_status_type)}
																	</p>
																</div>
																{matchedCase.appointments?.[0] && (
																	<Button
																		className="bg-[#00A5A5] hover:bg-[#008585]"
																		onClick={() => {
																			// Handle appointment action
																			console.log(
																				"Appointment action:",
																				matchedCase.appointments?.[0]
																			);
																		}}
																	>
																		{matchedCase.appointments[0].status === "confirmed"
																			? "Join Meeting"
																			: "View Appointment"}
																	</Button>
																)}
															</div>
														</div>

														{matchedCase.match_score && (
															<div className="mt-4 flex items-center gap-2">
																<span className="text-sm text-gray-500">Match Score:</span>
																<span className="text-sm font-medium">
																	{Math.round(matchedCase.match_score * 100)}%
																</span>
															</div>
														)}
													</div>
												))}
											</div>
										) : (
											<div className="text-center py-12 bg-gray-50 rounded-lg">
												<div className="space-y-3">
													<p className="text-gray-500">No matched cases found</p>
													<p className="text-sm text-gray-400">
														Cases will appear here when they are matched with support services
													</p>
												</div>
											</div>
										)}
									</div>
								</TabsContent>

								<TabsContent value="support-services">
									<div className="space-y-6">
										<div className="flex justify-between items-center">
											<div>
												<h2 className="text-xl font-semibold text-[#1A3434]">
													Support Services
												</h2>
												<p className="text-sm text-gray-500">
													{supportServices.length}{" "}
													{supportServices.length === 1 ? "service" : "services"} registered
												</p>
											</div>
											<Button
												onClick={() => {
													/* Add your new service dialog logic here */
												}}
											>
												<Plus className="h-4 w-4 mr-2" />
												Add Service
											</Button>
										</div>

										{supportServices.length > 0 ? (
											<div className="grid gap-4">
												{supportServices.map((service) => (
													<div
														key={service.id}
														className="p-4 rounded-lg border bg-card flex justify-between items-start"
													>
														<div className="space-y-2">
															<h3 className="font-medium">{service.name}</h3>
															<div className="flex flex-wrap gap-2">
																{service.service_types.split(",").map((type, index) => (
																	<span
																		key={index}
																		className="px-2 py-1 text-xs rounded-full bg-secondary text-secondary-foreground"
																	>
																		{formatServiceName(type.trim())}
																	</span>
																))}
															</div>
															{service.phone_number && (
																<p className="text-sm text-muted-foreground">
																	📞 {service.phone_number}
																</p>
															)}
															{service.availability && (
																<p className="text-sm text-muted-foreground">
																	🕒 {service.availability}
																</p>
															)}
															{service.latitude && service.longitude && (
																<p className="text-sm text-muted-foreground">
																	📍 Location available
																</p>
															)}
														</div>
														<Button
															variant="ghost"
															size="icon"
															className="text-destructive hover:text-destructive hover:bg-destructive/10"
															onClick={() => {
																// Add your delete service logic here
															}}
														>
															<Trash2 className="h-4 w-4" />
														</Button>
													</div>
												))}
											</div>
										) : (
											<div className="text-center py-12 bg-gray-50 rounded-lg">
												<div className="space-y-3">
													<p className="text-gray-500">No support services found</p>
													<p className="text-sm text-gray-400">
														Click "Add Service" to register your first support service
													</p>
												</div>
											</div>
										)}
									</div>
								</TabsContent>
							</Tabs>
							{/* Additional content visible across all tabs */}
							<div className="space-y-8">
								<UpcomingAppointments />
								<div className="grid grid-cols-2 gap-6">
									<CommunityCard />
									{/* <DailyProgress /> */}
								</div>
							</div>
						</div>

						{/* Right side cards - fixed width */}
						<div className="w-[350px] space-y-6">
							{/* Condition Check Card */}
							<Card className="bg-[#466D6D] text-white">
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

							{/* Community Card */}
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
