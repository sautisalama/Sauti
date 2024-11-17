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
import { Plus } from "lucide-react";
import { useState, useEffect } from "react";

export default function SurvivorView({ userId }: { userId: string }) {
	const [reports, setReports] = useState<Tables<"reports">[]>([]);
	const [open, setOpen] = useState(false);
	const supabase = createClient();

	useEffect(() => {
		async function fetchReports() {
			const { data } = await supabase
				.from("reports")
				.select("*")
				.eq("user_id", userId);

			if (data) {
				setReports(data);
			}
		}

		fetchReports();
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
						<ReportAbuseForm onClose={() => setOpen(false)} />
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
								<span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
									{report.type_of_incident}
								</span>
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
		</div>
	);
}
