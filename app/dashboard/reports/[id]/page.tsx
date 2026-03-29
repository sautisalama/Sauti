"use client";

import { createClient } from "@/utils/supabase/client";
import { Tables, Json } from "@/types/db-schema";

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
	Trash2, MessageCircle, ChevronLeft, Sparkles, Activity, ArrowRight,
    Shield
} from "lucide-react";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { useState, useEffect, useCallback, use, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { AudioPlayer } from "../../_components/AudioPlayer";
import { RichTextEditor } from "@/components/RichTextEditor";
import { VoiceRecorderInline } from "@/components/VoiceRecorderInline";
import { CaseChatPanel } from "@/components/chat/CaseChatPanel";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { confirmAppointment, rescheduleAppointment } from "../../_views/actions/appointments";
import { EnhancedAppointmentScheduler } from "../../_components/EnhancedAppointmentScheduler";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface ProviderMatch {
    id: string;
    name: string;
    type: string;
    phone: string;
    address: string;
    description: string;
    availability: string;
    focus_groups: string[];
    professionalId?: string | null;
}


interface AppointmentData {
	id: string;
	appointment_date: string | null;
	status: string | null;
	type?: string;
	location?: string;
	link?: string;
}

// Type for media stored in reports
interface MediaFile {
	title?: string;
	url: string;
	type: string;
	size?: number;
	uploadedAt?: string;
}

interface ChecklistItem {
	id: string;
	title: string;
	notes?: string;
	completed: boolean;
	done?: boolean;
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
	const [checklists, setChecklists] = useState<ChecklistItem[]>([]);

	const [newChecklistItem, setNewChecklistItem] = useState("");
	const [editingItemId, setEditingItemId] = useState<string | null>(null);
	const [editingTitle, setEditingTitle] = useState("");
	const [appointments, setAppointments] = useState<AppointmentData[]>([]);

	// Debounce timer for checklist notes
	const notesTimerRef = useRef<NodeJS.Timeout | null>(null);
    const supabase = useMemo(() => createClient(), []);
	const { toast } = useToast();
	const router = useRouter();

	useEffect(() => {
		const getUser = async () => {
			const { data: { user } } = await supabase.auth.getUser();
			if (user) setCurrentUserId(user.id);
		};
		getUser();
	}, [supabase]);

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
				setReport(data as Tables<"reports">);

				
				// Map real matches to our UI structure
				const matchedServices = data.matched_services || [];
				const matches: ProviderMatch[] = (matchedServices as unknown[]).map(rawM => {
					const m = rawM as { 
						id: string; 
						match_status_type: string | null; 
						match_reason: string | null; 
						description: string | null; 
						notes: string | null; 
						support_service: string | null;
						service_details: Tables<"support_services"> | null;
						hrd_details: { 
							id: string; 
							first_name: string | null; 
							last_name: string | null; 
							phone: string | null; 
							email: string | null; 
							professional_title: string | null; 
							bio: string | null; 
						} | null;
					};

					const isService = !!m.service_details;
					const name = isService && m.service_details
						? m.service_details.name 
						: `${m.hrd_details?.first_name || ''} ${m.hrd_details?.last_name || ''}`.trim() || 'Specialist';
					
					const type = isService && m.service_details ? m.support_service : m.hrd_details?.professional_title || 'Expert';
					const phone = isService && m.service_details ? m.service_details.phone_number : m.hrd_details?.phone;
					const availability = isService && m.service_details ? m.service_details.availability : 'Flexible';
					
					const focus_groups: string[] = [];
					if (isService && m.service_details) {
						if (m.service_details.specialises_in_children) focus_groups.push("Children");
						if (m.service_details.specialises_in_disability) focus_groups.push("Disability");
						if (m.service_details.specialises_in_queer_support) focus_groups.push("Queer");
					} else if (m.hrd_details?.professional_title === 'Human rights defender') {
						focus_groups.push("Human Rights");
					}
					
					const professionalId = isService && m.service_details ? m.service_details.user_id : m.hrd_details?.id;


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
				if (data.administrative && typeof data.administrative === 'object') {
					const admin = data.administrative as Record<string, unknown>;
					const rawItems = (admin.checklist as ChecklistItem[]) || (admin.checklists as ChecklistItem[]) || [];
					setChecklists(rawItems.map((c) => ({ ...c, completed: c.done ?? c.completed ?? false })));

				} else {
					setChecklists([
						{ id: "1", title: "Gather documentation", notes: "Collect any relevant emails or messages", completed: false },
						{ id: "2", title: "Review safety plan", notes: "Ensure secondary contacts are updated", completed: false }
					]);
				}

				const matchIds = (data.matched_services as { id: string }[] || []).map((m) => m.id);

				if (matchIds.length > 0) {
					const { data: apptData } = await supabase
						.from("appointments")
						.select("*")
						.in("matched_services", matchIds)
						.order("appointment_date", { ascending: true });
					
					if (apptData) {
						setAppointments(apptData.map((a: Tables<"appointments">) => ({
							id: a.appointment_id,
							appointment_date: a.appointment_date,
							status: a.status,
							type: a.appointment_type || 'virtual',
							location: a.notes || '',
							link: ''
						})));
					}


				}
			} else {
				setErrorState("Journey details not found. Please verify the link.");
			}
		} catch (err: unknown) {
			const error = err as Error;
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
			toast({ title: "Unable to save", description: error.message, variant: "destructive" });
		} else {
			toast({ title: "Shared successfully", description: "Your additional details have been safely added." });
			setNewDetail("");
			setShowAddDetails(false);
			fetchReport();
		}
		setUpdating(false);
	};

	const handleSaveNotes = async (content: string) => {
		if (!report) return;
		const { error } = await supabase.from("reports").update({ notes: content }).eq("report_id", reportId);
		if (error) {
			toast({ title: "Unable to save notes", description: error.message, variant: "destructive" });
		} else {
			toast({ title: "Notes saved", description: "Your private notes have been saved securely." });
			fetchReport();
		}
	};

	const handleSaveChecklist = async (newLists: ChecklistItem[]) => {
		setChecklists(newLists);
		if (!report) return;
		const normalizedLists = newLists.map(c => ({ id: c.id, title: c.title, notes: c.notes || '', done: c.completed ?? c.done ?? false }));
		const adminData: Record<string, unknown> = { ...(report.administrative as Record<string, unknown> || {}), checklist: normalizedLists };
		if ('checklists' in adminData) {
			delete adminData['checklists'];
		}
		await supabase.from('reports').update({ administrative: adminData as unknown as Json }).eq('report_id', reportId);
	};




	const toggleChecklist = (id: string) => {
		const updated = checklists.map(c => c.id === id ? { ...c, completed: !c.completed, done: !(c.completed ?? c.done) } : c);
		handleSaveChecklist(updated);
	};

	const updateChecklistNotes = (id: string, notes: string) => {
		setChecklists(prev => prev.map(c => c.id === id ? { ...c, notes } : c));
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
		toast({ title: "Voice note received", description: "Uploading your recording..." });
		setShowVoiceRecorder(false);
	};

	const acceptMatch = (provider: ProviderMatch) => {
		setAcceptedMatch(provider);
		toast({ title: "Support Connection Active", description: `You can now securely coordinate with ${provider.name}.` });
	};

	const nextMatch = () => {
		setMatchIndex((prev) => (prev + 1) % allMatches.length);
	};

	const handleEscalate = async () => {
		if (!report) return;
		setEscalating(true);
		try {
			const response = await fetch(`/api/reports/${reportId}/escalate`, { method: "POST" });
			if (!response.ok) throw new Error("Escalation failed");
			toast({ title: "Help is on the way", description: "Your report has been escalated for matching support." });
			fetchReport();
		} catch (err: unknown) {
			const error = err as Error;
			toast({ title: "Error", description: error.message, variant: "destructive" });

		} finally {
			setEscalating(false);
		}
	};

	const exitSafely = () => { window.location.href = "https://www.google.com"; };

	const formatDate = (date: string | null) => {
		if (!date) return "";
		return new Date(date).toLocaleDateString("en-US", { weekday: "short", year: "numeric", month: "short", day: "numeric" });
	};

	const formatTime = (date: string | null) => {
		if (!date) return "";
		return new Date(date).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
	};

	const getStatusStyles = (status: string | null) => {
		switch (status?.toLowerCase()) {
			case 'matched': return 'bg-teal-50 text-teal-700 border-teal-100';
			case 'pending': return 'bg-sky-50 text-sky-700 border-sky-100';
			case 'confirmed': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
            case 'requested': return 'bg-amber-50 text-amber-700 border-amber-100 animate-pulse';
			default: return 'bg-slate-50 text-slate-500 border-slate-100';
		}
	};

	if (loading) {
		return (
			<div className="flex items-center justify-center min-h-screen bg-slate-50">
				<div className="flex flex-col items-center gap-6">
					<div className="relative">
						<div className="w-16 h-16 border-4 border-teal-100 border-t-teal-600 rounded-full animate-spin" />
						<Heart className="h-6 w-6 text-teal-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
					</div>
					<div className="text-center">
						<p className="text-xl font-bold text-slate-900">Entering Secure Space</p>
						<p className="text-slate-400 font-medium">Preparing your toolkit...</p>
					</div>
				</div>
			</div>
		);
	}

	if (errorState || !report) {
	    return (
			<div className="flex items-center justify-center min-h-screen bg-slate-50 p-6">
				<Card className="max-w-md w-full border-slate-200 rounded-3xl p-10 text-center shadow-xl bg-white">
					<div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-8">
						<Lock className="h-10 w-10 text-slate-300" />
					</div>
					<h2 className="text-2xl font-bold text-slate-900 mb-4">Secure Access Only</h2>
					<p className="text-slate-500 mb-10 leading-relaxed font-medium">{errorState || "Record not found."}</p>
					<Button asChild className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl h-14 shadow-lg">
						<Link href="/dashboard">Return to Dashboard</Link>
					</Button>
				</Card>
			</div>
		);
	}

	const upcomingAppointments = appointments.filter(a => a.appointment_date && new Date(a.appointment_date) >= new Date());

	return (
		<div className="min-h-screen bg-slate-50/50 pb-32 lg:pb-12 text-slate-900 selection:bg-teal-100">
			{/* Focused Header Navigation */}
			<nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 transition-all duration-300">
				<div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-6">
					<div className="flex items-center gap-4">
						<Link href="/dashboard/reports" className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-all text-slate-600">
							<ChevronLeft className="h-5 w-5" />
						</Link>
						<div className="hidden sm:block">
							<div className="flex items-center gap-2 text-teal-600 font-extrabold uppercase tracking-[0.2em] text-[10px] mb-0.5">
								<ShieldCheck className="h-3.5 w-3.5" />
								Secure Private Session
							</div>
							<h2 className="text-slate-900 font-bold tracking-tight">Report Journey SS-{reportId.slice(0, 8).toUpperCase()}</h2>
						</div>
					</div>

					<div className="flex items-center gap-3">
						<Badge className={cn("px-4 py-1.5 rounded-full text-[10px] font-bold border uppercase tracking-[0.2em]", getStatusStyles(report.match_status))}>
							{report.match_status || 'Under Review'}
						</Badge>
						<Button onClick={exitSafely} className="bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold rounded-xl px-4 h-10 border border-rose-100 transition-all text-xs gap-2">
							<LogOut className="h-4 w-4" /> Quick Exit
						</Button>
					</div>
				</div>
			</nav>

			<main className="max-w-7xl mx-auto px-6 py-12">
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
					
					{/* Main Content: Story & Recovery */}
					<div className="lg:col-span-8 space-y-12">
						
                        {/* Summary Section */}
						<div className="space-y-6">
							<div className="flex items-center gap-3">
								<Activity className="h-6 w-6 text-teal-600" />
								<h1 className="text-4xl font-bold tracking-tight text-slate-900">Healing Journey</h1>
							</div>
							<p className="text-lg text-slate-500 font-medium leading-relaxed max-w-2xl">
                                This is your private sanctuary. Share more about your experience when you're ready, track your healing steps, and record your private thoughts.
                            </p>
						</div>

						{/* My Story Card */}
						<Card className="border-0 bg-white shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden group">
							<CardHeader className="p-10 pb-0 border-0 bg-transparent flex flex-row items-center justify-between">
								<div className="flex items-center gap-4">
									<div className="w-12 h-12 bg-teal-50 rounded-2xl flex items-center justify-center text-teal-600">
										<BookOpen className="h-6 w-6" />
									</div>
									<div>
										<CardTitle className="text-2xl font-bold">Your Story</CardTitle>
										<p className="text-sm font-medium text-slate-400 mt-1">Shared with caring professionals</p>
									</div>
								</div>
								<Button variant="ghost" onClick={() => setShowAddDetails(!showAddDetails)} className="text-teal-600 hover:bg-teal-50 font-bold rounded-xl gap-2 transition-all">
									<Plus className="h-5 w-5" /> {showAddDetails ? "Cancel" : "Add Detail"}
								</Button>
							</CardHeader>
							<CardContent className="p-10 space-y-8">
								<div className="bg-slate-50/50 rounded-3xl p-8 border border-slate-50 leading-relaxed text-slate-600 font-medium text-lg italic relative">
                                    <div className="absolute top-4 left-4 text-teal-200/50 select-none"><span className="text-6xl font-serif">"</span></div>
									{report.incident_description || "Every story matters. You can start sharing yours whenever you're ready."}
                                    <div className="absolute bottom-4 right-4 text-teal-200/50 select-none"><span className="text-6xl font-serif">"</span></div>
								</div>

								{showAddDetails && (
									<div className="space-y-4 animate-in slide-in-from-top-4 fade-in duration-500">
										<Textarea 
											value={newDetail} onChange={(e) => setNewDetail(e.target.value)}
											placeholder="Add more details to your story (e.g., feelings, timelines, needs)..."
											className="min-h-[160px] rounded-[2rem] border-slate-100 bg-white focus:border-teal-400 focus:ring-0 p-8 text-lg font-medium shadow-inner"
										/>
										<div className="flex flex-col sm:flex-row gap-4">
											<Button variant="outline" onClick={() => setShowVoiceRecorder(!showVoiceRecorder)} className="h-14 rounded-2xl border-slate-100 text-slate-600 font-bold text-base px-8 hover:bg-slate-50">
												<Mic className="h-5 w-5 mr-3" /> {showVoiceRecorder ? "Hide Recorder" : "Voice Note"}
											</Button>
											<div className="flex-1" />
											<Button onClick={handleAddDetail} disabled={updating || !newDetail.trim()} className="h-14 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl px-12 text-base shadow-xl shadow-teal-600/20 transition-all hover:scale-[1.02]">
												{updating ? "Saving..." : "Update Story"}
											</Button>
										</div>
										{showVoiceRecorder && <div className="mt-4"><VoiceRecorderInline onRecorded={handleVoiceRecorded} onClose={() => setShowVoiceRecorder(false)} /></div>}
									</div>
								)}

								{audioFiles.length > 0 && (
									<div className="space-y-4 pt-4">
										<h4 className="font-bold text-slate-900 flex items-center gap-2 mb-4">
											<Mic className="h-5 w-5 text-teal-500" />
											Voice Records
										</h4>
										<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
											{audioFiles.map((audio, index) => (
												<div key={index} className="bg-slate-50 border border-slate-100 rounded-2xl transition-all hover:shadow-md">
													<AudioPlayer src={audio.url} title={audio.title || `Recording ${index + 1}`} />
												</div>
											))}
										</div>
									</div>
								)}
							</CardContent>
						</Card>

						{/* Accountability Recovery Tracker */}
						<div className="space-y-6">
							<div className="flex items-center justify-between px-2">
								<div className="flex items-center gap-4">
									<div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600">
										<CheckSquare className="h-5 w-5" />
									</div>
									<h2 className="text-2xl font-bold tracking-tight">Recovery Tracker</h2>
								</div>
								<span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white border border-slate-100 px-4 py-1.5 rounded-full shadow-sm">
									{checklists.filter(c => c.completed).length}/{checklists.length} Steps Taken
								</span>
							</div>

							<Card className="border-0 bg-white shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden">
								<CardContent className="p-0">
									{checklists.map((item, idx) => (
										<div key={item.id} className={cn("group transition-all duration-300", idx < checklists.length - 1 && "border-b border-slate-50")}>
											<div className="p-8 hover:bg-teal-50/10 transition-colors">
												<div className="flex items-start gap-6">
													<Checkbox 
														checked={item.completed} 
														onCheckedChange={() => toggleChecklist(item.id)} 
														className="h-6 w-6 rounded-lg border-2 border-slate-200 data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600 transition-all mt-1"
													/>
													<div className="flex-1 min-w-0">
														<div className="flex items-center justify-between gap-4 mb-2">
															{editingItemId === item.id ? (
																<Input
																	value={editingTitle}
																	onChange={(e) => setEditingTitle(e.target.value)}
																	onKeyDown={(e) => { if (e.key === 'Enter') saveEditingTitle(); if (e.key === 'Escape') setEditingItemId(null); }}
																	onBlur={saveEditingTitle} autoFocus
																	className="h-9 text-lg font-bold border-teal-200 rounded-xl focus-visible:ring-0 focus-visible:border-teal-400 bg-white shadow-sm"
																/>
															) : (
																<h4 className={cn("text-xl font-bold transition-all cursor-text hover:text-teal-600", item.completed ? "text-slate-300 line-through" : "text-slate-800")}
																	onClick={() => startEditingTitle(item.id, item.title)}>
																	{item.title}
																</h4>
															)}
															<button onClick={() => deleteChecklistItem(item.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-rose-500 transition-all">
																<Trash2 className="h-4 w-4" />
															</button>
														</div>
														<Textarea
															value={item.notes || ""}
															onChange={(e) => updateChecklistNotes(item.id, e.target.value)}
															placeholder="Private recovery notes for this step..."
															className="text-base text-slate-400 font-medium bg-transparent border-0 focus-visible:ring-0 p-0 resize-none min-h-[40px] focus:text-slate-600"
														/>
													</div>
												</div>
											</div>
										</div>
									))}
									<div className="p-8 bg-slate-50/50 flex gap-4 border-t border-slate-100">
										<Input 
											value={newChecklistItem}
											onChange={(e) => setNewChecklistItem(e.target.value)}
											placeholder="Add a new healing milestone..."
											className="h-14 border-slate-100 rounded-2xl bg-white shadow-sm flex-1 focus-visible:ring-teal-400/20 text-lg font-medium px-6"
											onKeyDown={(e) => { if (e.key === 'Enter') addChecklistItem(); }}
										/>
										<Button size="icon" onClick={addChecklistItem} disabled={!newChecklistItem.trim()} className="h-14 w-14 shrink-0 bg-teal-600 hover:bg-teal-700 rounded-2xl text-white shadow-xl shadow-teal-600/20 transition-all active:scale-95">
											<Plus className="h-6 w-6" />
										</Button>
									</div>
								</CardContent>
							</Card>
						</div>

						{/* Healing Journal */}
						<div className="space-y-6">
							<div className="flex items-center gap-4 px-2">
								<div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center text-violet-600">
									<PenLine className="h-5 w-5" />
								</div>
								<h2 className="text-2xl font-bold tracking-tight">Healing Journal</h2>
							</div>
							<p className="text-base text-slate-400 font-medium leading-relaxed px-2">Only you can access this journal. Capture your private reflections, progress, and goals.</p>
							<div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border-0 p-2 overflow-hidden">
								<RichTextEditor content={report.notes || ""} onSave={handleSaveNotes} placeholder="Reflect on your progress here..." />
							</div>
						</div>
					</div>

					{/* Sidebar: Coordination & Support */}
					<div className="lg:col-span-4 space-y-10 lg:sticky lg:top-32">
						
                        {/* Status Card */}
                        <Card className="border-0 bg-teal-600 shadow-2xl shadow-teal-600/30 rounded-[2.5rem] overflow-hidden group">
							<CardContent className="p-10 relative">
                                <Sparkles className="absolute -top-4 -right-4 h-24 w-24 text-white/5 group-hover:rotate-12 transition-transform duration-700" />
                                <div className="space-y-6 relative">
                                    <div className="flex items-center gap-3 text-white/80 font-bold uppercase tracking-[0.2em] text-[10px]">
                                        <Shield className="h-4 w-4" />
                                        Safety Indicator
                                    </div>
                                    <h3 className="text-3xl font-bold text-white tracking-tight">Private Space</h3>
                                    <p className="text-teal-50/80 font-medium text-base leading-relaxed">
                                        Your identity is fully protected. Profiles are only shared when you choose to connect.
                                    </p>
                                    <div className="pt-4 border-t border-white/10 flex items-center gap-4">
                                        <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur-md">
                                            <Lock className="text-white h-5 w-5" />
                                        </div>
                                        <div className="text-[11px] font-bold text-teal-100 uppercase tracking-widest leading-tight">
                                            End-to-End<br />Encrypted Journey
                                        </div>
                                    </div>
                                </div>
							</CardContent>
						</Card>

						{/* Support Connection Card */}
						{report.record_only ? (
							<Card className="border-0 bg-white shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden">
								<CardContent className="p-10 text-center space-y-6">
									<div className="w-20 h-20 bg-amber-50 rounded-[2rem] flex items-center justify-center mx-auto mb-2 text-amber-600">
										<Sparkles className="h-10 w-10" />
									</div>
									<div className="space-y-3">
										<h3 className="text-xl font-bold text-slate-900 tracking-tight">Record-Only Space</h3>
										<p className="text-slate-400 font-medium leading-relaxed">Your story is saved safely. Toggle escalation to find professional matches.</p>
									</div>
									<Button onClick={handleEscalate} disabled={escalating} className="w-full h-14 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-2xl shadow-lg shadow-amber-500/20 text-base transition-all hover:scale-[1.02]">
										{escalating ? "Requesting Connection..." : "Find Support Matches"}
									</Button>
								</CardContent>
							</Card>
						) : !acceptedMatch && currentMatch ? (
							<Card className="border-0 bg-white shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden animate-in fade-in zoom-in-95 duration-500">
                                <CardHeader className="p-10 pb-0 flex flex-row items-center justify-between">
                                    <div className="flex items-center gap-2">
                                        <HandHeart className="h-5 w-5 text-teal-600" />
                                        <h3 className="text-xl font-bold tracking-tight">Partner Ready</h3>
                                    </div>
                                    <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Match {matchIndex + 1}/{allMatches.length}</div>
                                </CardHeader>
								<CardContent className="p-10 space-y-6">
									<div className="flex flex-wrap gap-2 mb-2">
										<Badge className="bg-slate-50 text-slate-500 border-0 font-bold text-[10px] uppercase tracking-widest px-4 py-1.5">{currentMatch.type}</Badge>
										{currentMatch.focus_groups.map(fg => <Badge key={fg} className="bg-teal-50 text-teal-700 border-0 font-bold text-[10px] uppercase tracking-widest px-4 py-1.5">{fg}</Badge>)}
									</div>
									<div className="space-y-3">
										<h3 className="text-2xl font-bold text-slate-900 tracking-tight">{currentMatch.name}</h3>
										<p className="text-base text-slate-500 font-medium leading-relaxed">{currentMatch.description}</p>
									</div>
									<div className="grid grid-cols-1 gap-3">
										<div className="flex items-center gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-50">
											<MapPin className="h-5 w-5 text-slate-400 shrink-0" />
											<p className="text-sm font-bold text-slate-600 truncate">{currentMatch.address || "Location Private"}</p>
										</div>
										<div className="flex items-center gap-4 p-5 bg-slate-50 rounded-2xl border border-slate-50">
											<Clock className="h-5 w-5 text-slate-400 shrink-0" />
											<p className="text-sm font-bold text-slate-600 truncate">{currentMatch.availability}</p>
										</div>
									</div>
									<div className="flex gap-4 pt-4">
										<Button onClick={() => acceptMatch(currentMatch)} className="flex-1 h-14 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl shadow-xl shadow-teal-600/20 text-base transition-all hover:scale-[1.02]">
											Connect Now
										</Button>
										{allMatches.length > 1 && (
                                            <Button variant="outline" onClick={nextMatch} className="h-14 w-14 border-slate-100 rounded-2xl text-slate-400 hover:text-teal-600 hover:bg-slate-50 shadow-sm transition-all active:scale-95">
                                                <ArrowRight className="h-6 w-6" />
                                            </Button>
                                        )}
									</div>
								</CardContent>
							</Card>
						) : acceptedMatch ? (
							<div className="space-y-8 animate-in fade-in slide-in-from-right-8 duration-500">
								<Card className="border-0 bg-white shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden">
									<CardContent className="p-10 flex flex-col gap-8">
										<div className="flex items-center gap-6">
											<Avatar className="h-20 w-20 rounded-3xl border-4 border-white shadow-xl">
												<AvatarFallback className="bg-teal-50 text-teal-600 text-2xl font-bold">
													{acceptedMatch.name.charAt(0)}
												</AvatarFallback>
											</Avatar>
											<div className="flex-1 min-w-0">
												<div className="flex items-center gap-2 text-teal-600 font-bold uppercase tracking-[0.2em] text-[9px] mb-1">
                                                    <CheckCircle2 className="h-3 w-3" /> Partner Active
                                                </div>
												<h3 className="text-2xl font-bold text-slate-900 truncate tracking-tight">{acceptedMatch.name}</h3>
												<p className="text-sm font-bold text-slate-400 uppercase tracking-widest">{acceptedMatch.type}</p>
											</div>
										</div>
                                        
                                        {upcomingAppointments.length > 0 ? (
                                            <div className="space-y-4">
                                                {upcomingAppointments.map((appt) => (
                                                    <div key={appt.id} className={cn(
                                                        "rounded-3xl border p-6 space-y-4 transition-all duration-300",
                                                        appt.status === 'requested' 
                                                            ? "bg-amber-50 border-amber-200 shadow-lg shadow-amber-200/20" 
                                                            : "bg-teal-50/50 border-teal-50"
                                                    )}>
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center gap-3 text-slate-900 font-bold text-sm">
                                                                <Calendar className={cn("h-5 w-5", appt.status === 'requested' ? "text-amber-600" : "text-teal-600")} />
                                                                {appt.status === 'requested' ? "Proposed Session" : "Session Scheduled"}
                                                            </div>
                                                            {appt.status === 'requested' && (
                                                                <Badge className="bg-amber-100 text-amber-700 border-0 text-[9px] uppercase tracking-widest px-2">Action Needed</Badge>
                                                            )}
                                                        </div>
                                                        <div className="space-y-1">
                                                            <p className="text-2xl font-bold text-slate-900 tracking-tight">{formatDate(appt.appointment_date)}</p>
                                                            <p className="text-base text-slate-500 font-bold tracking-widest uppercase">{formatTime(appt.appointment_date)}</p>
                                                        </div>

                                                        {appt.status === 'requested' && (
                                                            <div className="flex gap-2 pt-2">
                                                                <Button 
                                                                    className="flex-1 bg-amber-600 hover:bg-amber-700 text-white rounded-xl h-10 text-xs font-bold shadow-md shadow-amber-600/20"
                                                                    onClick={async () => {
                                                                        try {
                                                                            setUpdating(true);
                                                                            await confirmAppointment(appt.id);
                                                                            toast({ title: "Appointment confirmed", description: "Your support session is locked in." });
                                                                            fetchReport();
                                                                        } catch {
                                                                            toast({ title: "Error", description: "Failed to confirm session.", variant: "destructive" });
                                                                        } finally {
                                                                            setUpdating(false);
                                                                        }
                                                                    }}
                                                                >
                                                                    Confirm
                                                                </Button>
                                                                <Dialog>
                                                                    <DialogTrigger asChild>
                                                                        <Button variant="outline" className="flex-1 border-amber-200 text-amber-700 hover:bg-amber-100 rounded-xl h-10 text-xs font-bold">
                                                                            Reschedule
                                                                        </Button>
                                                                    </DialogTrigger>
                                                                    <DialogContent className="sm:max-w-md rounded-[2rem] border-0 shadow-2xl overflow-hidden p-0">
                                                                        <div className="p-8">
                                                                            <DialogHeader className="mb-6">
                                                                                <DialogTitle className="text-2xl font-bold text-slate-900">Choose New Time</DialogTitle>
                                                                                <DialogDescription className="text-slate-500 font-medium">
                                                                                    Select a new slot that works for you. 
                                                                                    {currentMatch?.availability && ` Available: ${currentMatch.availability}`}
                                                                                </DialogDescription>
                                                                            </DialogHeader>
                                                                            
                                                                            <EnhancedAppointmentScheduler
                                                                                userId={currentUserId || ""}
                                                                                providerId={currentMatch?.professionalId || ""}
                                                                                isOpen={true}
                                                                                onClose={() => {}}
                                                                                onSchedule={async (data) => {
                                                                                    try {
                                                                                        setUpdating(true);
                                                                                        await rescheduleAppointment(appt.id, data.date.toISOString(), data.notes);
                                                                                        toast({ title: "Reschedule requested", description: "We've sent your request to the professional." });
                                                                                        fetchReport();
                                                                                    } catch {
                                                                                        toast({ title: "Error", description: "Failed to request reschedule.", variant: "destructive" });
                                                                                    } finally {
                                                                                        setUpdating(false);
                                                                                    }
                                                                                }}
                                                                                defaultAvailability={currentMatch?.availability || "24/7"}
                                                                            />
                                                                        </div>
                                                                    </DialogContent>
                                                                </Dialog>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="bg-slate-50/50 rounded-3xl border border-slate-50 p-6 lg:p-8 text-center space-y-3">
                                                <Calendar className="h-8 w-8 text-slate-200 mx-auto" />
                                                <p className="text-sm font-bold text-slate-400">Ready to Schedule</p>
                                            </div>
                                        )}

										<div className="grid grid-cols-2 gap-4">
											<Button className="h-14 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl shadow-xl shadow-teal-600/20 text-sm transition-all hover:scale-[1.02]">
												Coordination
											</Button>
											<Button variant="outline" className="h-14 border-slate-100 rounded-2xl font-bold text-slate-600 hover:bg-slate-50 text-sm shadow-sm">
												Contact
											</Button>
										</div>
                                        <button onClick={() => setAcceptedMatch(null)} className="text-[10px] font-bold text-slate-300 hover:text-rose-500 uppercase tracking-[0.25em] transition-colors text-center w-full">
                                            Switch Coordination Partner
                                        </button>
									</CardContent>
								</Card>

								{currentUserId && (
									<div className="h-[600px] rounded-[2.5rem] border-0 shadow-2xl shadow-slate-200/50 overflow-hidden bg-white flex flex-col group">
										<div className="p-6 border-b border-slate-50 bg-white flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-serene-green-400 shadow-[0_0_12px_rgba(72,187,120,0.4)] animate-pulse" />
                                            <span className="text-sm font-bold text-slate-900">Secure Channel Open</span>
                                        </div>
                                        <div className="flex-1">
                                            <CaseChatPanel
                                                matchId={acceptedMatch.id}
                                                survivorId={currentUserId}
                                                professionalId={acceptedMatch.professionalId || ''}
                                                professionalName={acceptedMatch.name}
                                                survivorName={report.first_name || "Myself"}

                                                className="h-full w-full rounded-none border-0 shadow-none !min-h-0"
                                            />
                                        </div>
									</div>
								)}
							</div>
						) : (
							<Card className="border-2 border-dashed border-slate-200 rounded-[2.5rem] bg-slate-50/30 p-16 text-center space-y-6">
								<div className="w-20 h-20 bg-white rounded-[2rem] flex items-center justify-center mx-auto shadow-sm">
									<HandHeart className="h-8 w-8 text-slate-200" />
								</div>
								<div className="space-y-2">
                                    <h3 className="text-xl font-bold text-slate-400 tracking-tight">Support Search Active</h3>
                                    <p className="text-sm text-slate-400 font-medium leading-relaxed italic">Searching for matched professionals...</p>
                                </div>
							</Card>
						)}

                        {/* Trauma Informed Tips */}
                        <div className="p-10 bg-white border border-slate-100 rounded-[2.5rem] shadow-xl shadow-slate-100/50 space-y-6">
                            <div className="flex items-center gap-4 text-teal-600">
                                <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center">
                                    <Sparkles className="h-5 w-5" />
                                </div>
                                <h4 className="font-bold text-xl tracking-tight text-slate-800">Supportive Hint</h4>
                            </div>
                            <p className="text-base text-slate-500 leading-relaxed font-medium">
                                Sharing more details helps partners prepare better for your session. Feel free to use the voice recorder if typing is difficult.
                            </p>
                        </div>
					</div>

				</div>
			</main>
		</div>
	);
}
