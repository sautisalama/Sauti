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
import { AppointmentsTab } from "../_components/tabs/AppointmentsTab";

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
	}, [userId, toast]);

	return (
		<div className="flex min-h-screen bg-white">
			<main className="flex-1 w-full">
				<div className="p-4 md:p-6 mt-14 md:mt-0 mb-20 md:mb-0">
					<WelcomeHeader profileDetails={profileDetails} />

					<div className="flex flex-col md:flex-row gap-6">
						<div className="flex-1">
							<Tabs defaultValue="overview" className="mb-8">
								<TabsList className="w-full overflow-x-auto flex whitespace-nowrap">
									<TabsTrigger value="overview">Overview</TabsTrigger>
									<TabsTrigger value="reports">Reports</TabsTrigger>
									<TabsTrigger value="matched-cases">Cases</TabsTrigger>
									<TabsTrigger value="support-services">Services</TabsTrigger>
									<TabsTrigger value="appointments">Appointments</TabsTrigger>
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
									<AppointmentsTab
										userId={userId}
										userType="professional"
										username={profileDetails.first_name || userId}
										onAppointmentsChange={async () => {
											const updatedMatches = await fetchMatchedServices(userId);
											setMatchedServices(updatedMatches);
										}}
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
