"use client";

import { createClient } from "@/utils/supabase/client";
import { Tables } from "@/types/db-schema";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
	Shield, ArrowLeft, Activity, 
	Calendar, AlertCircle, Phone, 
	Clock, CheckCircle2, MapPin, 
	Plus, Info, Lock, ChevronRight,
	Heart, XCircle, HelpingHand,
	Sparkles, Search, Layers, ShieldCheck, 
	RefreshCw, MessageCircle, LogOut,
	User, BookOpen, HandHeart, ArrowRight
} from "lucide-react";
import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getMockMatches, MockProvider } from "@/lib/mock-matches";
import Link from "next/link";

export default function ReportDetailPage({ params }: { params: Promise<{ id: string }> }) {
	const resolvedParams = use(params);
	const reportId = resolvedParams.id;
	
	const [report, setReport] = useState<Tables<"reports"> | null>(null);
	const [allMatches, setAllMatches] = useState<MockProvider[]>([]);
	const [matchIndex, setMatchIndex] = useState(0);
	const [acceptedMatch, setAcceptedMatch] = useState<MockProvider | null>(null);
	
	const [loading, setLoading] = useState(true);
	const [errorState, setErrorState] = useState<string | null>(null);
	const [updating, setUpdating] = useState(false);
	const [newDetail, setNewDetail] = useState("");
	
	const { toast } = useToast();
	const router = useRouter();
	const supabase = createClient();

	const currentMatch = allMatches[matchIndex];

	const fetchReport = useCallback(async () => {
		try {
			const { data, error } = await supabase
				.from("reports")
				.select("*")
				.eq("report_id", reportId)
				.maybeSingle();

			if (error) {
				setErrorState(`Access limited: ${error.message}`);
				return;
			}

			if (data) {
				setReport(data);
				const matches = getMockMatches(data.type_of_incident);
				setAllMatches(matches);
			} else {
				setErrorState("Journey details not found. Please verify the link.");
			}
		} catch (err: any) {
			setErrorState("A connection issue occurred. Your data remains safe.");
		} finally {
			setLoading(false);
		}
	}, [reportId, supabase]);

	useEffect(() => {
		fetchReport();
		const timer = setTimeout(() => {
			if (loading) setLoading(false);
		}, 6000);
		return () => clearTimeout(timer);
	}, [fetchReport, loading]);

	const handleAddDetail = async () => {
		if (!newDetail.trim() || !report) return;

		setUpdating(true);
		const currentDescription = report.incident_description || "";
		const timestamp = new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });
		const updatedDescription = `${currentDescription}\n\n[Shared on ${timestamp}]\n${newDetail}`;

		const { error } = await supabase
			.from("reports")
			.update({ incident_description: updatedDescription })
			.eq("report_id", reportId);

		if (error) {
			toast({
				title: "Unable to save",
				description: error.message,
				variant: "destructive",
			});
		} else {
			toast({
				title: "Shared successfully",
				description: "Your additional details have been safely added to your record.",
			});
			setNewDetail("");
			fetchReport();
		}
		setUpdating(false);
	};

	const nextMatch = () => {
		if (matchIndex < allMatches.length - 1) {
			setMatchIndex(prev => prev + 1);
		} else {
			setMatchIndex(0);
		}
	};

	const acceptMatch = (provider: MockProvider) => {
		setAcceptedMatch(provider);
		toast({
			title: "Support Connection Active",
			description: `You can now securely coordinate with ${provider.name}.`,
		});
	};

	const exitSafely = () => {
		window.location.href = "https://www.google.com";
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-slate-50">
				<div className="flex flex-col items-center gap-6">
					<div className="relative">
						<div className="w-16 h-16 border-4 border-teal-100 border-t-teal-500 rounded-full animate-spin" />
						<Heart className="h-6 w-6 text-teal-400 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
					</div>
					<div className="text-center space-y-1">
						<p className="text-lg font-semibold text-slate-700">Safely loading your space</p>
						<p className="text-sm text-slate-400 font-medium">Your privacy is our priority</p>
					</div>
				</div>
			</div>
		);
	}

	if (errorState) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-white p-6">
				<Card className="max-w-md w-full border-slate-100 rounded-3xl p-10 text-center shadow-sm">
					<div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-6">
						<Search className="h-8 w-8 text-slate-300" />
					</div>
					<h2 className="text-xl font-bold text-slate-800 mb-3">Connection Issue</h2>
					<p className="text-slate-500 mb-8 leading-relaxed">{errorState}</p>
					<div className="space-y-3">
						<Button onClick={() => window.location.reload()} className="w-full bg-teal-600 hover:bg-teal-700 text-white rounded-2xl h-12 font-semibold shadow-sm">
							Try again
						</Button>
						<Button asChild variant="ghost" className="w-full text-slate-400">
							<Link href="/dashboard">Return to dashboard</Link>
						</Button>
					</div>
				</Card>
			</div>
		);
	}

	if (!report) return null;

	return (
		<div className="min-h-screen bg-slate-50/50 text-slate-900 selection:bg-teal-100/50">
			{/* Top Bar Navigation */}
			<div className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-slate-100">
				<div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
					<div className="flex items-center gap-4">
						<Link 
							href="/dashboard" 
							className="flex items-center gap-2 text-slate-400 hover:text-teal-600 transition-all font-semibold text-sm group"
						>
							<ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
							Back
						</Link>
						<div className="h-4 w-px bg-slate-200 hidden sm:block" />
						<div className="hidden sm:flex items-center gap-2">
							<ShieldCheck className="h-4 w-4 text-teal-500" />
							<span className="text-xs font-semibold text-slate-500">Secure Space Active</span>
						</div>
					</div>
					<Button 
						onClick={exitSafely} 
						variant="outline"
						className="bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-100 rounded-full text-xs font-bold px-4 h-9 gap-2 shadow-sm"
					>
						<LogOut className="h-3.5 w-3.5" />
						Quick Exit
					</Button>
				</div>
			</div>

			<main className="max-w-6xl mx-auto px-4 py-8 md:py-12 pb-32">
				{/* Header Section */}
				<div className="mb-12 space-y-6">
					<div className="flex flex-wrap items-center gap-2">
						<span className={cn(
							"px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border",
							report.urgency === 'high' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-slate-100 text-slate-500 border-slate-200'
						)}>
							{report.urgency} Priority
						</span>
						<span className="px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-700 border border-teal-100">
							Ref: {reportId.slice(0, 8).toUpperCase()}
						</span>
					</div>
					<h1 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 capitalize">
						{report.type_of_incident?.replace(/_/g, " ")} Support Journey
					</h1>
					<div className="flex items-center gap-6 text-sm text-slate-400 font-medium">
						<div className="flex items-center gap-2">
							<Calendar className="h-4 w-4" />
							Started {new Date(report.submission_timestamp!).toLocaleDateString()}
						</div>
						<div className="flex items-center gap-2">
							<MapPin className="h-4 w-4" />
							{report.city || "Location Confirms Safety"}
						</div>
					</div>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-12 gap-8 md:gap-12">
					
					{/* Left Column: Your Story */}
					<div className="lg:col-span-7 space-y-8">
						
						{/* Narrative Card */}
						<Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden bg-white">
							<div className="p-8 md:p-10 space-y-6">
								<div className="flex items-center gap-3">
									<div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center">
										<BookOpen className="h-5 w-5 text-teal-600" />
									</div>
									<h2 className="text-xl font-bold text-slate-800">Your Shared Story</h2>
								</div>
								<div className="prose prose-slate max-w-none">
									<p className="text-lg text-slate-600 leading-relaxed whitespace-pre-wrap italic">
										"{report.incident_description || "You haven't shared a specific narrative yet."}"
									</p>
								</div>
							</div>
						</Card>

						{/* Update Section */}
						<Card className="rounded-3xl border-slate-100 shadow-sm overflow-hidden bg-white">
							<div className="p-8 md:p-10 space-y-8">
								<div className="flex items-center justify-between">
									<div className="flex items-center gap-3">
										<div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center">
											<Plus className="h-5 w-5 text-sky-600" />
										</div>
										<h2 className="text-xl font-bold text-slate-800">Share More Details</h2>
									</div>
									<Info className="h-5 w-5 text-slate-300" />
								</div>
								
								<p className="text-slate-500 leading-relaxed">
									It's okay if you remember more later. You can add any details, feelings, or updates whenever it feels safe to do so.
								</p>

								<div className="space-y-4">
									<Textarea 
										value={newDetail}
										onChange={(e) => setNewDetail(e.target.value)}
										placeholder="Tell us more about what's happening or what you need..."
										className="min-h-[200px] rounded-2xl border-slate-200 focus:border-teal-500 focus:ring-4 focus:ring-teal-500/5 p-6 text-base md:text-lg font-medium resize-none transition-all placeholder:text-slate-300"
									/>
									<div className="flex flex-col sm:flex-row items-center justify-between gap-4">
										<Button 
											onClick={handleAddDetail}
											disabled={updating || !newDetail.trim()}
											className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700 text-white font-bold py-4 px-10 rounded-2xl shadow-md h-14"
										>
											{updating ? "Saving safely..." : "Add to record"}
										</Button>
										<div className="flex items-center gap-2 text-slate-400 text-xs font-semibold">
											<Lock className="h-3.5 w-3.5" />
											Securely encrypted
										</div>
									</div>
								</div>
							</div>
						</Card>
					</div>

					{/* Right Column: Support Network */}
					<div className="lg:col-span-5 space-y-8">
						
						{/* Matching Engine */}
						<div className="space-y-6 sticky top-24">
							<div className="flex items-center justify-between px-2">
								<h2 className="text-sm font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
									<HandHeart className="h-4 w-4 text-teal-500" />
									Recommended Support
								</h2>
								{!acceptedMatch && (
									<div className="flex items-center gap-1.5 px-2 py-0.5 bg-teal-50 rounded-full border border-teal-100">
										<div className="w-1.5 h-1.5 rounded-full bg-teal-500 animate-pulse" />
										<span className="text-[9px] font-bold text-teal-700 uppercase tracking-wider">Matching</span>
									</div>
								)}
							</div>

							{acceptedMatch ? (
								/* ACCEPTED MATCH */
								<Card className="border-2 border-teal-500 bg-teal-50/30 rounded-[2.5rem] p-8 md:p-10 shadow-lg relative overflow-hidden group">
									<div className="absolute -top-6 -right-6 p-10 opacity-5 rotate-12">
										<ShieldCheck className="h-32 w-32 text-teal-600" />
									</div>
									<div className="relative z-10 space-y-8">
										<div className="flex items-center gap-5">
											<div className="w-16 h-16 bg-teal-500 rounded-2xl flex items-center justify-center text-white shadow-md">
												<CheckCircle2 className="h-8 w-8" />
											</div>
											<div>
												<p className="text-[10px] font-bold text-teal-600 uppercase tracking-widest mb-1">Support Active</p>
												<h3 className="text-2xl font-bold text-slate-900 leading-tight">{acceptedMatch.name}</h3>
											</div>
										</div>

										<div className="space-y-4">
											<div className="p-6 bg-white rounded-2xl border border-teal-100 shadow-sm">
												<p className="text-sm text-slate-600 leading-relaxed font-medium">
													You are connected. They are ready to help you with {acceptedMatch.type.toLowerCase()} services.
												</p>
											</div>

											<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
												<div className="bg-white rounded-2xl p-4 border border-slate-100 text-center">
													<p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Direct Help</p>
													<p className="text-sm font-bold text-slate-800">{acceptedMatch.phone}</p>
												</div>
												<div className="bg-white rounded-2xl p-4 border border-slate-100 text-center">
													<p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mb-1">Availability</p>
													<p className="text-sm font-bold text-slate-800">{acceptedMatch.availability}</p>
												</div>
											</div>
										</div>

										<div className="flex flex-col gap-3">
											<Button className="w-full h-14 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl shadow-md flex items-center justify-center gap-3">
												<Phone className="h-5 w-5" />
												Contact Now
											</Button>
											<button 
												onClick={() => setAcceptedMatch(null)}
												className="text-[10px] font-bold text-slate-400 hover:text-rose-500 uppercase tracking-widest transition-colors mt-2"
											>
												Remove connection
											</button>
										</div>
									</div>
								</Card>
							) : currentMatch ? (
								/* CANDIDATE MATCH */
								<div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
									<Card className="border border-slate-100 bg-white rounded-[2.5rem] shadow-sm hover:shadow-md transition-all duration-300 p-8 md:p-10 space-y-8">
										<div className="space-y-4">
											<div className="flex flex-wrap gap-2">
												<span className="px-3 py-1 bg-slate-100 text-slate-500 text-[9px] font-bold uppercase tracking-wider rounded-full">
													{currentMatch.type}
												</span>
												{currentMatch.focus_groups.map(fg => (
													<span key={fg} className="px-3 py-1 bg-teal-50 text-teal-600 text-[9px] font-bold uppercase tracking-wider rounded-full border border-teal-100">
														{fg} Support
													</span>
												))}
											</div>
											<h3 className="text-3xl font-bold text-slate-900 leading-tight">
												{currentMatch.name}
											</h3>
										</div>

										<p className="text-slate-500 font-medium leading-relaxed">
											{currentMatch.description}
										</p>

										<div className="grid grid-cols-2 gap-3">
											<div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
												<MapPin className="h-4 w-4 text-slate-300" />
												<p className="text-[10px] font-bold text-slate-600 uppercase leading-snug truncate">{currentMatch.address}</p>
											</div>
											<div className="flex items-center gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-100">
												<Clock className="h-4 w-4 text-slate-300" />
												<p className="text-[10px] font-bold text-slate-600 uppercase leading-snug truncate">{currentMatch.availability}</p>
											</div>
										</div>

										<div className="flex flex-col sm:flex-row gap-3 pt-4">
											<Button 
												onClick={() => acceptMatch(currentMatch)}
												className="flex-1 h-16 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl shadow-md transition-all flex items-center justify-center gap-3 text-lg"
											>
												<HelpingHand className="h-5 w-5" />
												Get Support
											</Button>
											<Button 
												variant="outline"
												onClick={nextMatch}
												className="h-16 sm:w-20 border-slate-200 hover:border-slate-300 text-slate-400 font-bold rounded-2xl transition-all flex items-center justify-center p-0"
											>
												Next
											</Button>
										</div>
									</Card>

									<p className="text-center text-[10px] font-bold text-slate-300 uppercase tracking-widest px-8 leading-relaxed">
										You can view more support options if this doesn't feel like the right fit for you.
									</p>
								</div>
							) : (
								<div className="text-center py-16 bg-slate-50/50 rounded-[2.5rem] border border-dashed border-slate-200">
									<Search className="h-10 w-10 text-slate-200 mx-auto mb-4" />
									<p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Finding the right support for you...</p>
								</div>
							)}

							{/* Empathetic Notice */}
							<Card className="bg-slate-900 rounded-[2.5rem] p-8 text-white relative overflow-hidden shadow-xl group/notice">
								<div className="absolute bottom-0 right-0 p-8 opacity-5 rotate-12">
									<Lock className="h-24 w-24" />
								</div>
								<div className="relative z-10 space-y-6">
									<h3 className="text-lg font-bold flex items-center gap-3">
										<Shield className="h-5 w-5 text-teal-400" />
										Your Safe Space
									</h3>
									<p className="text-slate-400 font-medium text-sm leading-relaxed">
										We only share your story with providers <span className="text-white italic">you</span> choose to connect with. Your true identity stays hidden behind your unique reference number.
									</p>
									<Button asChild variant="link" className="text-teal-400 p-0 h-auto font-bold text-xs uppercase tracking-widest hover:text-white transition-all">
										<Link href="/dashboard/settings" className="flex items-center gap-2">
											Learn more about your privacy
											<ArrowRight className="h-3 w-3" />
										</Link>
									</Button>
								</div>
							</Card>
						</div>
					</div>
				</div>
			</main>
		</div>
	);
}
