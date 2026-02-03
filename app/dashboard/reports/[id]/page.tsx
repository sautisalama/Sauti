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
	Home, UserCircle, Briefcase, RefreshCw, ArrowRight
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
			console.log("Initiating Case Decryption for ID:", reportId);
			// Show actual progress in console
			
			const { data, error } = await supabase
				.from("reports")
				.select("*")
				.eq("report_id", reportId)
				.maybeSingle(); // Better than .single() as it doesn't throw on 0 rows

			if (error) {
				console.error("Access Denied or Connection Error:", error);
				setErrorState(`Security Error: ${error.message} (Code: ${error.code})`);
				return;
			}

			if (data) {
				console.log("Report payload received:", data.type_of_incident);
				setReport(data);
				const matches = getMockMatches(data.type_of_incident);
				setAllMatches(matches);
			} else {
				console.warn("No report found in vault for this ID.");
				setErrorState("The requested case file does not exist or has been moved.");
			}
		} catch (err: any) {
			console.error("Critical Runtime Failure:", err);
			setErrorState(err.message || "A critical error occurred while accessing the secure vault.");
		} finally {
			console.log("Decryption sequence completed.");
			setLoading(false);
		}
	}, [reportId, supabase]);

	useEffect(() => {
		fetchReport();
		
		// Safety timeout: If loading takes > 8 seconds, force show an error
		const timer = setTimeout(() => {
			if (loading) {
				setLoading(false);
				setErrorState("The connection to the secure vault timed out. Please refresh or check your connection.");
			}
		}, 8000);
		
		return () => clearTimeout(timer);
	}, [fetchReport, loading]);

	const handleAddDetail = async () => {
		if (!newDetail.trim() || !report) return;

		setUpdating(true);
		const currentDescription = report.incident_description || "";
		const timestamp = new Date().toLocaleString('en-KE', { timeZone: 'Africa/Nairobi' });
		const updatedDescription = `${currentDescription}\n\n[SUPPLEMENTAL - ${timestamp}]\n${newDetail}`;

		const { error } = await supabase
			.from("reports")
			.update({ incident_description: updatedDescription })
			.eq("report_id", reportId);

		if (error) {
			toast({
				title: "Update Blocked",
				description: error.message,
				variant: "destructive",
			});
		} else {
			toast({
				title: "Vault Updated",
				description: "Information has been appended to the secure case file.",
			});
			setNewDetail("");
			fetchReport();
		}
		setUpdating(false);
	};

	const nextMatch = () => {
		toast({
			title: "Scanning Next Option",
			description: "Querying alternative providers in our secure network...",
		});
		if (matchIndex < allMatches.length - 1) {
			setMatchIndex(prev => prev + 1);
		} else {
			setMatchIndex(0); // Cycle back
		}
	};

	const acceptMatch = (provider: MockProvider) => {
		setAcceptedMatch(provider);
		toast({
			title: "Secure Channel Established",
			description: `You have accepted ${provider.name}. They can now view your redacted report.`,
		});
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-neutral-900 overflow-hidden">
				<div className="flex flex-col items-center gap-8 relative">
					<div className="relative">
						<div className="w-24 h-24 border-[4px] border-sauti-teal/10 border-t-sauti-teal rounded-full animate-spin" />
						<div className="absolute inset-0 flex items-center justify-center">
							<Shield className="h-8 w-8 text-sauti-teal animate-pulse" />
						</div>
					</div>
					<div className="text-center space-y-3">
						<h3 className="text-white font-black text-xl tracking-widest uppercase">Decrypting Case</h3>
						<div className="flex items-center gap-2 justify-center">
							<div className="w-1.5 h-1.5 rounded-full bg-sauti-teal animate-bounce" style={{ animationDelay: '0ms' }} />
							<div className="w-1.5 h-1.5 rounded-full bg-sauti-teal animate-bounce" style={{ animationDelay: '200ms' }} />
							<div className="w-1.5 h-1.5 rounded-full bg-sauti-teal animate-bounce" style={{ animationDelay: '400ms' }} />
						</div>
						<p className="text-[10px] text-neutral-500 font-bold uppercase tracking-[0.4em] pt-4">
							Establishing End-to-End Tunnel...
						</p>
					</div>
				</div>
			</div>
		);
	}

	if (errorState) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-white p-6">
				<Card className="max-w-md w-full border-neutral-100 rounded-[3rem] p-12 text-center shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)]">
					<div className="w-20 h-20 bg-sauti-red/5 rounded-full flex items-center justify-center mx-auto mb-6">
						<XCircle className="h-10 w-10 text-sauti-red" />
					</div>
					<h2 className="text-2xl font-black text-sauti-dark mb-4">Vault Access Error</h2>
					<p className="text-neutral-500 font-medium mb-10 leading-relaxed">{errorState}</p>
					<div className="space-y-3">
						<Button onClick={() => window.location.reload()} className="w-full bg-sauti-teal hover:bg-sauti-dark text-white rounded-2xl h-14 font-black text-lg shadow-lg">
							<RefreshCw className="h-5 w-5 mr-2" />
							Retry Connection
						</Button>
						<Button asChild variant="ghost" className="w-full text-neutral-400 font-bold h-12">
							<Link href="/dashboard">Return to Overview</Link>
						</Button>
					</div>
				</Card>
			</div>
		);
	}

	if (!report) return null;

	return (
		<div className="min-h-screen bg-white text-sauti-dark selection:bg-sauti-teal/10">
			{/* Top Bar Navigation */}
			<div className="sticky top-0 z-50 bg-white/90 backdrop-blur-xl border-b border-neutral-100">
				<div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
					<Link 
						href="/dashboard" 
						className="flex items-center gap-2 text-neutral-400 hover:text-sauti-dark transition-all font-black text-[10px] uppercase tracking-widest group"
					>
						<ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
						Case List
					</Link>
					<div className="flex items-center gap-4">
						<div className="flex items-center gap-2 px-4 py-2 bg-sauti-teal/5 rounded-full border border-sauti-teal/10">
							<ShieldCheck className="h-3 w-3 text-sauti-teal" />
							<span className="text-[10px] font-black uppercase tracking-widest text-sauti-teal">Secure Tunnel: 128-bit SSL</span>
						</div>
					</div>
				</div>
			</div>

			<main className="max-w-7xl mx-auto px-6 py-12 pb-32">
				{/* Case Header */}
				<div className="max-w-4xl mb-20 space-y-6">
					<div className="flex items-center gap-3">
						<div className={cn(
							"px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] border shadow-sm",
							report.urgency === 'high' ? 'bg-sauti-red/5 text-sauti-red border-sauti-red/10' : 'bg-neutral-50 text-neutral-400 border-neutral-100'
						)}>
							{report.urgency} Priority Level
						</div>
						<div className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-[0.2em] bg-neutral-900 text-white shadow-lg">
							Case ID: SS-{reportId.slice(0, 8).toUpperCase()}
						</div>
					</div>
					<h1 className="text-6xl md:text-8xl font-black tracking-tight leading-[0.85] text-sauti-dark capitalize">
						{report.type_of_incident?.replace(/_/g, " ")}
					</h1>
					<div className="flex flex-wrap items-center gap-10 text-[11px] font-black text-neutral-400 uppercase tracking-[0.3em] pt-8">
						<div className="flex items-center gap-2.5">
							<Calendar className="h-4 w-4 text-sauti-teal" />
							Opened {new Date(report.submission_timestamp!).toLocaleDateString()}
						</div>
						<div className="flex items-center gap-2.5">
							<MapPin className="h-4 w-4 text-sauti-teal" />
							Region: {report.city || report.country || "Global"}
						</div>
						<div className="flex items-center gap-2.5">
							<Lock className="h-4 w-4 text-sauti-teal" />
							Account: Anonymous Guest
						</div>
					</div>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-12 gap-20">
					
					{/* Left Column: Evidence & History */}
					<div className="lg:col-span-12 xl:col-span-7 space-y-20">
						
						{/* Narrative Card */}
						<section className="space-y-8">
							<div className="flex items-center gap-4 border-l-4 border-sauti-teal pl-6">
								<div>
									<h2 className="text-lg font-black uppercase tracking-widest text-sauti-dark mb-1">
										Report Narrative
									</h2>
									<p className="text-[10px] font-black text-neutral-400 uppercase tracking-widest">Initial statement provided to the network</p>
								</div>
							</div>
							<div className="bg-neutral-50/70 rounded-[3.5rem] p-12 border border-neutral-100 shadow-sm relative overflow-hidden">
								<div className="absolute top-0 right-0 p-12 opacity-[0.03]">
									<Activity className="h-48 w-48" />
								</div>
								<p className="text-2xl text-neutral-600 font-medium leading-relaxed whitespace-pre-wrap relative z-10 italic">
									"{report.incident_description || "No specific narrative provided."}"
								</p>
							</div>
						</section>

						{/* Update Section */}
						<section className="space-y-10">
							<div className="bg-white rounded-[3.5rem] border border-neutral-100 p-12 shadow-[0_40px_80px_-16px_rgba(0,0,0,0.08)]">
								<div className="flex items-center justify-between mb-10">
									<div>
										<h2 className="text-3xl font-black flex items-center gap-4">
											<HelpingHand className="h-8 w-8 text-sauti-teal" />
											Submit Supplement
										</h2>
										<p className="text-sm text-neutral-400 font-medium mt-2">Add logs, recent events, or specific requests to this file.</p>
									</div>
								</div>
								
								<div className="space-y-8">
									<div className="relative">
										<Textarea 
											value={newDetail}
											onChange={(e) => setNewDetail(e.target.value)}
											placeholder="Type your supplemental details here..."
											className="min-h-[280px] rounded-[2.5rem] border-neutral-200 focus:border-sauti-teal focus:ring-[12px] focus:ring-sauti-teal/5 p-10 text-xl font-medium resize-none transition-all placeholder:text-neutral-200 shadow-inner"
										/>
									</div>
									<div className="flex flex-col md:flex-row items-center justify-between gap-8 pt-4">
										<Button 
											onClick={handleAddDetail}
											disabled={updating || !newDetail.trim()}
											className="w-full md:w-auto bg-sauti-dark hover:bg-black text-white font-black py-4 px-16 rounded-[1.5rem] shadow-2xl transition-all h-20 text-xl group overflow-hidden relative"
										>
											<span className="relative z-10 flex items-center gap-3">
												{updating ? "Processing Cryptography..." : "Append Supplemental Logs"}
												<ChevronRight className="h-6 w-6 group-hover:translate-x-2 transition-transform" />
											</span>
										</Button>
										<div className="flex items-center gap-3 text-neutral-300 font-bold text-[10px] uppercase tracking-widest text-right">
											<span>SECURE AGENT HANDSHAKE: SUCCESS</span>
											<Layers className="h-4 w-4" />
										</div>
									</div>
								</div>
							</div>
						</section>
					</div>

					{/* Right Column: Interactive Matching Engine */}
					<div className="lg:col-span-12 xl:col-span-5">
						<div className="space-y-12 sticky top-28">
							
							{/* Match Status Card */}
							<div className="space-y-8">
								<div className="flex items-center justify-between px-2">
									<div>
										<h2 className="text-sm font-black uppercase tracking-[0.3em] flex items-center gap-2 mb-1">
											<Sparkles className="h-4 w-4 text-sauti-teal" />
											Resilience Match Engine
										</h2>
										<p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Real-time provider verification active</p>
									</div>
									{!acceptedMatch && (
										<div className="flex items-center gap-2 px-3 py-1 bg-sauti-teal/10 rounded-full border border-sauti-teal/20">
											<div className="w-1.5 h-1.5 rounded-full bg-sauti-teal animate-pulse" />
											<span className="text-[9px] font-black text-sauti-teal uppercase tracking-widest">Scanning Network</span>
										</div>
									)}
								</div>

								{acceptedMatch ? (
									/* INTERACTIVE: ACCEPTED MATCH */
									<Card className="border-[3px] border-sauti-teal bg-sauti-teal/[0.01] rounded-[4rem] p-12 shadow-[0_48px_96px_-24px_rgba(20,184,166,0.15)] overflow-hidden relative group">
										<div className="absolute -top-12 -right-12 p-12 opacity-[0.04] rotate-12 group-hover:rotate-0 transition-all duration-1000">
											<ShieldCheck className="h-64 w-64 text-sauti-teal" />
										</div>
										<div className="relative z-10 space-y-10">
											<div className="flex items-center gap-6">
												<div className="w-20 h-20 bg-sauti-teal rounded-[2rem] flex items-center justify-center text-white shadow-2xl transition-transform group-hover:scale-105">
													<ShieldCheck className="h-10 w-10" />
												</div>
												<div>
													<div className="flex items-center gap-2 mb-1">
														<span className="px-2 py-0.5 bg-sauti-teal text-white text-[8px] font-black uppercase tracking-widest rounded-md">Verified</span>
														<p className="text-[10px] font-black text-sauti-teal uppercase tracking-widest">Matched Partner</p>
													</div>
													<h3 className="text-4xl font-black text-sauti-dark leading-none">{acceptedMatch.name}</h3>
												</div>
											</div>

											<div className="space-y-6">
												<div className="p-8 bg-white/80 rounded-[2.5rem] border border-sauti-teal/10 shadow-sm backdrop-blur-sm">
													<p className="text-md text-neutral-600 font-medium leading-relaxed">
														<span className="font-black text-sauti-teal mr-2">Case Established:</span>
														This provider has accepted your redacted report. You can now communicate securely via the encrypted lines below.
													</p>
												</div>

												<div className="grid grid-cols-1 gap-4">
													<div className="flex items-center justify-between p-6 bg-white rounded-3xl border border-neutral-100 shadow-sm">
														<div className="flex items-center gap-4">
															<div className="w-10 h-10 bg-neutral-50 rounded-xl flex items-center justify-center">
																<Phone className="h-5 w-5 text-sauti-teal" />
															</div>
															<div>
																<p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Response line</p>
																<p className="text-lg font-black text-sauti-dark">{acceptedMatch.phone}</p>
															</div>
														</div>
														<Button size="sm" className="bg-sauti-teal hover:bg-sauti-dark text-white rounded-xl font-black px-6">Call</Button>
													</div>
													<div className="flex items-center justify-between p-6 bg-white rounded-3xl border border-neutral-100 shadow-sm">
														<div className="flex items-center gap-4">
															<div className="w-10 h-10 bg-neutral-50 rounded-xl flex items-center justify-center">
																<Clock className="h-5 w-5 text-sauti-teal" />
															</div>
															<div>
																<p className="text-[9px] font-black text-neutral-400 uppercase tracking-widest">Availability</p>
																<p className="text-lg font-black text-sauti-dark">{acceptedMatch.availability}</p>
															</div>
														</div>
													</div>
												</div>
											</div>

											<div className="flex flex-col gap-4">
												<Button className="w-full h-16 bg-neutral-900 hover:bg-black text-white font-black rounded-[1.5rem] shadow-2xl transition-all text-lg flex items-center justify-center gap-3">
													Open Encrypted Chat
													<ChevronRight className="h-5 w-5" />
												</Button>
												<button 
													onClick={() => setAcceptedMatch(null)}
													className="text-[10px] font-black text-neutral-300 hover:text-sauti-red uppercase tracking-widest transition-colors"
												>
													Dismiss this connection
												</button>
											</div>
										</div>
									</Card>
								) : currentMatch ? (
									/* INTERACTIVE: CANDIDATE MATCH */
									<div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
										<Card className="border border-neutral-100 bg-white rounded-[4rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.1)] group overflow-hidden transition-all duration-700 hover:shadow-[0_48px_96px_-24px_rgba(0,0,0,0.15)] hover:border-sauti-teal/20 pb-4">
											<div className="p-10 md:p-12 space-y-10">
												<div className="space-y-6">
													<div className="flex flex-wrap gap-2.5">
														<div className="px-4 py-1.5 bg-neutral-900 text-white text-[9px] font-black uppercase tracking-widest rounded-full shadow-lg flex items-center gap-2">
															<Shield className="h-3 w-3 text-sauti-teal" />
															Support Network
														</div>
														{currentMatch.focus_groups.map(fg => (
															<span key={fg} className="px-4 py-1.5 bg-sauti-teal/5 text-sauti-teal text-[9px] font-black uppercase tracking-widest rounded-full border border-sauti-teal/10">
																{fg} Target
															</span>
														))}
													</div>
													<h3 className="text-5xl font-black text-sauti-dark group-hover:text-sauti-teal transition-all duration-500 leading-none">
														{currentMatch.name}
													</h3>
												</div>

												<p className="text-xl text-neutral-500 font-medium leading-relaxed">
													{currentMatch.description}
												</p>

												<div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
													<div className="flex items-center gap-4 p-5 bg-neutral-50 rounded-[1.5rem] border border-neutral-100">
														<div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
															<MapPin className="h-5 w-5 text-neutral-300" />
														</div>
														<p className="text-[11px] font-black text-neutral-600 uppercase tracking-widest leading-snug">{currentMatch.address}</p>
													</div>
													<div className="flex items-center gap-4 p-5 bg-neutral-50 rounded-[1.5rem] border border-neutral-100">
														<div className="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center">
															<Clock className="h-5 w-5 text-neutral-300" />
														</div>
														<p className="text-[11px] font-black text-neutral-600 uppercase tracking-widest leading-snug">{currentMatch.availability}</p>
													</div>
												</div>

												<div className="flex flex-col sm:flex-row gap-4 pt-10">
													<Button 
														onClick={() => acceptMatch(currentMatch)}
														className="flex-1 h-20 bg-sauti-teal hover:bg-sauti-dark text-white font-black rounded-2xl shadow-xl transition-all flex items-center justify-center gap-4 text-xl group/btn overflow-hidden relative"
													>
														<div className="absolute inset-0 bg-white/10 translate-y-full group-hover/btn:translate-y-0 transition-transform duration-300" />
														<Heart className="h-7 w-7 fill-white relative z-10" />
														<span className="relative z-10">Accept Match</span>
													</Button>
													<Button 
														variant="outline"
														onClick={nextMatch}
														className="h-20 sm:w-24 border-neutral-200 hover:border-sauti-red hover:text-sauti-red text-neutral-400 font-black rounded-2xl transition-all flex items-center justify-center group/skip"
													>
														<XCircle className="h-8 w-8 group-skip:scale-110 transition-transform" />
													</Button>
												</div>
											</div>
										</Card>

										<div className="flex items-center justify-center gap-2">
											{allMatches.map((_, i) => (
												<div 
													key={i} 
													className={cn(
														"w-2 h-2 rounded-full transition-all duration-300",
														i === matchIndex ? "w-6 bg-sauti-teal" : "bg-neutral-200"
													)} 
												/>
											))}
										</div>
									</div>
								) : (
									<div className="text-center p-20 bg-neutral-50/50 rounded-[4rem] border border-dashed border-neutral-200">
										<Search className="h-16 w-16 text-neutral-200 mx-auto mb-6 animate-pulse" />
										<p className="text-neutral-400 font-black uppercase text-xs tracking-[0.3em]">Querying Global Network...</p>
									</div>
								)}

								{/* Protection Banner */}
								<div className="bg-neutral-900 rounded-[3rem] p-12 text-white relative overflow-hidden shadow-2xl group/vault">
									<div className="absolute top-0 right-0 p-12 opacity-[0.05] group-hover:opacity-[0.1] transition-opacity">
										<Lock className="h-32 w-32" />
									</div>
									<div className="relative z-10 space-y-8">
										<h3 className="text-2xl font-black flex items-center gap-4">
											<div className="w-10 h-10 rounded-xl bg-sauti-teal flex items-center justify-center">
												<Shield className="h-6 w-6 text-white" />
											</div>
											Zero-Trace Vault
										</h3>
										<p className="text-neutral-400 font-medium text-lg leading-relaxed">
											Providers only receive your <span className="text-white font-black italic">Incident Statement</span>. Your location, device IP, and metadata are scrubbed before transmission.
										</p>
										<Button asChild variant="link" className="text-sauti-teal p-0 h-auto font-black text-xs uppercase tracking-[0.3em] hover:text-white transition-all">
											<Link href="/dashboard/settings" className="flex items-center gap-3">
												Permanent Account Link
												<ArrowRight className="h-4 w-4" />
											</Link>
										</Button>
									</div>
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
