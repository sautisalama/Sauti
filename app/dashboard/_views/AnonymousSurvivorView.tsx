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
import { Info, Plus, Shield, Megaphone, CalendarDays, MessageCircle, ArrowRight, Trash2, CheckCircle, Star } from "lucide-react";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import AuthenticatedReportAbuseForm from "@/components/AuthenticatedReportAbuseForm";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { WelcomeHeader, QuickActionCard, StatsCard, ActivityItem, SectionHeader } from "@/components/dashboard/DashboardComponents";
import { AnonymousCredentialsBanner } from "@/components/dashboard/AnonymousCredentialsBanner";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import Link from "next/link";

interface ReportWithRelations extends Tables<"reports"> {
	matched_services?: Array<{
		id: string;
		match_status_type: Database["public"]["Enums"]["match_status_type"];
		match_date: string | null;
		match_score: number | null;
		support_services: {
			id: string;
			name: string;
			service_types: Database["public"]["Enums"]["support_service_type"];
		};
	}>;
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
	const [reports, setReports] = useState<ReportWithRelations[]>(() => {
		const seeded = (dash?.data?.reports as any) || [];
		return seeded;
	});
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

	return (
		<div className="min-h-screen bg-neutral-50/50">
			<div className="max-w-7xl mx-auto p-4 lg:p-8">
				{/* Management Header */}
				<div className="mb-8">
					<h1 className="text-3xl font-black text-sauti-dark tracking-tight mb-2">
						Incident Management
					</h1>
					<p className="text-neutral-500 font-medium">
						Manage your reports and track support matches securely and anonymously.
					</p>
				</div>

				<AnonymousCredentialsBanner 
					username={profileDetails.anon_username ?? "Anonymous Survivor"} 
				/>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-8">
					{/* Left Column: Report List */}
					<div className="lg:col-span-2 space-y-6">
						<Card className="border-0 shadow-premium overflow-hidden rounded-3xl">
							<CardHeader className="bg-white border-b border-neutral-100 p-6">
								<div className="flex items-center justify-between">
									<div>
										<CardTitle className="text-xl font-black text-sauti-dark">My Reports</CardTitle>
										<p className="text-sm text-neutral-500 font-medium mt-1">{reports.length} active incidents</p>
									</div>
									<Button 
										onClick={() => setOpen(true)}
										className="bg-sauti-teal hover:bg-sauti-dark text-white font-black rounded-2xl px-6"
									>
										<Plus className="h-4 w-4 mr-2" />
										New Report
									</Button>
								</div>
							</CardHeader>
							<CardContent className="p-6 bg-white/50">
								{reports.length > 0 ? (
									<div className="space-y-4">
										{reports.map((report) => (
											<div 
												key={report.report_id}
												className="bg-white rounded-2xl p-5 shadow-sm border border-neutral-100 hover:border-sauti-teal/30 transition-all group relative overflow-hidden"
											>
												<div className={cn(
													"absolute left-0 top-0 bottom-0 w-1.5",
													report.urgency === 'high' ? 'bg-sauti-red' : report.urgency === 'medium' ? 'bg-sauti-yellow' : 'bg-sauti-teal'
												)} />
												
												<div className="flex items-start justify-between gap-4">
													<div className="flex-1">
														<div className="flex items-center gap-2 mb-2">
															<span className={cn(
																"px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider",
																report.urgency === 'high' ? 'bg-sauti-red/10 text-sauti-red' : 'bg-neutral-100 text-neutral-500'
															)}>
																{report.urgency} Priority
															</span>
															<span className="text-[10px] font-bold text-neutral-400">
																{new Date(report.submission_timestamp!).toLocaleDateString()}
															</span>
														</div>
														<h3 className="font-black text-sauti-dark text-lg capitalize">
															{report.type_of_incident?.replace(/_/g, " ")}
														</h3>
														<p className="text-sm text-neutral-600 line-clamp-2 mt-1 font-medium">
															{report.incident_description}
														</p>
													</div>
													<div className="text-right">
														<div className="bg-sauti-teal/5 rounded-xl p-3 border border-sauti-teal/10">
															<p className="text-[10px] font-black text-sauti-teal uppercase mb-1">Status</p>
															<p className="text-sm font-black text-sauti-dark capitalize">
																{report.match_status?.replace(/_/g, " ")}
															</p>
														</div>
													</div>
												</div>

												{report.matched_services && report.matched_services.length > 0 && (
													<div className="mt-4 pt-4 border-t border-neutral-50">
														<p className="text-xs font-black text-neutral-400 uppercase mb-3 px-1">Top Matches</p>
														<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
															{report.matched_services.slice(0, 2).map((match) => (
																<div key={match.id} className="flex items-center justify-between p-3 rounded-xl bg-neutral-50 border border-neutral-100">
																	<div className="flex items-center gap-2">
																		<div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shadow-sm">
																			<Shield className="h-4 w-4 text-sauti-teal" />
																		</div>
																		<p className="text-xs font-bold text-sauti-dark truncate max-w-[120px]">
																			{match.support_services.name}
																		</p>
																	</div>
																	<ArrowRight className="h-3 w-3 text-neutral-300" />
																</div>
															))}
														</div>
													</div>
												)}
											</div>
										))}
									</div>
								) : (
									<div className="text-center py-20 px-6">
										<div className="w-16 h-16 bg-neutral-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
											<Megaphone className="h-8 w-8 text-neutral-300" />
										</div>
										<h3 className="text-lg font-black text-sauti-dark">No reports yet</h3>
										<p className="text-sm text-neutral-500 font-medium mt-2 max-w-xs mx-auto">
											Submit your first report to start receiving support matches from professionals.
										</p>
									</div>
								)}
							</CardContent>
						</Card>
					</div>

					{/* Right Column: Actions & Help */}
					<div className="space-y-6">
						{/* Security Alert */}
						<Alert className="bg-sauti-dark text-white border-0 shadow-premium rounded-3xl p-6">
							<Shield className="h-6 w-6 text-sauti-teal mb-4" />
							<AlertTitle className="text-xl font-black mb-2">Secure Haven</AlertTitle>
							<AlertDescription className="text-sauti-teal-light/80 font-medium leading-relaxed">
								Your data is encrypted and your identity is masked. Only qualified service providers can view your reports, and only with your explicit consent.
							</AlertDescription>
						</Alert>

						{/* Quick Actions */}
						<div className="space-y-3">
							<Link href="/dashboard/chat" className="block p-5 bg-white rounded-3xl shadow-sm border border-neutral-100 hover:border-sauti-teal/30 hover:shadow-md transition-all group">
								<div className="flex items-center gap-4">
									<div className="w-12 h-12 rounded-2xl bg-sauti-teal-light flex items-center justify-center group-hover:bg-sauti-teal transition-colors">
										<MessageCircle className="h-6 w-6 text-sauti-teal group-hover:text-white transition-colors" />
									</div>
									<div className="flex-1">
										<h4 className="font-black text-sauti-dark">Support Chat</h4>
										<p className="text-xs text-neutral-500 font-medium">Connect with providers</p>
									</div>
									<ArrowRight className="h-4 w-4 text-neutral-300" />
								</div>
							</Link>

							<Link href="/dashboard/settings" className="block p-5 bg-white rounded-3xl shadow-sm border border-neutral-100 hover:border-sauti-teal/30 hover:shadow-md transition-all group">
								<div className="flex items-center gap-4">
									<div className="w-12 h-12 rounded-2xl bg-sauti-yellow-light flex items-center justify-center group-hover:bg-sauti-yellow transition-colors">
										<Shield className="h-6 w-6 text-sauti-yellow-dark group-hover:text-white transition-colors" />
									</div>
									<div className="flex-1">
										<h4 className="font-black text-sauti-dark">Privacy Settings</h4>
										<p className="text-xs text-neutral-500 font-medium">Manage your security</p>
									</div>
									<ArrowRight className="h-4 w-4 text-neutral-300" />
								</div>
							</Link>
						</div>

						{/* Emergency Card */}
						<Card className="bg-sauti-red-light border-0 shadow-sm rounded-3xl">
							<CardContent className="p-6">
								<h3 className="text-lg font-black text-sauti-red mb-2">Immediate Danger?</h3>
								<p className="text-sm text-sauti-red/80 font-bold mb-4">
									If you are in immediate physical danger, please contact local emergency services or use the SOS button.
								</p>
								<Button className="w-full bg-sauti-red hover:bg-sauti-red/90 text-white font-black rounded-xl">
									Emergency Contacts
								</Button>
							</CardContent>
						</Card>
					</div>
				</div>
			</div>

			<Dialog open={open} onOpenChange={setOpen}>
				<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-0 border-0 rounded-3xl shadow-2xl">
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
