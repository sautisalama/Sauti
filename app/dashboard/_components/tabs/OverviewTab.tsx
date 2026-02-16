import { Tables } from "@/types/db-schema";
import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface MatchedServiceWithRelations {
	id: string;
	match_date: string;
	match_status_type: string;
	report: Tables<"reports">;
	service_details: Tables<"support_services">;
}

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
						<h2 className="text-xl font-black text-sauti-dark tracking-tight">Recent Reports</h2>
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
														className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
															report.urgency === "high"
																? "bg-sauti-red/10 text-sauti-red"
																: report.urgency === "medium"
																? "bg-sauti-yellow/20 text-sauti-yellow-dark"
																: "bg-sauti-teal/10 text-sauti-teal"
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
													{acceptedMatch.service_details.name}
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
					<h2 className="text-xl font-black text-sauti-dark tracking-tight">
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
								className={`rounded-2xl p-5 shadow-sm border-0 relative overflow-hidden transition-all duration-300 hover:shadow-md ${
									matchedCase.report.urgency === "high"
										? "bg-sauti-red-light"
										: matchedCase.report.urgency === "medium"
										? "bg-sauti-yellow-light"
										: "bg-sauti-teal-light"
								}`}
							>
                {/* Bottom Accent Line */}
                <div className={cn(
                  "absolute bottom-0 left-0 right-0 h-1.5",
                  matchedCase.report.urgency === "high" ? "bg-sauti-red" : matchedCase.report.urgency === "medium" ? "bg-sauti-yellow" : "bg-sauti-teal"
                )} />
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
											<p className="font-medium">{matchedCase.service_details.name}</p>
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
					<h2 className="text-xl font-black text-sauti-dark tracking-tight">
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
								className="p-5 rounded-2xl border-0 bg-sauti-teal-light shadow-sm relative overflow-hidden group hover:shadow-md transition-all duration-300"
							>
                <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-sauti-teal/40" />
								<div className="space-y-3 relative z-10">
									<h3 className="font-black text-sauti-dark tracking-tight">{service.name}</h3>
									<div className="flex flex-wrap gap-2">
										{service.service_types.split(",").map((type, index) => (
											<span
												key={index}
												className="px-3 py-1 text-[10px] font-black uppercase tracking-wider rounded-full bg-white text-sauti-teal shadow-sm"
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
