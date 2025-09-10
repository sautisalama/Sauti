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
import { SafetyPlanCard } from "@/components/SafetyPlanCard";
import { StatCard } from "@/components/dashboard/StatCard";
import { QuickActions } from "@/components/dashboard/QuickActions";
import { SectionHeader } from "@/components/dashboard/SectionHeader";
import { ClipboardList, Users, CalendarDays, MessageCircle, PlusCircle } from "lucide-react";
import Link from "next/link";

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

					{/* KPI Row */}
					<div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
						<StatCard title="Reports" value={reports.length} icon={<ClipboardList className="h-6 w-6" />} className="bg-[#0f766e]" invertColors />
						<StatCard title="Services" value={supportServices.length} icon={<Users className="h-6 w-6" />} className="bg-[#2563eb]" invertColors />
						<StatCard title="Matches" value={matchedServices.length} icon={<MessageCircle className="h-6 w-6" />} className="bg-[#9333ea]" invertColors />
						<StatCard title="Appointments" value={"–"} icon={<CalendarDays className="h-6 w-6" />} className="bg-[#f59e0b]" invertColors />
					</div>

					{/* Quick Actions */}
					<div className="my-4">
						<QuickActions
							actions={[
								{ label: "Add Service", description: "Register a service", href: "#support-services", icon: PlusCircle },
								{ label: "Messages", description: "Open chat", href: "/dashboard/chat", icon: MessageCircle },
								{ label: "Schedule", description: "Manage appointments", href: "#appointments", icon: CalendarDays },
								{ label: "Reports", description: "View cases", href: "#reports", icon: ClipboardList },
							]}
						/>
					</div>

					{/* Quick Agenda + Queues */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4 my-4">
						<div className="rounded-xl border p-4 bg-white shadow-sm">
							<p className="text-sm text-neutral-600 mb-2">Today’s Agenda</p>
							<div className="space-y-2 text-sm">
								<div className="flex items-center justify-between">
									<span>10:00 • Intake call</span>
									<Link href="/dashboard?tab=appointments" className="text-sauti-orange">Open</Link>
								</div>
								<div className="flex items-center justify-between">
									<span>14:00 • Follow-up</span>
									<Link href="/dashboard?tab=appointments" className="text-sauti-orange">Open</Link>
								</div>
							</div>
						</div>
						<div className="rounded-xl border p-4 bg-white shadow-sm">
							<p className="text-sm text-neutral-600 mb-2">Queues</p>
							<div className="grid grid-cols-3 gap-2 text-sm">
								<div className="rounded-lg bg-[#FFF5F5] p-3 text-center">
									<p className="text-xs text-neutral-500">High</p>
									<p className="text-lg font-semibold">2</p>
								</div>
								<div className="rounded-lg bg-[#FFF8F0] p-3 text-center">
									<p className="text-xs text-neutral-500">Medium</p>
									<p className="text-lg font-semibold">5</p>
								</div>
								<div className="rounded-lg bg-[#F0F9FF] p-3 text-center">
									<p className="text-xs text-neutral-500">Low</p>
									<p className="text-lg font-semibold">9</p>
								</div>
							</div>
						</div>
						<div className="rounded-xl border p-4 bg-white shadow-sm">
							<p className="text-sm text-neutral-600 mb-2">Quick Chat</p>
							<p className="text-sm mb-2">Open your messages to coordinate care.</p>
							<Link href="/dashboard/chat" className="text-sauti-orange">Open chat →</Link>
						</div>
					</div>

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
							<SafetyPlanCard userId={userId} />
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
