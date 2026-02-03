"use client";

import { createClient } from "@/utils/supabase/client";
import { Tables } from "@/types/db-schema";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
	Shield, ArrowLeft, Activity, 
	Calendar, AlertCircle, Phone, 
	Clock, CheckCircle2, MapPin, 
	Plus, Info, Lock, ChevronRight
} from "lucide-react";
import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getMockMatches, MockProvider } from "@/lib/mock-matches";
import { MobileTabbar } from "@/components/MobileTabbar";
import Link from "next/link";

export default function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
	const { id: reportId } = use(params);
	const [report, setReport] = useState<Tables<"reports"> | null>(null);
	const [matches, setMatches] = useState<MockProvider[]>([]);
	const [loading, setLoading] = useState(true);
	const [updating, setUpdating] = useState(false);
	const [newDetail, setNewDetail] = useState("");
	const { toast } = useToast();
	const router = useRouter();
	const supabase = createClient();

	const fetchReport = useCallback(async () => {
		const { data, error } = await supabase
			.from("reports")
			.select("*")
			.eq("report_id", reportId)
			.single();

		if (error) {
			toast({
				title: "Error",
				description: "Failed to load report details.",
				variant: "destructive",
			});
			router.push("/dashboard");
			return;
		}

		if (data) {
			setReport(data);
			// Simulate immediate matching for the "illusion"
			setMatches(getMockMatches(data.type_of_incident));
		}
		setLoading(false);
	}, [reportId, supabase, toast, router]);

	useEffect(() => {
		fetchReport();
	}, [fetchReport]);

	const handleAddDetail = async () => {
		if (!newDetail.trim() || !report) return;

		setUpdating(true);
		const currentDescription = report.incident_description || "";
		const timestamp = new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });
		const updatedDescription = `${currentDescription}\n\n[UPDATE - ${timestamp}]\n${newDetail}`;

		const { error } = await supabase
			.from("reports")
			.update({ incident_description: updatedDescription })
			.eq("report_id", reportId);

		if (error) {
			toast({
				title: "Update Failed",
				description: error.message,
				variant: "destructive",
			});
		} else {
			toast({
				title: "Details Saved",
				description: "The information has been securely added to your case file.",
			});
			setNewDetail("");
			fetchReport();
		}
		setUpdating(false);
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-white">
				<div className="flex flex-col items-center gap-4">
					<div className="animate-spin h-10 w-10 border-4 border-sauti-teal border-t-transparent rounded-full" />
					<p className="text-xs font-black text-neutral-400 uppercase tracking-widest text-center">
						Decrypting Case File...
					</p>
				</div>
			</div>
		);
	}

	if (!report) return null;

	return (
		<div className="min-h-screen bg-white text-sauti-dark selection:bg-sauti-teal/10">
			{/* Top Bar Navigation */}
			<div className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-neutral-100">
				<div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
					<Link 
						href="/dashboard" 
						className="flex items-center gap-2 text-neutral-400 hover:text-sauti-dark transition-colors font-black text-xs uppercase tracking-widest group"
					>
						<ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
						Dashboard
					</Link>
					<div className="flex items-center gap-2">
						<span className="w-2 h-2 rounded-full bg-sauti-teal animate-pulse" />
						<span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Secure Vault Session</span>
					</div>
				</div>
			</div>

			<main className="max-w-6xl mx-auto px-6 py-12">
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
					
					{/* Left Column: Report Details */}
					<div className="lg:col-span-12 xl:col-span-8 space-y-12">
						
						{/* Case Title Card */}
						<div className="space-y-6">
							<div className="space-y-4">
								<div className="flex items-center gap-3">
									<div className={cn(
										"px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border shadow-sm",
										report.urgency === 'high' ? 'bg-sauti-red/5 text-sauti-red border-sauti-red/10' : 'bg-neutral-50 text-neutral-400 border-neutral-100'
									)}>
										{report.urgency} Priority
									</div>
									<div className="px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-50 text-emerald-600 border border-emerald-100 shadow-sm">
										Status: {report.match_status || 'Matching In Progress'}
									</div>
								</div>
								<h1 className="text-5xl md:text-6xl font-black tracking-tight leading-none text-sauti-dark capitalize">
									{report.type_of_incident?.replace(/_/g, " ")} Incident
								</h1>
								<div className="flex flex-wrap items-center gap-8 text-[11px] font-black text-neutral-400 uppercase tracking-widest pt-2">
									<div className="flex items-center gap-2">
										<Calendar className="h-4 w-4 text-sauti-teal" />
										File Opened: {new Date(report.submission_timestamp!).toLocaleDateString()}
									</div>
									<div className="flex items-center gap-2">
										<Shield className="h-4 w-4 text-sauti-teal" />
										Case ID: SS-{reportId.slice(0, 8).toUpperCase()}
									</div>
								</div>
							</div>

							<div className="bg-neutral-50 rounded-[3rem] p-10 md:p-12 border border-neutral-100 relative overflow-hidden group">
								<div className="absolute top-0 right-0 p-8 opacity-5">
									<Activity className="h-32 w-32" />
								</div>
								<h2 className="text-xl font-black mb-6 flex items-center gap-3">
									<Activity className="h-5 w-5 text-sauti-teal" />
									Statement Narrative
								</h2>
								<p className="text-lg text-neutral-600 font-medium leading-relaxed whitespace-pre-wrap relative z-10">
									{report.incident_description || "No specific narrative provided in original report."}
								</p>
							</div>
						</div>

						{/* Add More Details Form */}
						<div className="bg-white rounded-[3rem] border border-neutral-100 p-10 md:p-12 shadow-sm">
							<div className="flex items-center justify-between mb-8">
								<h2 className="text-2xl font-black flex items-center gap-3">
									<Plus className="h-6 w-6 text-sauti-teal" />
									Supplemental Information
								</h2>
								<Info className="h-5 w-5 text-neutral-300" />
							</div>
							<p className="text-neutral-500 font-medium mb-6 text-sm">
								If you have additional details, updates, or specific requests for the matched providers, please enter them below.
							</p>
							<div className="space-y-6">
								<Textarea 
									value={newDetail}
									onChange={(e) => setNewDetail(e.target.value)}
									placeholder="Describe changes or add more context..."
									className="min-h-[220px] rounded-[2rem] border-neutral-200 focus:border-sauti-teal focus:ring-4 focus:ring-sauti-teal/5 p-8 text-neutral-600 font-medium placeholder:text-neutral-300 resize-none transition-all"
								/>
								<div className="flex flex-col md:flex-row items-center gap-6">
									<Button 
										onClick={handleAddDetail}
										disabled={updating || !newDetail.trim()}
										className="w-full md:w-auto bg-sauti-dark hover:bg-black text-white font-black py-4 px-12 rounded-2xl shadow-xl transition-all h-16 text-lg"
									>
										{updating ? "Processing Vault Update..." : "Append to Case File"}
									</Button>
									<div className="flex items-center gap-2 text-neutral-400 font-bold text-[10px] uppercase tracking-widest">
										<Lock className="h-3 w-3" />
										End-to-End Encrypted
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* Right Column: Matching & Services */}
					<div className="lg:col-span-12 xl:col-span-4 space-y-10">
						
						{/* Matching Status */}
						<div className="space-y-6">
							<h3 className="text-xs font-black text-neutral-400 uppercase tracking-[0.3em] px-2 flex items-center justify-between">
								Immediate Matches
								<span className="text-sauti-teal animate-pulse">Running AI Audit</span>
							</h3>
							
							<div className="space-y-4">
								{matches.map((provider, idx) => (
									<Card key={provider.id} className="border border-neutral-100 rounded-[2.5rem] shadow-sm hover:shadow-md transition-all duration-500 group overflow-hidden bg-white">
										<CardContent className="p-8">
											<div className="flex items-start justify-between mb-6">
												<div className="space-y-2">
													<div className="px-3 py-1 bg-sauti-teal/5 text-sauti-teal text-[9px] font-black uppercase tracking-widest rounded-full inline-block border border-sauti-teal/10">
														Immediate Responder {idx + 1}
													</div>
													<h4 className="text-2xl font-black text-sauti-dark group-hover:text-sauti-teal transition-colors">
														{provider.name}
													</h4>
												</div>
												<div className="w-12 h-12 bg-neutral-50 rounded-2xl flex items-center justify-center text-neutral-200 group-hover:bg-sauti-teal/5 group-hover:text-sauti-teal transition-all">
													<Shield className="h-6 w-6" />
												</div>
											</div>
											
											<p className="text-neutral-500 font-medium text-sm leading-relaxed mb-8">
												{provider.description}
											</p>

											<div className="space-y-3 mb-8">
												<div className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl border border-neutral-100 transition-colors group-hover:bg-white group-hover:border-sauti-teal/20">
													<Phone className="h-4 w-4 text-neutral-300 group-hover:text-sauti-teal transition-colors" />
													<div className="flex-1">
														<p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Emergency Line</p>
														<p className="text-sm font-black text-sauti-dark">{provider.phone}</p>
													</div>
												</div>
												<div className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl border border-neutral-100 transition-colors group-hover:bg-white group-hover:border-sauti-teal/20">
													<Clock className="h-4 w-4 text-neutral-300 group-hover:text-sauti-teal transition-colors" />
													<div className="flex-1">
														<p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Availability</p>
														<p className="text-sm font-black text-sauti-dark">{provider.availability}</p>
													</div>
												</div>
												<div className="flex items-center gap-3 p-4 bg-neutral-50 rounded-2xl border border-neutral-100 transition-colors group-hover:bg-white group-hover:border-sauti-teal/20">
													<MapPin className="h-4 w-4 text-neutral-300 group-hover:text-sauti-teal transition-colors" />
													<div className="flex-1">
														<p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Location</p>
														<p className="text-sm font-black text-sauti-dark">{provider.address}</p>
													</div>
												</div>
											</div>

											<Button className="w-full h-14 bg-sauti-teal hover:bg-sauti-dark text-white font-black rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 group/btn">
												Connect with Provider
												<ChevronRight className="h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
											</Button>
										</CardContent>
									</Card>
								))}
							</div>
						</div>

						{/* Anonymity Alert */}
						<div className="bg-sauti-dark rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-2xl">
							<div className="absolute bottom-0 right-0 p-6 opacity-10">
								<Shield className="h-24 w-24" />
							</div>
							<div className="relative z-10 space-y-4">
								<h3 className="text-xl font-black flex items-center gap-2">
									<Lock className="h-5 w-5 text-sauti-teal" />
									Vault Status
								</h3>
								<p className="text-neutral-400 font-medium text-sm leading-relaxed">
									This report is only visible to you and authorized responders. Your true identity remains masked.
								</p>
								<div className="pt-4 space-y-4">
									<div className="p-4 bg-white/5 rounded-2xl border border-white/10">
										<p className="text-[9px] font-black text-neutral-500 uppercase tracking-widest mb-1">Session ID</p>
										<p className="text-xs font-mono text-sauti-teal-light truncate">{reportId}</p>
									</div>
									<Button asChild variant="link" className="text-sauti-teal p-0 h-auto font-black text-sm hover:text-white transition-colors">
										<Link href="/dashboard/settings" className="flex items-center gap-2">
											Link permanent email to this case
											<ChevronRight className="h-4 w-4" />
										</Link>
									</Button>
								</div>
							</div>
						</div>
					</div>
				</div>
			</main>
			<MobileTabbar active="reports" base="/dashboard" userType="survivor" />
		</div>
	);
}
