import { Tables } from "@/types/db-schema";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";

interface MatchedServiceWithRelations {
	id: string;
	match_date: string;
	match_status_type: string;
	report: Tables<"reports">;
	support_service: Tables<"support_services">;
}

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

interface OverviewTabProps {
	reports: ReportWithRelations[];
	matchedServices: MatchedServiceWithRelations[];
	supportServices: Tables<"support_services">[];
	onDeleteReport: (id: string) => void;
	formatServiceName: (service: string) => string;
}

export function OverviewTab({
	reports,
	matchedServices,
	supportServices,
	onDeleteReport,
	formatServiceName,
}: OverviewTabProps) {
	return (
		<div className="space-y-8">
			{/* Recent Reports Section */}
			<div className="space-y-6">
				<div className="flex justify-between items-center">
					<div>
						<h2 className="text-xl font-semibold text-[#1A3434]">Recent Reports</h2>
						<p className="text-sm text-gray-500">
							{reports.length} {reports.length === 1 ? "report" : "reports"} found
						</p>
					</div>
				</div>

				{reports.length > 0 ? (
					<div className="space-y-3">
						{reports.slice(0, 3).map((report) => {
							const acceptedMatch = report.matched_services?.find(
								(match) => match.match_status_type === "accepted"
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

										<Button
											variant="ghost"
											size="icon"
											className="text-destructive hover:text-destructive hover:bg-destructive/10"
											onClick={() => onDeleteReport(report.report_id)}
										>
											<Trash2 className="h-4 w-4" />
										</Button>
									</div>

									{report.incident_description && (
										<div className="mt-3 text-sm text-gray-600 line-clamp-3">
											{report.incident_description}
										</div>
									)}

									{acceptedMatch && (
										<div className="mt-3 border-t pt-3">
											<div className="flex items-center justify-between text-sm">
												<div className="text-gray-600">
													<span className="font-medium">Accepted by:</span>{" "}
													{acceptedMatch.support_service.name}
												</div>
												{appointment?.appointment_date && (
													<div className="text-gray-600">
														<span className="font-medium">Appointment:</span>{" "}
														{new Date(appointment.appointment_date).toLocaleDateString()}
													</div>
												)}
											</div>
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

			{/* Recent Matched Cases Section */}
			<div className="space-y-6">
				<div>
					<h2 className="text-xl font-semibold text-[#1A3434]">
						Recent Matched Cases
					</h2>
					<p className="text-sm text-gray-500">
						{matchedServices.length} {matchedServices.length === 1 ? "case" : "cases"}{" "}
						matched
					</p>
				</div>

				{matchedServices.length > 0 ? (
					<div className="space-y-4">
						{matchedServices.slice(0, 3).map((matchedCase) => (
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
											{matchedCase.report.type_of_incident?.[0]?.toUpperCase() || "?"}
										</div>
										<div>
											<h4 className="font-medium">
												{matchedCase.report.type_of_incident
													? formatServiceName(matchedCase.report.type_of_incident)
													: "Unknown Incident"}
											</h4>
											<div className="flex items-center gap-2 text-sm text-gray-500">
												<span>
													Matched on{" "}
													{new Date(matchedCase.match_date || "").toLocaleDateString()}
												</span>
											</div>
										</div>
									</div>

									<div className="flex items-center gap-4">
										<div className="text-right">
											<p className="font-medium">{matchedCase.support_service.name}</p>
											<p className="text-sm text-gray-500">
												{matchedCase.match_status_type
													? formatServiceName(matchedCase.match_status_type)
													: "Unknown Status"}
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
	);
}
