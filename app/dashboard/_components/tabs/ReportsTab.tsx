import { Tables } from "@/types/db-schema";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Download } from "lucide-react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogTrigger,
} from "@/components/ui/dialog";
import AuthenticatedReportAbuseForm from "@/components/AuthenticatedReportAbuseForm";

interface ReportWithRelations extends Tables<"reports"> {
	matched_services?: {
		match_status_type: string;
		support_service: Tables<"support_services">;
		appointments?: {
			appointment_date: string;
			status: string;
		}[];
	}[];
}

interface ReportsTabProps {
	reports: ReportWithRelations[];
	onDeleteReport: (id: string) => void;
	formatServiceName: (service: string) => string;
	userId: string;
	reportDialogOpen: boolean;
	setReportDialogOpen: (open: boolean) => void;
	onRefresh: () => Promise<void>;
}

export function ReportsTab({
	reports,
	onDeleteReport,
	formatServiceName,
	userId,
	reportDialogOpen,
	setReportDialogOpen,
	onRefresh,
}: ReportsTabProps) {
	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center mb-6">
				<div>
					<h2 className="text-xl font-semibold text-[#1A3434]">My Reports</h2>
					<p className="text-sm text-gray-500">
						{reports.length} {reports.length === 1 ? "report" : "reports"} found
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
								Please fill out this form to report an incident. All information will be
								kept confidential.
							</DialogDescription>
						</DialogHeader>
						<AuthenticatedReportAbuseForm
							onClose={() => {
								setReportDialogOpen(false);
								onRefresh();
							}}
							userId={userId}
						/>
					</DialogContent>
				</Dialog>
			</div>

			{reports.length > 0 ? (
				<div className="space-y-3">
					{reports.map((report) => {
						const acceptedMatch = report.matched_services?.find(
							(match) => match.match_status_type === "accepted"
						);
						const pendingMatches = report.matched_services?.filter(
							(match) => match.match_status_type === "pending"
						);
						const appointment = acceptedMatch?.appointments?.[0];

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
												{formatServiceName(report.type_of_incident || "Unknown Incident")}
											</h4>
											<div className="flex items-center gap-2 text-sm text-gray-500">
												<span>
													{new Date(report.submission_timestamp || "").toLocaleDateString()}
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

									<div className="flex items-center gap-1">
										<Button
											variant="outline"
											size="icon"
											onClick={() => {
												const json = JSON.stringify(report, null, 2);
												const blob = new Blob([json], { type: "application/json" });
												const url = URL.createObjectURL(blob);
												const a = document.createElement("a");
												a.href = url;
												a.download = `report-${report.report_id}.json`;
												a.click();
												URL.revokeObjectURL(url);
											}}
										>
											<Download className="h-4 w-4" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											className="text-destructive hover:text-destructive hover:bg-destructive/10"
											onClick={() => onDeleteReport(report.report_id)}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>
								</div>

								{report.incident_description && (
									<div className="mt-3 text-sm text-gray-600">
										{report.incident_description}
									</div>
								)}

								<div className="mt-4 space-y-3">
									{acceptedMatch && (
										<div className="bg-white/50 rounded-md p-3 border border-green-200">
											<div className="flex items-center justify-between">
												<div>
													<span className="text-sm font-medium text-green-700">
														Accepted by: {acceptedMatch.support_service.name}
													</span>
													{appointment && (
														<div className="text-sm text-gray-600 mt-1">
															📅 Appointment:{" "}
															{new Date(appointment.appointment_date).toLocaleDateString()}
															<span className="ml-2 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
																{appointment.status}
															</span>
														</div>
													)}
												</div>
											</div>
										</div>
									)}

									{pendingMatches && pendingMatches.length > 0 && (
										<div className="bg-white/50 rounded-md p-3 border border-yellow-200">
											<span className="text-sm font-medium text-yellow-700">
												Pending Matches ({pendingMatches.length}):
											</span>
											<div className="mt-2 space-y-2">
												{pendingMatches.map((match, index) => (
													<div
														key={index}
														className="text-sm text-gray-600 flex items-center justify-between"
													>
														<span>{match.support_service.name}</span>
														<span className="px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">
															pending
														</span>
													</div>
												))}
											</div>
										</div>
									)}
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
	);
}
