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
	Lock, ExternalLink, Activity, Info,
	Heart, ShieldCheck, HandHeart, Sparkles ,Calendar, User
} from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import AuthenticatedReportAbuseForm from "@/components/AuthenticatedReportAbuseForm";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import Link from "next/link";
import { UpgradeAccountBanner } from "../_components/UpgradeAccountBanner";

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

	const getStatusStyles = (status: string | null) => {
		switch (status?.toLowerCase()) {
			case 'matched': return 'bg-teal-50 text-teal-700 border-teal-100';
			case 'pending': return 'bg-sky-50 text-sky-700 border-sky-100';
			case 'investigating': return 'bg-indigo-50 text-indigo-700 border-indigo-100';
			default: return 'bg-slate-50 text-slate-500 border-slate-100';
		}
	};

	return (
		<>
			<div className="max-w-7xl mx-auto p-4 lg:p-6 lg:py-12">
				{/* Header Section */}
				<div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-16">
					<div className="space-y-4">
						<div className="flex items-center gap-2.5 text-teal-600 font-bold uppercase tracking-[0.2em] text-[10px]">
							<ShieldCheck className="h-4 w-4" />
							Secure Private Session
						</div>
						<h1 className="text-4xl md:text-5xl font-bold text-slate-900 tracking-tight">
							Your Support Space
						</h1>
						<p className="text-slate-500 font-medium max-w-xl text-lg leading-relaxed">
							{reports.length === 1 
								? "Your incident has been securely recorded. We are here to support you as you take your next steps."
								: "Welcome back. Here you can track your journey, manage your reports, and connect with caring professionals."
							}
						</p>
					</div>
					<Button 
						onClick={() => setOpen(true)}
						className="bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl px-10 h-14 shadow-md transition-all text-lg"
					>
						<Plus className="h-6 w-6 mr-2" />
						Share New Incident
					</Button>
				</div>



				{/* Upgrade Banner */}
				<UpgradeAccountBanner userEmail={profileDetails.email || ""} userId={userId} />

				<div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
					{/* Main Column: Reports */}
					<div className="lg:col-span-8 space-y-10">
						<div className="space-y-6">
							<div className="flex items-center justify-between px-2">
								<h2 className="text-xl font-bold text-slate-800 flex items-center gap-3">
									<Activity className="h-5 w-5 text-teal-500" />
									Active Support Journeys
								</h2>
								<span className="text-[10px] font-bold text-slate-400 bg-white border border-slate-100 px-3 py-1 rounded-full shadow-sm">
									{reports.length} Records found
								</span>
							</div>

							{reports.length > 0 ? (
								<div className="grid grid-cols-1 gap-6">
									{reports.map((report) => (
										<Link 
											href={`/dashboard/reports/${report.report_id}`} 
											key={report.report_id}
											className="block group"
										>
											<Card className="border-slate-100 bg-white shadow-sm hover:shadow-xl hover:border-teal-100/50 transition-all duration-500 rounded-[2.5rem] overflow-hidden">
												<CardContent className="p-0">
													<div className="p-8 md:p-10">
														<div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
															<div className="space-y-2">
																<div className="flex items-center gap-3">
																	<div className={cn(
																		"w-2 h-2 rounded-full",
																		report.urgency === 'high' ? 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 
																		report.urgency === 'medium' ? 'bg-amber-400' : 'bg-emerald-400'
																	)} />
																	<h3 className="text-2xl font-bold text-slate-900 capitalize group-hover:text-teal-600 transition-colors">
																		{report.type_of_incident?.replace(/_/g, " ")} Incident
																	</h3>
																</div>
																<p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest pl-5">
																	Reference: SS-{report.report_id.slice(0, 8).toUpperCase()}
																</p>
															</div>
															<div className={cn(
																"px-4 py-1.5 rounded-full text-[10px] font-bold border uppercase tracking-[0.25em] self-start sm:self-center",
																getStatusStyles(report.match_status)
															)}>
																{report.match_status || 'Pending Review'}
															</div>
														</div>
														
														<p className="text-slate-500 font-medium line-clamp-2 mb-8 text-base leading-relaxed">
															{report.incident_description || "No narrative details shared for this record."}
														</p>

														<div className="flex flex-col sm:flex-row items-center justify-between pt-8 border-t border-slate-50 gap-6">
															<div className="flex items-center gap-8 w-full sm:w-auto">
																<div className="text-[11px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
																	<Calendar className="h-3.5 w-3.5" />
																	{new Date(report.submission_timestamp!).toLocaleDateString()}
																</div>
																
																{report.matched_services && report.matched_services.length > 0 && (
																	<div className="flex items-center gap-3">
																		<div className="flex items-center -space-x-2">
																			{report.matched_services.slice(0, 3).map((_, i) => (
																				<div key={i} className="w-7 h-7 rounded-full bg-teal-50 border-2 border-white flex items-center justify-center shadow-sm">
																					<Heart className="h-3 w-3 text-teal-500 fill-teal-500" />
																				</div>
																			))}
																		</div>
																		<span className="text-[10px] font-bold text-teal-600 uppercase tracking-widest bg-teal-50 px-3 py-1 rounded-full">
																			{report.matched_services.length} Partners Ready
																		</span>
																	</div>
																)}
															</div>
															
															<div className="flex items-center gap-2 text-teal-600 font-bold text-sm group-hover:gap-4 transition-all w-full sm:w-auto justify-end">
																Visit Journey Space
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
								<Card className="border-2 border-dashed border-slate-200 rounded-[3rem] p-16 text-center bg-white/50">
									<div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
										<HandHeart className="h-10 w-10 text-slate-200" />
									</div>
									<h3 className="text-2xl font-bold text-slate-400">Your Support List is Empty</h3>
									<p className="text-slate-400 font-medium max-w-sm mx-auto mt-3 leading-relaxed">
										When you're ready to share an incident, you'll find it here. We'll help you find the right support every step of the way.
									</p>
								</Card>
							)}
						</div>
					</div>

					{/* Sidebar */}
					<div className="lg:col-span-4 space-y-8">
						{/* Anonymity Notice */}


						{/* Supportive Tips / Help */}
						<div className="space-y-4">
							<div className="p-8 bg-white border border-slate-100 rounded-[2rem] shadow-sm space-y-4">
								<div className="flex items-center gap-3 text-teal-600">
									<Sparkles className="h-5 w-5" />
									<h4 className="font-bold text-slate-800">Did you know?</h4>
								</div>
								<p className="text-sm text-slate-500 leading-relaxed font-medium">
									You can add more details to any report at any time. This helps specialists provide better-targeted support for you.
								</p>
							</div>

							<Link href="/dashboard/chat" className="flex items-center justify-between p-6 bg-teal-50 hover:bg-teal-100 transition-all rounded-[2rem] group border border-teal-100 shadow-sm">
								<div className="flex items-center gap-4">
									<div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm">
										<MessageCircle className="h-5 w-5 text-teal-600 group-hover:scale-110 transition-transform" />
									</div>
									<span className="text-sm font-bold text-teal-900">Secure Community Chat</span>
								</div>
								<ArrowRight className="h-4 w-4 text-teal-400 group-hover:translate-x-1 transition-transform" />
							</Link>
						</div>
					</div>
				</div>
			</div>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-0 rounded-[3rem] shadow-2xl bg-white">
					<div className="p-10 md:p-12">
						<DialogHeader className="mb-10">
							<div className="flex items-center gap-4 mb-3">
								<HandHeart className="h-8 w-8 text-teal-600" />
								<DialogTitle className="text-4xl font-bold text-slate-900 tracking-tight">Share an Incident</DialogTitle>
							</div>
							<DialogDescription className="text-lg text-slate-500 font-medium">
								We are here to help. Please share what you're comfortable with, and we'll connect you to specialized support.
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
		</>
	);
}
