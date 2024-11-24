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
import CaseCard from "@/app/components/CaseCard";

// Add this interface to type the joined data
interface ReportWithRelations extends Tables<"reports"> {
	matched_services?: Array<{
		id: string;
		match_status_type: Database["public"]["Enums"]["match_status_type"];
		support_services: {
			name: string;
			service_types: Database["public"]["Enums"]["support_service_type"];
		};
		appointments?: Array<{
			date: string;
			status: Database["public"]["Enums"]["appointment_status_type"] | null;
		}>;
	}>;
}

export default function SurvivorView({ userId }: { userId: string }) {
	const [reports, setReports] = useState<ReportWithRelations[]>([]);
	const [open, setOpen] = useState(false);
	const supabase = createClient();
	const { toast } = useToast();
	const [deleteReport, setDeleteReport] = useState<string | null>(null);

	// Move fetchReports outside useEffect so it can be called from handlers
	const fetchReports = async () => {
		const { data } = await supabase
			.from("reports")
			.select(
				`
				*,
				matched_services(
					id,
					match_status_type,
					support_services(
						name,
						service_types
					),
					appointments(
						date,
						status
					)
				)
			`
			)
			.eq("user_id", userId)
			.order("submission_timestamp", { ascending: false });

		if (data) {
			setReports(data);
		}
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

		// Subscribe to real-time changes
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
				() => {
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
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<h2 className="text-2xl font-bold">Your Reports</h2>
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
								Please fill out this form to report an incident. All information will be
								kept confidential.
							</DialogDescription>
						</DialogHeader>
						<AuthenticatedReportAbuseForm
							onClose={() => setOpen(false)}
							userId={userId}
						/>
					</DialogContent>
				</Dialog>
			</div>

			{reports && reports.length > 0 ? (
				<div className="grid gap-4">
					{reports.map((report) => (
						<CaseCard
							variant="survivor"
							key={report.report_id}
							reportId={report.report_id}
							timestamp={report.submission_timestamp}
							typeOfIncident={report.type_of_incident}
							description={report.incident_description}
							requiredServices={
								report.required_services as
									| Database["public"]["Enums"]["support_service_type"][]
									| null
							}
							onDelete={(reportId) => setDeleteReport(reportId)}
							matchStatus={report.match_status}
							matchedService={
								report.matched_services?.[0]
									? {
											support_service: {
												name: report.matched_services[0].support_services.name,
												service_types:
													report.matched_services[0].support_services.service_types,
											},
											appointment: report.matched_services[0].appointments?.[0]
												? {
														date: report.matched_services[0].appointments[0].date,
														status: report.matched_services[0].appointments[0].status,
												  }
												: undefined,
									  }
									: undefined
							}
							formatServiceName={formatServiceName}
						/>
					))}
				</div>
			) : (
				<p className="text-muted-foreground">No reports found.</p>
			)}

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
