"use client";

import { createClient } from "@/utils/supabase/client";
import { Tables } from "@/types/db-schema";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
	ArrowLeft, Calendar, Phone, 
	Clock, CheckCircle2, MapPin, 
	Plus, Lock, ChevronRight,
	Heart, ShieldCheck, 
	MessageCircle, LogOut,
	BookOpen, HandHeart, ArrowRight,
	Mic, FileText, PenLine, Home
} from "lucide-react";
import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { getMockMatches, MockProvider } from "@/lib/mock-matches";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AudioPlayer } from "../../_components/AudioPlayer";
import { RichTextEditor } from "@/components/RichTextEditor";
import { VoiceRecorderInline } from "@/components/VoiceRecorderInline";

// Type for media stored in reports
interface MediaFile {
	title?: string;
	url: string;
	type: string;
	size?: number;
	uploadedAt?: string;
}

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
	const [showAddDetails, setShowAddDetails] = useState(false);
	const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
	
	const { toast } = useToast();
	const router = useRouter();
	const supabase = createClient();

	const currentMatch = allMatches[matchIndex];

	// Parse media from report
	const getMediaFiles = (): MediaFile[] => {
		if (!report?.media) return [];
		try {
			const mediaData = typeof report.media === 'string' 
				? JSON.parse(report.media) 
				: report.media;
			return Array.isArray(mediaData) ? mediaData : [mediaData];
		} catch {
			return [];
		}
	};

	const audioFiles = getMediaFiles().filter(m => m.type?.startsWith('audio'));

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
				description: "Your additional details have been safely added.",
			});
			setNewDetail("");
			setShowAddDetails(false);
			fetchReport();
		}
		setUpdating(false);
	};

	const handleSaveNotes = async (content: string) => {
		if (!report) return;
		
		const { error } = await supabase
			.from("reports")
			.update({ notes: content })
			.eq("report_id", reportId);

		if (error) {
			toast({
				title: "Unable to save notes",
				description: error.message,
				variant: "destructive",
			});
		} else {
			toast({
				title: "Notes saved",
				description: "Your private notes have been saved securely.",
			});
			fetchReport();
		}
	};

	const handleVoiceRecorded = async (blob: Blob) => {
		// Upload voice note logic would go here
		toast({
			title: "Voice note received",
			description: "Uploading your recording...",
		});
		setShowVoiceRecorder(false);
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

	// Format date nicely
	const formatDate = (date: string | null) => {
		if (!date) return "";
		return new Date(date).toLocaleDateString("en-US", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric"
		});
	};

	// Loading state
	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-serene-neutral-50">
				<div className="flex flex-col items-center gap-6">
					<div className="relative">
						<div className="w-16 h-16 border-4 border-sauti-teal/20 border-t-sauti-teal rounded-full animate-spin" />
						<Heart className="h-6 w-6 text-sauti-teal absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
					</div>
					<div className="text-center space-y-1">
						<p className="text-lg font-semibold text-sauti-dark">Safely loading your space</p>
						<p className="text-sm text-serene-neutral-500 font-medium">Your privacy is our priority</p>
					</div>
				</div>
			</div>
		);
	}

	// Error state
	if (errorState) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-serene-neutral-50 p-6">
				<Card className="max-w-md w-full border-serene-neutral-200 rounded-3xl p-8 md:p-10 text-center shadow-sm">
					<div className="w-16 h-16 bg-serene-neutral-100 rounded-full flex items-center justify-center mx-auto mb-6">
						<FileText className="h-8 w-8 text-serene-neutral-400" />
					</div>
					<h2 className="text-xl font-bold text-sauti-dark mb-3">Connection Issue</h2>
					<p className="text-serene-neutral-500 mb-8 leading-relaxed">{errorState}</p>
					<div className="space-y-3">
						<Button onClick={() => window.location.reload()} className="w-full bg-sauti-teal hover:bg-sauti-teal/90 text-white rounded-2xl h-12 font-semibold shadow-sm">
							Try again
						</Button>
						<Button asChild variant="ghost" className="w-full text-serene-neutral-500">
							<Link href="/dashboard">Return to dashboard</Link>
						</Button>
					</div>
				</Card>
			</div>
		);
	}

	if (!report) return null;

	return (
		<div className="min-h-screen bg-serene-neutral-50 text-sauti-dark selection:bg-sauti-teal/20 pb-24">
			{/* Sticky Header */}
			<header className="sticky top-0 z-50 bg-white/90 backdrop-blur-lg border-b border-serene-neutral-100">
				<div className="max-w-4xl mx-auto px-4 h-14 md:h-16 flex items-center justify-between">
					{/* Back & Breadcrumb */}
					<div className="flex items-center gap-2 md:gap-4 min-w-0">
						<Link 
							href="/dashboard/reports" 
							className="flex items-center gap-1.5 text-serene-neutral-500 hover:text-sauti-teal transition-colors text-sm font-semibold group shrink-0"
						>
							<ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
							<span className="hidden sm:inline">Reports</span>
						</Link>
						<div className="h-4 w-px bg-serene-neutral-200 hidden sm:block" />
						<div className="flex items-center gap-1.5 text-xs text-serene-neutral-400 font-medium truncate">
							<ShieldCheck className="h-3.5 w-3.5 text-sauti-teal shrink-0" />
							<span className="truncate">Secure Space Active</span>
						</div>
					</div>
					
					{/* Quick Exit */}
					<Button 
						onClick={exitSafely} 
						variant="outline"
						className="bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200 rounded-full text-xs font-bold px-3 h-8 gap-1.5 shadow-sm shrink-0"
					>
						<LogOut className="h-3.5 w-3.5" />
						<span className="hidden sm:inline">Quick Exit</span>
					</Button>
				</div>
			</header>

			<main className="max-w-4xl mx-auto px-4 py-6 md:py-10 space-y-8">
				
				{/* === SECTION 1: Trauma-Sensitive Header === */}
				<section className="space-y-4">
					<div className="flex flex-wrap items-center gap-2">
						<Badge className="bg-sauti-teal/10 text-sauti-teal border-sauti-teal/20 font-bold text-[10px] uppercase tracking-wider">
							Ref: {reportId.slice(0, 8).toUpperCase()}
						</Badge>
						{report.urgency && (
							<Badge className={cn(
								"font-bold text-[10px] uppercase tracking-wider",
								report.urgency === 'high' 
									? 'bg-rose-50 text-rose-600 border-rose-200' 
									: 'bg-serene-neutral-100 text-serene-neutral-500 border-serene-neutral-200'
							)}>
								{report.urgency} Priority
							</Badge>
						)}
					</div>
					
					<h1 className="text-2xl md:text-3xl font-bold text-sauti-dark tracking-tight">
						Your Support Journey
					</h1>
					
					{/* Key Details Cards */}
					<div className="grid grid-cols-2 md:grid-cols-4 gap-3">
						<Card className="border-serene-neutral-100 rounded-2xl overflow-hidden">
							<CardContent className="p-3 md:p-4">
								<p className="text-[10px] font-bold text-serene-neutral-400 uppercase tracking-wider mb-1">Type</p>
								<p className="text-sm font-semibold text-sauti-dark capitalize truncate">
									{report.type_of_incident?.replace(/_/g, " ") || "Not specified"}
								</p>
							</CardContent>
						</Card>
						<Card className="border-serene-neutral-100 rounded-2xl overflow-hidden">
							<CardContent className="p-3 md:p-4">
								<p className="text-[10px] font-bold text-serene-neutral-400 uppercase tracking-wider mb-1">Submitted</p>
								<p className="text-sm font-semibold text-sauti-dark truncate">
									{report.submission_timestamp 
										? new Date(report.submission_timestamp).toLocaleDateString()
										: "—"}
								</p>
							</CardContent>
						</Card>
						<Card className="border-serene-neutral-100 rounded-2xl overflow-hidden">
							<CardContent className="p-3 md:p-4">
								<p className="text-[10px] font-bold text-serene-neutral-400 uppercase tracking-wider mb-1">Location</p>
								<p className="text-sm font-semibold text-sauti-dark truncate">
									{report.city || report.country || "Private"}
								</p>
							</CardContent>
						</Card>
						<Card className="border-serene-neutral-100 rounded-2xl overflow-hidden">
							<CardContent className="p-3 md:p-4">
								<p className="text-[10px] font-bold text-serene-neutral-400 uppercase tracking-wider mb-1">Consent</p>
								<p className="text-sm font-semibold text-sauti-dark capitalize truncate">
									{report.consent || "Private"}
								</p>
							</CardContent>
						</Card>
					</div>
				</section>

				{/* === SECTION 2: Support & Matches (Priority) === */}
				<section className="space-y-4">
					<div className="flex items-center gap-2">
						<HandHeart className="h-5 w-5 text-sauti-teal" />
						<h2 className="text-lg font-bold text-sauti-dark">Your Support Team</h2>
					</div>

					{acceptedMatch ? (
						/* Accepted Match Card */
						<Card className="border-2 border-sauti-teal bg-sauti-teal/5 rounded-3xl overflow-hidden">
							<CardContent className="p-6 md:p-8 space-y-6">
								<div className="flex items-center gap-4">
									<div className="w-14 h-14 bg-sauti-teal rounded-2xl flex items-center justify-center text-white shadow-md">
										<CheckCircle2 className="h-7 w-7" />
									</div>
									<div className="flex-1 min-w-0">
										<p className="text-[10px] font-bold text-sauti-teal uppercase tracking-widest mb-1">Connected</p>
										<h3 className="text-xl font-bold text-sauti-dark truncate">{acceptedMatch.name}</h3>
										<p className="text-sm text-serene-neutral-500">{acceptedMatch.type}</p>
									</div>
								</div>
								
								<div className="grid grid-cols-2 gap-3">
									<div className="p-4 bg-white rounded-2xl border border-serene-neutral-100">
										<p className="text-[10px] font-bold text-serene-neutral-400 uppercase tracking-wider mb-1">Contact</p>
										<p className="text-sm font-semibold text-sauti-dark">{acceptedMatch.phone}</p>
									</div>
									<div className="p-4 bg-white rounded-2xl border border-serene-neutral-100">
										<p className="text-[10px] font-bold text-serene-neutral-400 uppercase tracking-wider mb-1">Available</p>
										<p className="text-sm font-semibold text-sauti-dark truncate">{acceptedMatch.availability}</p>
									</div>
								</div>

								<div className="flex flex-col sm:flex-row gap-3">
									<Button className="flex-1 h-12 bg-sauti-teal hover:bg-sauti-teal/90 text-white font-bold rounded-2xl shadow-md">
										<Phone className="h-4 w-4 mr-2" />
										Call Now
									</Button>
									<Button className="flex-1 h-12 bg-white hover:bg-serene-neutral-50 text-sauti-dark font-bold rounded-2xl border-2 border-serene-neutral-200">
										<MessageCircle className="h-4 w-4 mr-2" />
										Chat
									</Button>
								</div>

								<button 
									onClick={() => setAcceptedMatch(null)}
									className="text-[10px] font-bold text-serene-neutral-400 hover:text-rose-500 uppercase tracking-widest transition-colors mx-auto block"
								>
									Change provider
								</button>
							</CardContent>
						</Card>
					) : currentMatch ? (
						/* Match Suggestion Card */
						<Card className="border-serene-neutral-100 rounded-3xl overflow-hidden hover:shadow-md transition-shadow">
							<CardContent className="p-6 md:p-8 space-y-6">
								<div className="flex flex-wrap gap-2">
									<Badge className="bg-serene-neutral-100 text-serene-neutral-600 border-0 font-bold text-[10px] uppercase tracking-wider">
										{currentMatch.type}
									</Badge>
									{currentMatch.focus_groups.map(fg => (
										<Badge key={fg} className="bg-sauti-teal/10 text-sauti-teal border-sauti-teal/20 font-bold text-[10px] uppercase tracking-wider">
											{fg} Support
										</Badge>
									))}
								</div>
								
								<div>
									<h3 className="text-2xl font-bold text-sauti-dark mb-2">{currentMatch.name}</h3>
									<p className="text-serene-neutral-500 leading-relaxed">{currentMatch.description}</p>
								</div>

								<div className="grid grid-cols-2 gap-3">
									<div className="flex items-center gap-2 p-3 bg-serene-neutral-50 rounded-xl">
										<MapPin className="h-4 w-4 text-serene-neutral-400 shrink-0" />
										<p className="text-xs font-semibold text-serene-neutral-600 truncate">{currentMatch.address}</p>
									</div>
									<div className="flex items-center gap-2 p-3 bg-serene-neutral-50 rounded-xl">
										<Clock className="h-4 w-4 text-serene-neutral-400 shrink-0" />
										<p className="text-xs font-semibold text-serene-neutral-600 truncate">{currentMatch.availability}</p>
									</div>
								</div>

								<div className="flex flex-col sm:flex-row gap-3">
									<Button 
										onClick={() => acceptMatch(currentMatch)}
										className="flex-1 h-14 bg-sauti-teal hover:bg-sauti-teal/90 text-white font-bold rounded-2xl shadow-md text-base"
									>
										<HandHeart className="h-5 w-5 mr-2" />
										Get Support
									</Button>
									<Button 
										variant="outline"
										onClick={nextMatch}
										className="h-14 sm:w-24 border-serene-neutral-200 hover:border-serene-neutral-300 text-serene-neutral-500 font-bold rounded-2xl"
									>
										Next
									</Button>
								</div>

								<p className="text-[10px] font-bold text-serene-neutral-300 uppercase tracking-widest text-center">
									Viewing {matchIndex + 1} of {allMatches.length} matches
								</p>
							</CardContent>
						</Card>
					) : (
						/* No Matches State */
						<Card className="border-dashed border-2 border-serene-neutral-200 rounded-3xl bg-serene-neutral-50/50">
							<CardContent className="p-8 text-center">
								<div className="w-14 h-14 bg-serene-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
									<HandHeart className="h-7 w-7 text-serene-neutral-400" />
								</div>
								<p className="text-serene-neutral-500 font-medium">Finding the right support for you...</p>
							</CardContent>
						</Card>
					)}
				</section>

				{/* === SECTION 3: Media (Voice Notes) === */}
				{audioFiles.length > 0 && (
					<section className="space-y-4">
						<div className="flex items-center gap-2">
							<Mic className="h-5 w-5 text-sauti-teal" />
							<h2 className="text-lg font-bold text-sauti-dark">Voice Recordings</h2>
						</div>
						
						<div className="space-y-3">
							{audioFiles.map((audio, index) => (
								<AudioPlayer 
									key={index}
									src={audio.url}
									title={audio.title || `Recording ${index + 1}`}
								/>
							))}
						</div>
					</section>
				)}

				{/* === SECTION 4: My Story === */}
				<section className="space-y-4">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-2">
							<BookOpen className="h-5 w-5 text-sauti-teal" />
							<h2 className="text-lg font-bold text-sauti-dark">My Story</h2>
						</div>
						<Button
							variant="ghost"
							size="sm"
							onClick={() => setShowAddDetails(!showAddDetails)}
							className="text-sauti-teal hover:bg-sauti-teal/10 font-semibold text-xs"
						>
							<Plus className="h-4 w-4 mr-1" />
							Add More
						</Button>
					</div>

					<Card className="border-serene-neutral-100 rounded-3xl overflow-hidden">
						<CardContent className="p-6 md:p-8">
							{report.incident_description ? (
								<p className="text-serene-neutral-600 leading-relaxed whitespace-pre-wrap">
									{report.incident_description}
								</p>
							) : (
								<p className="text-serene-neutral-400 italic">
									You haven't shared your story yet. That's okay — you can add details whenever you feel ready.
								</p>
							)}
						</CardContent>
					</Card>

					{/* Add Details Form */}
					{showAddDetails && (
						<Card className="border-sauti-teal/20 bg-sauti-teal/5 rounded-3xl overflow-hidden animate-in slide-in-from-top-2 duration-300">
							<CardContent className="p-6 md:p-8 space-y-4">
								<p className="text-sm text-serene-neutral-600">
									It's okay if you remember more later. Share whenever it feels safe.
								</p>
								
								<Textarea 
									value={newDetail}
									onChange={(e) => setNewDetail(e.target.value)}
									placeholder="Tell us more about what's happening or what you need..."
									className="min-h-[120px] rounded-2xl border-serene-neutral-200 focus:border-sauti-teal focus:ring-2 focus:ring-sauti-teal/10 p-4 text-base resize-none"
								/>

								<div className="flex flex-col sm:flex-row gap-3">
									<Button
										variant="outline"
										onClick={() => setShowVoiceRecorder(!showVoiceRecorder)}
										className="h-11 rounded-xl border-serene-neutral-200 text-serene-neutral-600 font-semibold"
									>
										<Mic className="h-4 w-4 mr-2" />
										{showVoiceRecorder ? "Hide Recorder" : "Add Voice Note"}
									</Button>
									<div className="flex-1" />
									<Button
										onClick={handleAddDetail}
										disabled={updating || !newDetail.trim()}
										className="h-11 bg-sauti-teal hover:bg-sauti-teal/90 text-white font-semibold rounded-xl"
									>
										{updating ? "Saving..." : "Add to Story"}
									</Button>
								</div>

								{showVoiceRecorder && (
									<VoiceRecorderInline 
										onRecorded={handleVoiceRecorded}
										onClose={() => setShowVoiceRecorder(false)}
									/>
								)}

								<div className="flex items-center gap-2 text-serene-neutral-400 text-xs font-semibold">
									<Lock className="h-3.5 w-3.5" />
									Securely encrypted
								</div>
							</CardContent>
						</Card>
					)}
				</section>

				{/* === SECTION 5: Private Notes (Post-Match) === */}
				{acceptedMatch && (
					<section className="space-y-4">
						<div className="flex items-center gap-2">
							<PenLine className="h-5 w-5 text-sauti-teal" />
							<h2 className="text-lg font-bold text-sauti-dark">Private Notes</h2>
						</div>
						<p className="text-sm text-serene-neutral-500">
							Write personal notes about your healing journey. These are private and only visible to you.
						</p>
						<RichTextEditor 
							content={report.notes || ""}
							onSave={handleSaveNotes}
							placeholder="Write your private notes here..."
						/>
					</section>
				)}

				{/* === Privacy Notice === */}
				<Card className="bg-sauti-dark rounded-3xl overflow-hidden">
					<CardContent className="p-6 md:p-8 text-white relative">
						<div className="absolute bottom-0 right-0 opacity-5 p-8">
							<Lock className="h-24 w-24" />
						</div>
						<div className="relative z-10 space-y-4">
							<h3 className="text-lg font-bold flex items-center gap-2">
								<ShieldCheck className="h-5 w-5 text-sauti-teal" />
								Your Safe Space
							</h3>
							<p className="text-serene-neutral-300 text-sm leading-relaxed">
								We only share your story with providers <span className="text-white font-medium italic">you</span> choose to connect with. Your true identity stays hidden behind your unique reference number.
							</p>
							<Button asChild variant="link" className="text-sauti-teal p-0 h-auto font-bold text-xs uppercase tracking-widest hover:text-white transition-colors">
								<Link href="/dashboard/settings" className="flex items-center gap-1">
									Learn more about your privacy
									<ArrowRight className="h-3 w-3" />
								</Link>
							</Button>
						</div>
					</CardContent>
				</Card>
			</main>
		</div>
	);
}
