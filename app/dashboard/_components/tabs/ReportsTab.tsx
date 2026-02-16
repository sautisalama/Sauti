import { Tables } from "@/types/db-schema";
import { Button } from "@/components/ui/button";
import { Plus, Trash2, Download, Calendar, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
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
		service_details: Tables<"support_services">;
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
					<h2 className="text-xl font-black text-sauti-dark tracking-tight">My Reports</h2>
					<p className="text-sm text-gray-500">
						{reports.length} {reports.length === 1 ? "report" : "reports"} found
					</p>
				</div>
				<Dialog open={reportDialogOpen} onOpenChange={setReportDialogOpen}>
					<DialogTrigger asChild>
						<Button className="bg-sauti-teal hover:bg-sauti-dark text-white font-bold rounded-full px-6 transition-all duration-300 shadow-md hover:shadow-lg">
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
								className={`flex flex-col rounded-2xl p-5 shadow-sm border-0 relative overflow-hidden transition-all duration-300 hover:shadow-md ${
									report.urgency === "high"
										? "bg-sauti-red-light"
										: report.urgency === "medium"
										? "bg-sauti-yellow-light"
										: "bg-sauti-teal-light"
								}`}
							>
                {/* Bottom Accent Line */}
                <div className={cn(
                  "absolute bottom-0 left-0 right-0 h-1.5",
                  report.urgency === "high" ? "bg-sauti-red" : report.urgency === "medium" ? "bg-sauti-yellow" : "bg-sauti-teal"
                )} />
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-3">
										<div className="h-10 w-10 rounded-xl bg-sauti-dark text-white flex items-center justify-center font-black">
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
													className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm ${
														report.urgency === "high"
															? "bg-sauti-red text-white"
															: report.urgency === "medium"
															? "bg-sauti-yellow text-sauti-dark"
															: "bg-sauti-teal text-white"
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
										<div className="bg-white/80 rounded-xl p-4 border border-sauti-teal/20 shadow-sm">
											<div className="flex items-center justify-between">
												<div className="flex-1">
													<span className="text-sm font-black text-sauti-teal">
														✅ Accepted by: {acceptedMatch.service_details.name}
													</span>
													{appointment && (
														<div className="flex items-center gap-2 mt-2">
															<div className="flex items-center gap-1 text-sm text-gray-600">
																<Calendar className="h-4 w-4" />
																{new Date(appointment.appointment_date).toLocaleDateString()}
																<Clock className="h-4 w-4 ml-2" />
																{new Date(appointment.appointment_date).toLocaleTimeString()}
															</div>
															<span className="px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
																{appointment.status}
															</span>
														</div>
													)}
												</div>
												{appointment && (
													<div className="flex gap-2">
														<Button
															variant="outline"
															size="sm"
															onClick={() =>
(window.location.href = "/dashboard/appointments")
															}
															className="text-xs"
														>
															View Appointment
														</Button>
													</div>
												)}
											</div>
										</div>
									)}

									{pendingMatches && pendingMatches.length > 0 && (
										<div className="bg-white/80 rounded-xl p-4 border border-sauti-yellow/30 shadow-sm">
											<span className="text-sm font-black text-sauti-yellow-dark">
												Pending Matches ({pendingMatches.length}):
											</span>
											<div className="mt-2 space-y-2">
												{pendingMatches.map((match, index) => (
													<div
														key={index}
														className="text-sm text-gray-600 flex items-center justify-between"
													>
														<span>{match.service_details.name}</span>
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
