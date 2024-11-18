"use client";

import { createClient } from "@/utils/supabase/client";
import { Tables } from "@/types/db-schema";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import ReportAbuseForm from "@/components/ReportAbuseForm";
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

export default function SurvivorView({ userId }: { userId: string }) {
	const [reports, setReports] = useState<Tables<"reports">[]>([]);
	const [open, setOpen] = useState(false);
	const supabase = createClient();
	const { toast } = useToast();
	const [deleteReport, setDeleteReport] = useState<string | null>(null);

	// Move fetchReports outside useEffect so it can be called from handlers
	const fetchReports = async () => {
		const { data } = await supabase
			.from("reports")
			.select("*")
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
						<div
							key={report.report_id}
							className="bg-card p-4 rounded-lg border shadow-sm"
						>
							<div className="flex justify-between items-start">
								<div>
									<h3 className="font-semibold">Case #{report.report_id.slice(0, 8)}</h3>
									<p className="text-sm text-muted-foreground">
										{report.submission_timestamp &&
											new Date(report.submission_timestamp).toLocaleDateString()}
									</p>
								</div>
								<div className="flex items-center gap-2">
									<span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
										{report.type_of_incident}
									</span>
									<Button
										variant="ghost"
										size="icon"
										className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
										onClick={() => setDeleteReport(report.report_id)}
									>
										<Trash2 className="h-4 w-4" />
									</Button>
								</div>
							</div>
							<p className="mt-2 text-sm line-clamp-2">
								{report.incident_description}
							</p>
						</div>
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
