"use client";

import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { UpcomingAppointments } from "@/app/components/UpcomingAppointments";
import { CommunityCard } from "@/app/components/CommunityCard";
import WelcomeHeader from "@/app/components/WelcomeHeader";
import { JoinCommunity } from "@/app/components/JoinCommunity";
import { ConditionCheckCard } from "@/app/components/ConditionCheckCard";
import { Tables } from "@/types/db-schema";
import { createClient } from "@/utils/supabase/client";
import { deleteReport, fetchUserReports } from "./actions/reports";
import {
	fetchUserSupportServices,
	deleteSupportService,
} from "./actions/support-services";
import { AddSupportServiceForm } from "@/components/AddSupportServiceForm";
import { DailyProgress } from "@/app/components/DailyProgress";

interface ProfessionalViewProps {
	userId: string;
	profileDetails: Tables<"profiles">;
}

// Dummy data for reports
// const dummyReports = [
// 	{
// 		report_id: "1",
// 		type_of_incident: "domestic_violence",
// 		urgency: "high",
// 		submission_timestamp: "2024-03-15T10:00:00Z",
// 		matched_services: [
// 			{
// 				support_services: { name: "Emergency Support Center" },
// 				match_status_type: "accepted",
// 				appointments: [{ status: "confirmed", datetime: "2024-03-20T14:00:00Z" }],
// 			},
// 		],
// 	},
// 	{
// 		report_id: "2",
// 		type_of_incident: "sexual_harassment",
// 		urgency: "medium",
// 		submission_timestamp: "2024-03-14T15:30:00Z",
// 		matched_services: [
// 			{
// 				support_services: { name: "Women's Legal Aid" },
// 				match_status_type: "pending",
// 				appointments: [],
// 			},
// 		],
// 	},
// 	{
// 		report_id: "3",
// 		type_of_incident: "stalking",
// 		urgency: "low",
// 		submission_timestamp: "2024-03-13T09:15:00Z",
// 		matched_services: [],
// 	},
// ];

// Dummy data for matched cases
const matchedCases = [
	{
		id: "1",
		report: {
			type_of_incident: "domestic_violence",
			urgency: "high",
		},
		match_date: "2024-03-15T10:00:00Z",
		support_service: { name: "Emergency Support Center" },
		match_status_type: "accepted",
		match_score: 0.95,
		appointments: [{ status: "confirmed" }],
	},
	{
		id: "2",
		report: {
			type_of_incident: "sexual_harassment",
			urgency: "medium",
		},
		match_date: "2024-03-14T15:30:00Z",
		support_service: { name: "Women's Legal Aid" },
		match_status_type: "pending",
		match_score: 0.85,
		appointments: [],
	},
];

// Dummy data for support services
const supportServices = [
	{
		id: "1",
		name: "Emergency Support Center",
		service_types: "domestic_violence, crisis_intervention",
		phone_number: "+1 (555) 123-4567",
		availability: "24/7",
		latitude: 40.7128,
		longitude: -74.006,
	},
	{
		id: "2",
		name: "Women's Legal Aid",
		service_types: "legal_support, counseling",
		phone_number: "+1 (555) 987-6543",
		availability: "Mon-Fri 9AM-5PM",
		latitude: 40.7589,
		longitude: -73.9851,
	},
	{
		id: "3",
		name: "Trauma Recovery Center",
		service_types: "counseling, therapy, support_group",
		phone_number: "+1 (555) 456-7890",
		availability: "Mon-Sat 8AM-8PM",
		latitude: 40.7829,
		longitude: -73.9654,
	},
];

export default function ProfessionalView({
	userId,
	profileDetails,
}: ProfessionalViewProps) {
	const [open, setOpen] = useState(false);
	const [deleteReportId, setDeleteReportId] = useState<string | null>(null);
	const { toast } = useToast();
	const [reports, setReports] = useState<Tables<"reports">[]>([]);
	const [supportServices, setSupportServices] = useState<
		Tables<"support_services">[]
	>([]);
	const [deleteServiceId, setDeleteServiceId] = useState<string | null>(null);
	const [reportDialogOpen, setReportDialogOpen] = useState(false);

	const handleDelete = async (reportId: string) => {
		try {
			await deleteReport(reportId);
			setReports(reports.filter((report) => report.report_id !== reportId));
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

	useEffect(() => {
		const loadData = async () => {
			try {
				// Load both reports and support services
				const [userReports, userServices] = await Promise.all([
					fetchUserReports(userId),
					fetchUserSupportServices(userId)
				]);
				
				setReports(userReports);
				setSupportServices(userServices);
			} catch (error) {
				toast({
					title: "Error",
					description: "Failed to load data. Please try again.",
					variant: "destructive",
				});
			}
		};

		loadData();

		// Set up real-time subscription for reports
		const supabase = createClient();
		const reportsChannel = supabase
			.channel("reports-changes")
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "reports",
					filter: `user_id=eq.${userId}`,
				},
				async () => {
					const updatedReports = await fetchUserReports(userId);
					setReports(updatedReports);
				}
			)
			.subscribe();

		// Set up real-time subscription for support services
		const servicesChannel = supabase
			.channel("support-services")
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "support_services",
					filter: `user_id=eq.${userId}`,
				},
				async () => {
					const updatedServices = await fetchUserSupportServices(userId);
					setSupportServices(updatedServices);
				}
			)
			.subscribe();

		return () => {
			supabase.removeChannel(reportsChannel);
			supabase.removeChannel(servicesChannel);
		};
	}, [userId]);

	const handleDeleteService = async (serviceId: string) => {
		try {
			await deleteSupportService(serviceId);
			setSupportServices((services) =>
				services.filter((service) => service.id !== serviceId)
			);
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

	return (
		<div className="flex min-h-screen bg-white">
			<main className="flex-1 w-full">
				<div className="p-4 md:p-6 mt-14 md:mt-0 mb-20 md:mb-0">
					<WelcomeHeader profileDetails={profileDetails} />

					<div className="flex flex-col md:flex-row gap-6">
						<div className="flex-1">
							<Tabs defaultValue="overview" className="mb-8">
								<TabsList className="overflow-x-auto">
									<TabsTrigger value="overview">Overview</TabsTrigger>
									<TabsTrigger value="reports">Reports</TabsTrigger>
									<TabsTrigger value="matched-cases">Cases</TabsTrigger>
									<TabsTrigger value="support-services">Services</TabsTrigger>
								</TabsList>

								<TabsContent value="overview">
									<div className="space-y-8">
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
														return (
															<div
																key={report.report_id}
																className={`flex flex-col rounded-lg p-4 ${
																	report.urgency === "high"
																		? "bg-[#FFF5F5]"
																		: report.urgency === "medium"
																		? "bg-[#FFF8F0]"
																		: "bg-[#F0F9FF]"
																}`}
															>
																<div className="flex items-center justify-between">
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

																	<Button
																		variant="ghost"
																		size="icon"
																		className="text-destructive hover:text-destructive hover:bg-destructive/10"
																		onClick={() => setDeleteReportId(report.report_id)}
																	>
																		<Trash2 className="h-4 w-4" />
																	</Button>
																</div>

																{report.incident_description && (
																	<div className="mt-3 text-sm text-gray-600 line-clamp-3">
																		{report.incident_description}
																	</div>
																)}
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
											<Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
												<DialogTrigger asChild>
													<Button>
														<Plus className="h-4 w-4 mr-2" />
														New Report
													</Button>
												</DialogTrigger>
												<DialogContent className="sm:max-w-4xl z-[1000]">
													<DialogHeader>
														<DialogTitle>Report Abuse</DialogTitle>
														<DialogDescription>
															Please fill out this form to report an incident. All information
															will be kept confidential.
														</DialogDescription>
													</DialogHeader>
													<AuthenticatedReportAbuseForm
														onClose={() => setReportDialogOpen(false)}
														userId={userId}
													/>
												</DialogContent>
											</Dialog>
										</div>

										{reports.length > 0 ? (
											<div className="space-y-3">
												{reports.map((report) => (
													<div
														key={report.report_id}
														className={`flex flex-col rounded-lg p-4 ${
															report.urgency === "high"
																? "bg-[#FFF5F5]"
																: report.urgency === "medium"
																? "bg-[#FFF8F0]"
																: "bg-[#F0F9FF]"
														}`}
													>
														<div className="flex items-center justify-between">
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

															<Button
																variant="ghost"
																size="icon"
																className="text-destructive hover:text-destructive hover:bg-destructive/10"
																onClick={() => setDeleteReportId(report.report_id)}
															>
																<Trash2 className="h-4 w-4" />
															</Button>
														</div>

														{report.incident_description && (
															<div className="mt-3 text-sm text-gray-600 line-clamp-3">
																{report.incident_description}
															</div>
														)}
													</div>
												))}
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
											<Button onClick={() => setOpen(true)}>
												<Plus className="h-4 w-4 mr-2" />
												Add Service
											</Button>
										</div>

										{supportServices.length > 0 ? (
											<div className="space-y-3">
												{supportServices.map((service) => (
													<div
														key={service.id}
														className="flex items-center justify-between rounded-lg p-4 bg-card border"
													>
														<div className="space-y-1">
															<h4 className="font-medium">{service.name}</h4>
															<div className="flex items-center gap-2 text-sm text-gray-500">
																<span className="px-2 py-0.5 rounded-full bg-secondary">
																	{formatServiceName(service.service_types)}
																</span>
																{service.phone_number && <span>📞 {service.phone_number}</span>}
															</div>
															{service.availability && (
																<p className="text-sm text-gray-500">
																	🕒 {service.availability}
																</p>
															)}
														</div>

														<Button
															variant="ghost"
															size="icon"
															className="text-destructive hover:text-destructive hover:bg-destructive/10"
															onClick={() => setDeleteServiceId(service.id)}
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
							<div className="space-y-8">
								<UpcomingAppointments />
								<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
									<CommunityCard />
									<div className="hidden md:block">
										<DailyProgress />
									</div>
								</div>
							</div>
						</div>

						<div className="hidden md:block w-[350px] space-y-6 sticky top-6 self-start">
							<ConditionCheckCard />
							<JoinCommunity />
						</div>
					</div>
				</div>
			</main>

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

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="sm:max-w-2xl">
					<DialogHeader>
						<DialogTitle>Add Support Service</DialogTitle>
						<DialogDescription>
							Tell us about your support service. Fill in the details below to register
							your service.
						</DialogDescription>
					</DialogHeader>
					<AddSupportServiceForm
						onSuccess={() => {
							setOpen(false);
							// Refresh the services list
							fetchUserSupportServices(userId).then(setSupportServices);
						}}
					/>
				</DialogContent>
			</Dialog>
		</div>
	);
}
