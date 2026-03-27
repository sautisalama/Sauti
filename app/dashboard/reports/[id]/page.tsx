"use client";

import { createClient } from "@/utils/supabase/client";
import { Tables } from "@/types/db-schema";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { 
	Calendar, Phone, 
	Clock, CheckCircle2, MapPin, 
	Plus, Lock, 
	Heart, ShieldCheck, 
	LogOut,
	BookOpen, HandHeart,
	Mic, FileText, PenLine, VideoIcon, CheckSquare,
	Trash2
} from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useCallback, use, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";

interface ProviderMatch {
    id: string;
    name: string;
    type: string;
    phone: string;
    address: string;
    description: string;
    availability: string;
    focus_groups: string[];
    professionalId?: string;
}

interface AppointmentData {
	id: string;
	appointment_date: string | null;
	status: string | null;
	type?: string;
	location?: string;
	link?: string;
}

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AudioPlayer } from "../../_components/AudioPlayer";
import { RichTextEditor } from "@/components/RichTextEditor";
import { VoiceRecorderInline } from "@/components/VoiceRecorderInline";
import { CaseChatPanel } from "@/components/chat/CaseChatPanel";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";

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
	const dash = useDashboardData();
	
	const [report, setReport] = useState<Tables<"reports"> | null>(null);
	const [allMatches, setAllMatches] = useState<ProviderMatch[]>([]);
	const [matchIndex, setMatchIndex] = useState(0);
	const [acceptedMatch, setAcceptedMatch] = useState<ProviderMatch | null>(null);
	
	const [loading, setLoading] = useState(true);
	const [errorState, setErrorState] = useState<string | null>(null);
	const [updating, setUpdating] = useState(false);
	const [newDetail, setNewDetail] = useState("");
	const [showAddDetails, setShowAddDetails] = useState(false);
	const [showVoiceRecorder, setShowVoiceRecorder] = useState(false);
	const [escalating, setEscalating] = useState(false);
	const [currentUserId, setCurrentUserId] = useState<string | null>(null);
	const [checklists, setChecklists] = useState<any[]>([]);
	const [newChecklistItem, setNewChecklistItem] = useState("");
	const [editingItemId, setEditingItemId] = useState<string | null>(null);
	const [editingTitle, setEditingTitle] = useState("");
	const [appointments, setAppointments] = useState<AppointmentData[]>([]);

	// Debounce timer for checklist notes
	const notesTimerRef = useRef<NodeJS.Timeout | null>(null);

	const needsOnboarding = useMemo(() => {
		const profile = dash?.data?.profile;
		if (!profile) return false;
		const hasAcceptedPolicies = !!(profile.policies as any)?.all_policies_accepted;
		return !profile.user_type || 
			!hasAcceptedPolicies ||
			((profile.user_type === 'professional' || profile.user_type === 'ngo') && !profile.professional_title);
	}, [dash?.data?.profile]);

	useEffect(() => {
		const getUser = async () => {
			const { data: { user } } = await supabase.auth.getUser();
			if (user) setCurrentUserId(user.id);
		};
		getUser();
	}, []);
	
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
				.select(`
					*,
					matched_services (
						id,
						match_status_type,
						match_reason,
						description,
						notes,
						support_service,
						survivor_id,
						service_details:support_services (
							id,
							user_id,
							name,
							phone_number,
							email,
							availability,
							specialises_in_children,
							specialises_in_disability,
							specialises_in_queer_support
						),
						hrd_details:profiles!matched_services_hrd_profile_id_fkey (
							id,
							first_name,
							last_name,
							phone,
							email,
							professional_title,
							bio
						)
					)
				`)
				.eq("report_id", reportId)
				.maybeSingle();

			if (error) {
				setErrorState(`Access limited: ${error.message}`);
				return;
			}

			if (data) {
				setReport(data as any);
				
				// Map real matches to our UI structure
				const matches: ProviderMatch[] = (data.matched_services as any[] || []).map(m => {
					const isService = !!m.service_details;
					const name = isService 
						? m.service_details.name 
						: `${m.hrd_details?.first_name || ''} ${m.hrd_details?.last_name || ''}`.trim() || 'Specialist';
					
					const type = isService ? m.support_service : m.hrd_details?.professional_title || 'Expert';
					const phone = isService ? m.service_details.phone_number : m.hrd_details?.phone;
					const availability = isService ? m.service_details.availability : 'Flexible';
					
					const focus_groups: string[] = [];
					if (isService && m.service_details) {
						if (m.service_details.specialises_in_children) focus_groups.push("Children");
						if (m.service_details.specialises_in_disability) focus_groups.push("Disability");
						if (m.service_details.specialises_in_queer_support) focus_groups.push("Queer");
					} else if (m.hrd_details?.professional_title === 'Human rights defender') {
						focus_groups.push("Human Rights");
					}
					
					const professionalId = isService ? m.service_details?.user_id : m.hrd_details?.id;

					return {
						id: m.id,
						name,
						type: (type as string)?.replace(/_/g, " ") || "Support Specialist",
						phone: phone || "Private",
						address: m.notes || "Contact for details",
						description: m.description || "Verified support provider ready to assist with your case.",
						availability: availability || "Flexible",
						focus_groups,
						professionalId
					};
				});

				setAllMatches(matches);
				if (data.administrative && ((data.administrative as any).checklist || (data.administrative as any).checklists)) {
					// Support both old 'checklists' (plural) key and new 'checklist' (singular) key
					const rawItems = (data.administrative as any).checklist || (data.administrative as any).checklists || [];
					// Normalize: map 'completed' -> 'done' for backward compatibility
					setChecklists(rawItems.map((c: any) => ({ ...c, completed: c.done ?? c.completed ?? false })));
				} else {
					setChecklists([
						{ id: "1", title: "Gather documentation", notes: "Collect any relevant emails or messages", completed: false },
						{ id: "2", title: "Review safety plan", notes: "Ensure secondary contacts are updated", completed: false }
					]);
				}

				// Fetch real appointments for matched services
				const matchIds = (data.matched_services as any[] || []).map((m: any) => m.id);
				if (matchIds.length > 0) {
					const { data: apptData } = await supabase
						.from("appointments")
						.select("*")
						.in("matched_services", matchIds)
						.order("appointment_date", { ascending: true });
					
					if (apptData) {
						setAppointments(apptData.map((a: any) => ({
							id: a.id,
							appointment_date: a.appointment_date,
							status: a.status,
							type: a.type || 'virtual',
							location: a.location,
							link: a.link
						})));
					}
				}
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

	const handleSaveChecklist = async (newLists: any[]) => {
		setChecklists(newLists);
		if (!report) return;
		// Save under 'checklist' (singular) to match sidepanel format and use 'done' property
		const normalizedLists = newLists.map(c => ({ id: c.id, title: c.title, notes: c.notes || '', done: c.completed ?? c.done ?? false }));
		const adminData = { ...(report.administrative as any || {}), checklist: normalizedLists };
		// Clean up legacy plural key if present
		delete adminData.checklists;
		await supabase.from('reports').update({ administrative: adminData }).eq('report_id', reportId);
	};

	const toggleChecklist = (id: string) => {
		const updated = checklists.map(c => c.id === id ? { ...c, completed: !c.completed, done: !(c.completed ?? c.done) } : c);
		handleSaveChecklist(updated);
	};

	const updateChecklistNotes = (id: string, notes: string) => {
		// Update local state immediately
		setChecklists(prev => prev.map(c => c.id === id ? { ...c, notes } : c));
		// Debounce the save
		if (notesTimerRef.current) clearTimeout(notesTimerRef.current);
		notesTimerRef.current = setTimeout(() => {
			const updated = checklists.map(c => c.id === id ? { ...c, notes } : c);
			handleSaveChecklist(updated);
		}, 500);
	};

	const startEditingTitle = (id: string, currentTitle: string) => {
		setEditingItemId(id);
		setEditingTitle(currentTitle);
	};

	const saveEditingTitle = () => {
		if (!editingItemId || !editingTitle.trim()) {
			setEditingItemId(null);
			return;
		}
		const updated = checklists.map(c => c.id === editingItemId ? { ...c, title: editingTitle.trim() } : c);
		handleSaveChecklist(updated);
		setEditingItemId(null);
		setEditingTitle("");
	};

	const deleteChecklistItem = (id: string) => {
		const updated = checklists.filter(c => c.id !== id);
		handleSaveChecklist(updated);
	};

	const addChecklistItem = () => {
		if (!newChecklistItem.trim()) return;
		const updated = [...checklists, { id: Date.now().toString(), title: newChecklistItem, notes: '', completed: false, done: false }];
		setNewChecklistItem("");
		handleSaveChecklist(updated);
	};

	const handleVoiceRecorded = async (blob: Blob) => {
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

	const acceptMatch = (provider: ProviderMatch) => {
		setAcceptedMatch(provider);
		toast({
			title: "Support Connection Active",
			description: `You can now securely coordinate with ${provider.name}.`,
		});
	};

	const handleEscalate = async () => {
		if (!report) return;
		setEscalating(true);
		try {
			const response = await fetch(`/api/reports/${reportId}/escalate`, {
				method: "POST",
			});
			if (!response.ok) throw new Error("Escalation failed");
			
			toast({
				title: "Help is on the way",
				description: "Your report has been escalated for matching support.",
			});
			fetchReport();
		} catch (err: any) {
			toast({
				title: "Error",
				description: err.message,
				variant: "destructive",
			});
		} finally {
			setEscalating(false);
		}
	};

	const exitSafely = () => {
		window.location.href = "https://www.google.com";
	};

	// Format date nicely
	const formatDate = (date: string | null) => {
		if (!date) return "";
		return new Date(date).toLocaleDateString("en-US", {
			weekday: "short",
			year: "numeric",
			month: "short",
			day: "numeric"
		});
	};

	const formatTime = (date: string | null) => {
		if (!date) return "";
		return new Date(date).toLocaleTimeString("en-US", {
			hour: "2-digit",
			minute: "2-digit"
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
				<Card className="max-w-md w-full border-serene-neutral-200 rounded-xl p-8 md:p-10 text-center shadow-sm">
					<div className="w-16 h-16 bg-serene-neutral-100 rounded-full flex items-center justify-center mx-auto mb-6">
						<FileText className="h-8 w-8 text-serene-neutral-400" />
					</div>
					<h2 className="text-xl font-bold text-sauti-dark mb-3">Connection Issue</h2>
					<p className="text-serene-neutral-500 mb-8 leading-relaxed">{errorState}</p>
					<div className="space-y-3">
						<Button onClick={() => window.location.reload()} className="w-full bg-sauti-teal hover:bg-sauti-teal/90 text-white rounded-xl h-12 font-semibold shadow-sm">
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

	const upcomingAppointments = appointments.filter(a => {
		if (!a.appointment_date) return false;
		return new Date(a.appointment_date) >= new Date();
	});
	const pastAppointments = appointments.filter(a => {
		if (!a.appointment_date) return false;
		return new Date(a.appointment_date) < new Date();
	});

	return (
		<div className="min-h-screen bg-serene-neutral-50 text-sauti-dark selection:bg-sauti-teal/20 pb-24 lg:pb-8">
			
			{/* Breadcrumb + Status Pills Row */}
			<nav className="sticky top-0 z-40 bg-white/80 backdrop-blur-lg border-b border-serene-neutral-200/60 transition-all duration-200">
				<div className="max-w-7xl mx-auto px-4 h-12 flex items-center justify-between gap-4">
					{/* Left: Breadcrumb path */}
					<div className="flex items-center gap-1.5 text-sm min-w-0">
						<Link href="/dashboard" className="text-serene-neutral-400 hover:text-sauti-teal transition-colors shrink-0">
							<svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
						</Link>
						<span className="text-serene-neutral-300">/</span>
						<Link href="/dashboard/reports" className="text-serene-neutral-500 hover:text-sauti-teal transition-colors font-medium truncate">
							Reports
						</Link>
						<span className="text-serene-neutral-300">/</span>
						<span className="font-bold text-sauti-dark truncate">
							{reportId.slice(0, 8).toUpperCase()}
						</span>
					</div>

					{/* Right: Status pills */}
					<div className="flex items-center gap-2 shrink-0">
						<Badge className="bg-sauti-teal/10 text-sauti-teal border-sauti-teal/20 font-bold text-[10px] uppercase tracking-wider">
							{report.type_of_incident?.replace(/_/g, " ") || "Report"}
						</Badge>
						{report.urgency && (
							<Badge className={cn(
								"font-bold text-[10px] uppercase tracking-wider",
								report.urgency === 'high' 
									? 'bg-rose-50 text-rose-600 border-rose-200' 
									: report.urgency === 'medium'
										? 'bg-amber-50 text-amber-600 border-amber-200'
										: 'bg-serene-neutral-100 text-serene-neutral-500 border-serene-neutral-200'
							)}>
								{report.urgency} Priority
							</Badge>
						)}
						{acceptedMatch && (
							<Badge className="bg-serene-green-100 text-serene-green-700 border-serene-green-100 font-bold text-[10px] uppercase tracking-wider">
								<CheckCircle2 className="h-3 w-3 mr-1" /> Matched
							</Badge>
						)}
					</div>
				</div>
			</nav>

			<main className="max-w-7xl mx-auto px-4 py-6 md:py-8 min-w-0">
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 min-w-0">
					
					{/* ===== LEFT COLUMN ===== */}
					<div className="lg:col-span-7 xl:col-span-8 flex flex-col gap-6 min-w-0">
						
						{/* SECTION 1: Case Summary Header */}
						<section className="space-y-4">
							<h1 className="text-2xl md:text-3xl font-bold text-sauti-dark tracking-tight">
								Your Support Journey
							</h1>
							
							<div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
								<Card className="border-serene-neutral-100 rounded-xl overflow-hidden">
									<CardContent className="p-3">
										<p className="text-[10px] font-bold text-serene-neutral-400 uppercase tracking-wider mb-1">Type</p>
										<p className="text-sm font-semibold text-sauti-dark capitalize truncate">
											{report.type_of_incident?.replace(/_/g, " ") || "Not specified"}
										</p>
									</CardContent>
								</Card>
								<Card className="border-serene-neutral-100 rounded-xl overflow-hidden">
									<CardContent className="p-3">
										<p className="text-[10px] font-bold text-serene-neutral-400 uppercase tracking-wider mb-1">Submitted</p>
										<p className="text-sm font-semibold text-sauti-dark truncate">
											{report.submission_timestamp ? new Date(report.submission_timestamp).toLocaleDateString() : "—"}
										</p>
									</CardContent>
								</Card>
								<Card className="border-serene-neutral-100 rounded-xl overflow-hidden">
									<CardContent className="p-3">
										<p className="text-[10px] font-bold text-serene-neutral-400 uppercase tracking-wider mb-1">Location</p>
										<p className="text-sm font-semibold text-sauti-dark truncate">
											{report.city || report.country || "Private"}
										</p>
									</CardContent>
								</Card>
								<Card className="border-serene-neutral-100 rounded-xl overflow-hidden">
									<CardContent className="p-3">
										<p className="text-[10px] font-bold text-serene-neutral-400 uppercase tracking-wider mb-1">Consent</p>
										<p className="text-sm font-semibold text-sauti-dark capitalize truncate">
											{report.consent || "Private"}
										</p>
									</CardContent>
								</Card>
							</div>
						</section>

						{/* SECTION: My Story */}
						<section className="space-y-4">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<BookOpen className="h-5 w-5 text-sauti-teal" />
									<h2 className="text-lg font-bold text-sauti-dark">My Story</h2>
								</div>
								<Button variant="ghost" size="sm" onClick={() => setShowAddDetails(!showAddDetails)} className="text-sauti-teal hover:bg-sauti-teal/10 font-semibold text-xs">
									<Plus className="h-4 w-4 mr-1" /> Add More
								</Button>
							</div>

							<Card className="border-serene-neutral-100 rounded-xl overflow-hidden">
								<CardContent className="p-5 md:p-6">
									{report.incident_description ? (
										<p className="text-serene-neutral-600 leading-relaxed whitespace-pre-wrap text-sm">{report.incident_description}</p>
									) : (
										<p className="text-serene-neutral-400 italic text-sm">You haven't shared your story yet. That's okay — you can add details whenever you feel ready.</p>
									)}
								</CardContent>
							</Card>

							{showAddDetails && (
								<Card className="border-sauti-teal/20 bg-sauti-teal/5 rounded-xl overflow-hidden animate-in slide-in-from-top-2 duration-300">
									<CardContent className="p-5 space-y-4">
										<Textarea 
											value={newDetail} onChange={(e) => setNewDetail(e.target.value)}
											placeholder="Tell us more about what's happening or what you need..."
											className="min-h-[100px] rounded-xl border-serene-neutral-200 focus:border-sauti-teal focus:ring-2 focus:ring-sauti-teal/10 p-4 text-sm resize-none"
										/>
										<div className="flex flex-col sm:flex-row gap-3">
											<Button variant="outline" onClick={() => setShowVoiceRecorder(!showVoiceRecorder)} className="h-10 rounded-xl border-serene-neutral-200 text-serene-neutral-600 font-semibold text-sm">
												<Mic className="h-4 w-4 mr-2" /> {showVoiceRecorder ? "Hide Recorder" : "Add Voice Note"}
											</Button>
											<div className="flex-1" />
											<Button onClick={handleAddDetail} disabled={updating || !newDetail.trim()} className="h-10 bg-sauti-teal hover:bg-sauti-teal/90 text-white font-semibold rounded-xl text-sm">
												{updating ? "Saving..." : "Add to Story"}
											</Button>
										</div>
										{showVoiceRecorder && <VoiceRecorderInline onRecorded={handleVoiceRecorded} onClose={() => setShowVoiceRecorder(false)} />}
									</CardContent>
								</Card>
							)}
						</section>

						{/* SECTION: Voice Recordings */}
						{audioFiles.length > 0 && (
							<section className="space-y-4">
								<div className="flex items-center gap-2">
									<Mic className="h-5 w-5 text-sauti-teal" />
									<h2 className="text-lg font-bold text-sauti-dark">Voice Recordings</h2>
								</div>
								<div className="space-y-3">
									{audioFiles.map((audio, index) => (
										<AudioPlayer key={index} src={audio.url} title={audio.title || `Recording ${index + 1}`} />
									))}
								</div>
							</section>
						)}

						{/* SECTION: Accountability Checklist (Fully Editable) */}
						<section className="space-y-3">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2">
									<CheckSquare className="h-5 w-5 text-sauti-teal" />
									<h2 className="text-lg font-bold text-sauti-dark">Accountability Tracker</h2>
								</div>
								<span className="text-xs text-serene-neutral-400 font-medium">
									{checklists.filter(c => c.completed).length}/{checklists.length} done
								</span>
							</div>
							<p className="text-xs text-serene-neutral-500">Track important steps in your journey. Click a title to edit it.</p>
							
							<Card className="border-serene-neutral-100 rounded-xl overflow-hidden">
								<CardContent className="p-0">
									{checklists.length > 0 ? (
										<Accordion type="multiple" className="w-full">
											{checklists.map((item) => (
												<AccordionItem key={item.id} value={item.id} className="border-b border-serene-neutral-100 last:border-0 px-4">
													<div className="flex items-center gap-3 w-full group">
														<Checkbox 
															checked={item.completed} 
															onCheckedChange={() => toggleChecklist(item.id)} 
															className="rounded-md border-serene-neutral-300 data-[state=checked]:bg-sauti-teal data-[state=checked]:border-sauti-teal h-4 w-4 flex-shrink-0"
														/>
														{editingItemId === item.id ? (
															<div className="flex-1 flex items-center gap-2 py-3">
																<Input
																	value={editingTitle}
																	onChange={(e) => setEditingTitle(e.target.value)}
																	onKeyDown={(e) => { if (e.key === 'Enter') saveEditingTitle(); if (e.key === 'Escape') setEditingItemId(null); }}
																	onBlur={saveEditingTitle}
																	autoFocus
																	className="h-8 text-sm border-serene-neutral-200 rounded-lg focus-visible:ring-sauti-teal/20"
																/>
															</div>
														) : (
															<AccordionTrigger className={cn("hover:no-underline flex-1 text-left py-3 text-sm", item.completed && "text-serene-neutral-400 line-through")}>
																<span 
																	className="cursor-text hover:text-sauti-teal transition-colors"
																	onClick={(e) => { e.stopPropagation(); startEditingTitle(item.id, item.title); }}
																>
																	{item.title}
																</span>
															</AccordionTrigger>
														)}
														<button 
															onClick={() => deleteChecklistItem(item.id)} 
															className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-serene-neutral-300 hover:text-rose-500"
															title="Delete item"
														>
															<Trash2 className="h-3.5 w-3.5" />
														</button>
													</div>
													<AccordionContent className="pb-4 pl-7">
														<Textarea
															value={item.notes || ""}
															onChange={(e) => updateChecklistNotes(item.id, e.target.value)}
															placeholder="Add private notes for this item..."
															className="text-sm rounded-lg border-serene-neutral-200 resize-none min-h-[70px] focus:ring-sauti-teal/20"
														/>
													</AccordionContent>
												</AccordionItem>
											))}
										</Accordion>
									) : (
										<div className="p-6 text-center text-sm text-serene-neutral-500 italic">
											No checklist items yet. Add one below.
										</div>
									)}
									
									<div className="p-3 border-t border-serene-neutral-100 bg-serene-neutral-50/50 flex gap-2">
										<Input 
											value={newChecklistItem}
											onChange={(e) => setNewChecklistItem(e.target.value)}
											placeholder="Add a new checklist item..."
											className="h-9 border-serene-neutral-200 rounded-lg bg-white shadow-sm flex-1 focus-visible:ring-sauti-teal/20 text-sm"
											onKeyDown={(e) => { if (e.key === 'Enter') addChecklistItem(); }}
										/>
										<Button size="icon" onClick={addChecklistItem} disabled={!newChecklistItem.trim()} className="h-9 w-9 shrink-0 bg-sauti-teal hover:bg-sauti-teal/90 rounded-lg text-white">
											<Plus className="h-4 w-4" />
										</Button>
									</div>
								</CardContent>
							</Card>
						</section>

						{/* SECTION: Private Journal — Always shown */}
						<section className="space-y-3">
							<div className="flex items-center gap-2">
								<PenLine className="h-5 w-5 text-sauti-teal" />
								<h2 className="text-lg font-bold text-sauti-dark">Private Journal</h2>
							</div>
							<p className="text-xs text-serene-neutral-500">Only you can see these notes. Use this space to reflect, plan, or record anything private.</p>
							<RichTextEditor content={report.notes || ""} onSave={handleSaveNotes} placeholder="Write your private notes here..." />
						</section>

						{/* Privacy Notice */}
						<Card className="bg-sauti-dark rounded-xl overflow-hidden">
							<CardContent className="p-5 text-white relative">
								<div className="absolute bottom-0 right-0 opacity-5 p-6"><Lock className="h-20 w-20" /></div>
								<div className="relative z-10 space-y-3">
									<h3 className="text-base font-bold flex items-center gap-2">
										<ShieldCheck className="h-5 w-5 text-sauti-teal" /> Your Safe Space
									</h3>
									<p className="text-serene-neutral-300 text-sm leading-relaxed">
										We only share your story with providers you choose to connect with. Your true identity stays hidden.
									</p>
								</div>
							</CardContent>
						</Card>

					</div>

					{/* ===== RIGHT COLUMN ===== */}
					<div className="lg:col-span-5 xl:col-span-4 flex flex-col gap-5 min-w-0 h-full">
						
						{/* Support Team Header */}
						{!acceptedMatch && (
							<div className="flex items-center gap-2">
								<HandHeart className="h-5 w-5 text-sauti-teal" />
								<h2 className="text-lg font-bold text-sauti-dark">Your Support Team</h2>
							</div>
						)}

						{/* Provider Match Content */}
						{report.record_only ? (
							<Card className="border-amber-200 bg-amber-50 rounded-xl shadow-sm">
								<CardContent className="p-5 flex flex-col items-center text-center space-y-4">
									<ShieldCheck className="h-8 w-8 text-amber-600" />
									<div className="space-y-2">
										<h3 className="text-base font-bold text-amber-900">Record-Only Space</h3>
										<p className="text-sm text-amber-800 leading-relaxed">Stored safely but not shared. Escalate to start matching.</p>
									</div>
									<Button onClick={handleEscalate} disabled={escalating} className="w-full h-10 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-md text-sm">
										{escalating ? "Requesting..." : "Request Match Now"}
									</Button>
								</CardContent>
							</Card>
						) : !acceptedMatch && currentMatch ? (
							<Card className="border-serene-neutral-100 rounded-xl hover:shadow-md transition-shadow">
								<CardContent className="p-5 space-y-4">
									<div className="flex flex-wrap gap-2">
										<Badge className="bg-serene-neutral-100 text-serene-neutral-600 border-0 font-bold text-[10px] uppercase">
											{currentMatch.type}
										</Badge>
										{currentMatch.focus_groups.map(fg => (
											<Badge key={fg} className="bg-sauti-teal/10 text-sauti-teal border-sauti-teal/20 font-bold text-[10px] uppercase">
												{fg}
											</Badge>
										))}
									</div>
									<div>
										<h3 className="text-lg font-bold text-sauti-dark mb-1">{currentMatch.name}</h3>
										<p className="text-sm text-serene-neutral-500 leading-relaxed">{currentMatch.description}</p>
									</div>
									<div className="grid grid-cols-2 gap-2">
										<div className="flex items-center gap-2 p-2.5 bg-serene-neutral-50 rounded-lg">
											<MapPin className="h-3.5 w-3.5 text-serene-neutral-400 shrink-0" />
											<p className="text-xs font-semibold text-serene-neutral-600 truncate">{currentMatch.address}</p>
										</div>
										<div className="flex items-center gap-2 p-2.5 bg-serene-neutral-50 rounded-lg">
											<Clock className="h-3.5 w-3.5 text-serene-neutral-400 shrink-0" />
											<p className="text-xs font-semibold text-serene-neutral-600 truncate">{currentMatch.availability}</p>
										</div>
									</div>
									<div className="flex gap-3">
										<Button onClick={() => acceptMatch(currentMatch)} className="flex-1 h-11 bg-sauti-teal hover:bg-sauti-teal/90 text-white font-bold rounded-xl shadow-md">
											<HandHeart className="h-4 w-4 mr-2" /> Connect
										</Button>
										<Button variant="outline" onClick={nextMatch} className="h-11 w-14 border-serene-neutral-200 font-bold rounded-xl">
											Next
										</Button>
									</div>
								</CardContent>
							</Card>
						) : acceptedMatch ? (
							<>
								{/* Accepted Match Card */}
								<Card className="border-2 border-sauti-teal bg-white rounded-xl overflow-hidden shadow-sm">
									<CardContent className="p-4 flex flex-col gap-4">
										<div className="flex items-center gap-3">
											<div className="w-10 h-10 bg-sauti-teal rounded-lg flex items-center justify-center text-white shrink-0">
												<CheckCircle2 className="h-5 w-5" />
											</div>
											<div className="flex-1 min-w-0">
												<p className="text-[10px] font-bold text-sauti-teal uppercase tracking-widest mb-0.5">Matched Team</p>
												<h3 className="text-sm font-bold text-sauti-dark truncate">{acceptedMatch.name}</h3>
												<p className="text-xs text-serene-neutral-500 truncate">{acceptedMatch.type}</p>
											</div>
										</div>
										<div className="flex gap-2">
											<Button size="sm" className="flex-1 rounded-lg bg-sauti-teal/10 text-sauti-teal hover:bg-sauti-teal hover:text-white shadow-none gap-1.5 h-9 font-bold hover:shadow-md transition-all text-xs">
												<Calendar className="h-3.5 w-3.5" /> Schedule
											</Button>
											<Button size="sm" variant="outline" className="flex-1 rounded-lg gap-1.5 h-9 border-serene-neutral-200 font-bold text-serene-neutral-600 hover:bg-serene-neutral-50 text-xs">
												<Phone className="h-3.5 w-3.5" /> Call Now
											</Button>
										</div>
										<button onClick={() => setAcceptedMatch(null)} className="text-[10px] font-bold text-serene-neutral-400 hover:text-rose-500 uppercase tracking-wider">
											Change provider
										</button>
									</CardContent>
								</Card>

								{/* Appointments Card — Real Data */}
								<Card className="border-serene-neutral-100 rounded-xl shadow-sm">
									<CardContent className="p-4">
										<div className="flex items-center justify-between mb-3">
											<div className="flex items-center gap-2">
												<Calendar className="h-4 w-4 text-sauti-teal" />
												<h3 className="text-sm font-bold text-sauti-dark">Appointments</h3>
											</div>
											{appointments.length > 0 && (
												<span className="text-[10px] font-bold text-serene-neutral-400 uppercase">
													{upcomingAppointments.length} upcoming
												</span>
											)}
										</div>
										{appointments.length === 0 ? (
											<div className="text-center py-6">
												<Calendar className="h-8 w-8 text-serene-neutral-200 mx-auto mb-2" />
												<p className="text-xs text-serene-neutral-400 font-medium">No appointments yet</p>
												<p className="text-xs text-serene-neutral-400 mt-1">Schedule your first session above</p>
											</div>
										) : (
											<div className="space-y-2">
												{[...upcomingAppointments, ...pastAppointments].slice(0, 4).map(appt => {
													const isUpcoming = appt.appointment_date ? new Date(appt.appointment_date) >= new Date() : false;
													return (
														<div key={appt.id} className="flex gap-3 p-2.5 rounded-lg border border-serene-neutral-100 bg-serene-neutral-50/50 hover:border-serene-neutral-200 transition-colors">
															<div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", isUpcoming ? "bg-sauti-teal/10 text-sauti-teal" : "bg-serene-neutral-200 text-serene-neutral-500")}>
																{appt.type === 'in-person' ? <MapPin className="h-4 w-4" /> : <VideoIcon className="h-4 w-4" />}
															</div>
															<div className="flex-1 min-w-0 flex flex-col justify-center">
																<p className="text-xs font-semibold text-sauti-dark">{isUpcoming ? 'Upcoming Session' : 'Past Session'}</p>
																<p className="text-[10px] text-serene-neutral-500 truncate mt-0.5">
																	{appt.appointment_date ? `${formatDate(appt.appointment_date)} · ${formatTime(appt.appointment_date)}` : "Date TBD"}
																</p>
															</div>
															{isUpcoming && (
																<Badge className="bg-sauti-teal/10 text-sauti-teal border-0 text-[9px] font-bold self-center h-5">
																	{appt.status || "Confirmed"}
																</Badge>
															)}
														</div>
													);
												})}
											</div>
										)}
									</CardContent>
								</Card>

								{/* Embedded Chat Interface */}
								{currentUserId && (
									<div className="flex-1 min-h-[450px] md:min-h-[500px] lg:sticky lg:top-20 rounded-xl border border-serene-neutral-200 shadow-lg overflow-hidden bg-white flex flex-col">
										<CaseChatPanel
											matchId={acceptedMatch.id}
											survivorId={currentUserId}
											professionalId={acceptedMatch.professionalId || ''}
											professionalName={acceptedMatch.name}
											survivorName={(report as any)?.first_name || "Myself"}
											className="h-full w-full rounded-none border-0 shadow-none !min-h-0"
										/>
									</div>
								)}
							</>
						) : (
							<Card className="border-dashed border-2 border-serene-neutral-200 rounded-xl bg-serene-neutral-50/50">
								<CardContent className="p-8 text-center">
									<div className="w-14 h-14 bg-serene-neutral-100 rounded-full flex items-center justify-center mx-auto mb-4">
										<HandHeart className="h-7 w-7 text-serene-neutral-400" />
									</div>
									<p className="text-serene-neutral-500 font-medium text-sm">Finding the right support for you...</p>
								</CardContent>
							</Card>
						)}
					</div>
				</div>
			</main>

			{/* Quick Exit — Fixed FAB */}
			<Button 
				onClick={exitSafely} 
				className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-50 bg-violet-350 hover:bg-red-600 text-white rounded-full h-10 px-4 shadow-lg font-bold text-xs gap-1.5"
			>
				<LogOut className="h-3.5 w-3.5" /> Quick Exit
			</Button>
		</div>
	);
}
