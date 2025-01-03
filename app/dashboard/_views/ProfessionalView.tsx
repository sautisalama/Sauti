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
import { useToast } from "@/hooks/use-toast";
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
import { DailyProgress } from "@/app/components/DailyProgress";
import { fetchMatchedServices } from "./actions/matched-services";
import { useState, useEffect } from "react";
import { OverviewTab } from "../_components/tabs/OverviewTab";
import { ReportsTab } from "../_components/tabs/ReportsTab";
import { SupportServicesTab } from "../_components/tabs/SupportServicesTab";
import { ReportWithRelations, MatchedServiceWithRelations } from "../_types";
import { MatchCard } from "../_components/MatchCard";
import { MatchedCasesTab } from "../_components/tabs/MatchedCasesTab";

interface ProfessionalViewProps {
	userId: string;
	profileDetails: Tables<"profiles">;
}

export default function ProfessionalView({
	userId,
	profileDetails,
}: ProfessionalViewProps) {
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

	useEffect(() => {
		const loadData = async () => {
			try {
				const [userReports, userServices, userMatches] = await Promise.all([
					fetchUserReports(userId),
					fetchUserSupportServices(userId),
					fetchMatchedServices(userId),
				]);

				setReports(userReports as ReportWithRelations[]);
				setSupportServices(userServices);
				setMatchedServices(userMatches);
			} catch (error) {
				toast({
					title: "Error",
					description: "Failed to load data. Please try again.",
					variant: "destructive",
				});
			}
		};

		loadData();

		// Set up real-time subscriptions
		const supabase = createClient();

		// Subscribe to reports changes
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
					setReports(updatedReports as ReportWithRelations[]);
				}
			)
			.subscribe();

		// Subscribe to support services changes
		const servicesChannel = supabase
			.channel("services-changes")
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

		// Subscribe to matched services changes
		const matchesChannel = supabase
			.channel("matched-services-changes")
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "matched_services",
					filter: `service_id=in.(${supportServices.map((s) => s.id).join(",")})`,
				},
				async () => {
					const updatedMatches = await fetchMatchedServices(userId);
					setMatchedServices(updatedMatches);
				}
			)
			.subscribe();

		// Subscribe to appointments changes
		const appointmentsChannel = supabase
			.channel("appointments-changes")
			.on(
				"postgres_changes",
				{
					event: "*",
					schema: "public",
					table: "appointments",
					filter: `professional_id=eq.${userId}`,
				},
				async () => {
					const [updatedMatches, updatedReports] = await Promise.all([
						fetchMatchedServices(userId),
						fetchUserReports(userId),
					]);
					setMatchedServices(updatedMatches);
					setReports(updatedReports as ReportWithRelations[]);
				}
			)
			.subscribe();

		// Cleanup subscriptions
		return () => {
			supabase.removeChannel(reportsChannel);
			supabase.removeChannel(servicesChannel);
			supabase.removeChannel(matchesChannel);
			supabase.removeChannel(appointmentsChannel);
		};
	}, [userId, supportServices, toast]);

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
									/>
								</TabsContent>

								<TabsContent value="matched-cases">
									<MatchedCasesTab
										matchedServices={matchedServices}
										onRefresh={() => fetchMatchedServices(userId).then(setMatchedServices)}
									/>
								</TabsContent>

								<TabsContent value="support-services">
									<SupportServicesTab
										supportServices={supportServices}
											formatServiceName={formatServiceName}
											onDeleteService={setDeleteServiceId}
											open={open}
											setOpen={setOpen}
											userId={userId}
											setSupportServices={setSupportServices}
									/>
								</TabsContent>
							</Tabs>

							<div className="space-y-8">
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
		</div>
	);
}
