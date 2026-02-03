"use client";

import { createClient } from "@/utils/supabase/client";
import { Database, Tables } from "@/types/db-schema";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { 
	Plus, Shield, MessageCircle, ArrowRight, 
	Lock, ExternalLink, Activity, Info 
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import AuthenticatedReportAbuseForm from "@/components/AuthenticatedReportAbuseForm";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import Link from "next/link";

interface ReportWithRelations extends Tables<"reports"> {
	matched_services?: any[];
}

interface AnonymousSurvivorViewProps {
	userId: string;
	profileDetails: Tables<"profiles">;
}

export default function AnonymousSurvivorView({
	userId,
	profileDetails,
}: AnonymousSurvivorViewProps) {
	const dash = useDashboardData();
	const [reports, setReports] = useState<ReportWithRelations[]>([]);
	const [open, setOpen] = useState(false);
	const { toast } = useToast();
	const supabase = useMemo(() => createClient(), []);

	const fetchReports = useCallback(async () => {
		const { data, error } = await supabase
			.from("reports")
			.select("*, matched_services(id, match_status_type, match_date, match_score, support_services(id, name, service_types))")
			.eq("user_id", userId)
			.order("submission_timestamp", { ascending: false });

		if (!error && data) {
			setReports(data as any);
		}
	}, [userId, supabase]);

	useEffect(() => {
		fetchReports();
	}, [fetchReports]);

	const getStatusColor = (status: string | null) => {
		switch (status?.toLowerCase()) {
			case 'matched': return 'bg-emerald-100 text-emerald-700 border-emerald-200';
			case 'pending': return 'bg-amber-100 text-amber-700 border-amber-200';
			case 'investigating': return 'bg-blue-100 text-blue-700 border-blue-200';
			default: return 'bg-neutral-100 text-neutral-600 border-neutral-200';
		}
	};

	return (
		<div className="min-h-screen bg-white">
			<div className="max-w-6xl mx-auto px-6 py-12">
				{/* Header Section */}
				<div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
					<div className="space-y-2">
						<div className="flex items-center gap-2 text-neutral-400 font-bold uppercase tracking-widest text-[10px]">
							<Shield className="h-3 w-3" />
							Secure Anonymous Session
						</div>
						<h1 className="text-4xl font-black text-sauti-dark tracking-tight">
							My Cases
						</h1>
						<p className="text-neutral-500 font-medium max-w-xl">
							Track the status of your reported incidents and view matched professional support services.
						</p>
					</div>
					<Button 
						onClick={() => setOpen(true)}
						className="bg-sauti-dark hover:bg-black text-white font-black rounded-2xl px-8 h-12 shadow-lg transition-all"
					>
						<Plus className="h-5 w-5 mr-2" />
						Report New Incident
					</Button>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
					{/* Main Column: Incidents */}
					<div className="lg:col-span-8 space-y-8">
						<div className="space-y-4">
							<div className="flex items-center justify-between px-2">
								<h2 className="text-lg font-black text-sauti-dark">Active Reports</h2>
								<span className="text-xs font-bold text-neutral-400 bg-neutral-100 px-3 py-1 rounded-full">
									{reports.length} Reports
								</span>
							</div>

							{reports.length > 0 ? (
								<div className="grid grid-cols-1 gap-4">
									{reports.map((report) => (
										<Link 
											href={`/dashboard/reports/${report.report_id}`} 
											key={report.report_id}
											className="block"
										>
											<Card className="border border-neutral-100 shadow-sm hover:shadow-md hover:border-neutral-200 transition-all duration-300 rounded-[2rem] overflow-hidden group">
												<CardContent className="p-0">
													<div className="p-6 md:p-8">
														<div className="flex items-start justify-between mb-4">
															<div className="flex items-center gap-3">
																<div className={cn(
																	"w-3 h-3 rounded-full mt-1",
																	report.urgency === 'high' ? 'bg-sauti-red animate-pulse' : 
																	report.urgency === 'medium' ? 'bg-amber-400' : 'bg-emerald-400'
																)} />
																<h3 className="text-xl font-black text-sauti-dark capitalize">
																	{report.type_of_incident?.replace(/_/g, " ")}
																</h3>
															</div>
															<div className={cn(
																"px-4 py-1.5 rounded-full text-xs font-black border uppercase tracking-wider",
																getStatusColor(report.match_status)
															)}>
																{report.match_status || 'Pending'}
															</div>
														</div>
														
														<p className="text-neutral-500 font-medium line-clamp-2 mb-6 text-sm leading-relaxed">
															{report.incident_description || "No description provided."}
														</p>

														<div className="flex items-center justify-between pt-6 border-t border-neutral-50">
															<div className="flex items-center gap-6">
																<div className="text-[10px] font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5">
																	<Activity className="h-3 w-3" />
																	ID: SS-{report.report_id.slice(0, 4)}
																</div>
																{report.matched_services && report.matched_services.length > 0 && (
																	<div className="flex items-center -space-x-2">
																		{report.matched_services.slice(0, 3).map((_, i) => (
																			<div key={i} className="w-6 h-6 rounded-full bg-sauti-teal/10 border-2 border-white flex items-center justify-center">
																				<Shield className="h-3 w-3 text-sauti-teal" />
																			</div>
																		))}
																		<span className="ml-4 text-[10px] font-black text-sauti-teal uppercase tracking-widest">
																			{report.matched_services.length} Matches Found
																		</span>
																	</div>
																)}
															</div>
															<div className="flex items-center gap-2 text-sauti-teal font-black text-xs group-hover:gap-3 transition-all">
																Manage Case
																<ArrowRight className="h-4 w-4" />
															</div>
														</div>
													</div>
												</CardContent>
											</Card>
										</Link>
									))}
								</div>
							) : (
								<Card className="border-2 border-dashed border-neutral-100 rounded-[3rem] p-12 text-center bg-neutral-50/30">
									<Activity className="h-12 w-12 text-neutral-200 mx-auto mb-4" />
									<h3 className="text-xl font-black text-neutral-400">No Incidents Reported</h3>
									<p className="text-neutral-400 font-medium max-w-xs mx-auto mt-2">
										Your report history is empty. Use the "Report New Incident" button to start receiving support.
									</p>
								</Card>
							)}
						</div>
					</div>

					{/* Sidebar */}
					<div className="lg:col-span-4 space-y-6">
						{/* Anonymity Notice */}
						<Card className="bg-neutral-900 border-0 rounded-[2.5rem] shadow-xl overflow-hidden relative">
							<div className="absolute top-0 right-0 p-8 opacity-10">
								<Lock className="h-24 w-24 text-white" />
							</div>
							<CardContent className="p-8 relative z-10">
								<div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center mb-6">
									<Shield className="h-6 w-6 text-white" />
								</div>
								<h3 className="text-xl font-black text-white mb-2">Anonymous Account</h3>
								<p className="text-neutral-400 font-medium text-sm leading-relaxed mb-6">
									You are currently using a temporary, anonymous account. Your identity is fully protected.
								</p>
								<div className="space-y-4">
									<div className="bg-white/5 rounded-2xl p-4 border border-white/10">
										<p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest mb-1">Assigned Username</p>
										<p className="text-white font-mono text-sm uppercase">@{profileDetails.anon_username || "anonymous"}</p>
									</div>
									<Button asChild variant="link" className="text-sauti-teal p-0 h-auto font-black text-sm">
										<Link href="/dashboard/settings" className="flex items-center gap-2">
											Link to permanent account
											<ExternalLink className="h-3 w-3" />
										</Link>
									</Button>
								</div>
							</CardContent>
						</Card>

						{/* Quick Link Real Account */}
						<Alert className="border-neutral-100 rounded-[2rem] p-6 bg-white shadow-sm">
							<Info className="h-5 w-5 text-sauti-teal" />
							<AlertTitle className="text-sm font-black text-sauti-dark ml-2">Secure Link</AlertTitle>
							<AlertDescription className="text-xs text-neutral-500 font-medium leading-relaxed mt-2 ml-2">
								Want to keep this case history forever? Update your email address in settings to convert this to a permanent account.
							</AlertDescription>
						</Alert>

						{/* Need Help? */}
						<div className="p-2 space-y-3">
							<Link href="/dashboard/chat" className="flex items-center justify-between p-4 bg-neutral-50 hover:bg-neutral-100 transition-colors rounded-2xl group">
								<div className="flex items-center gap-3">
									<MessageCircle className="h-5 w-5 text-neutral-400 group-hover:text-sauti-teal transition-colors" />
									<span className="text-sm font-black text-neutral-600">Secure Chat</span>
								</div>
								<ArrowRight className="h-4 w-4 text-neutral-300" />
							</Link>
						</div>
					</div>
				</div>
			</div>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-0 rounded-[2rem] shadow-2xl">
					<div className="p-8">
						<DialogHeader className="mb-8">
							<DialogTitle className="text-3xl font-black text-sauti-dark tracking-tight">Create Secure Report</DialogTitle>
							<DialogDescription className="text-neutral-500 font-medium">
								Detailed information helps us match you with the best support services.
							</DialogDescription>
						</DialogHeader>
						<AuthenticatedReportAbuseForm 
							onClose={() => {
								setOpen(false);
								fetchReports();
							}} 
							userId={userId}
						/>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}
