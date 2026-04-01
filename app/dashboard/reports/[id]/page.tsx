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
import { Chat } from "@/types/chat";
import { getCaseChat } from "@/app/actions/chat";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { confirmAppointment, rescheduleAppointment } from "../../_views/actions/appointments";
import { syncReportStatus } from "@/app/actions/matching";
import { EnhancedAppointmentScheduler } from "../../_components/EnhancedAppointmentScheduler";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getReportStatus, getStatusTheme } from "@/lib/utils/case-status";
import { ReportWithRelations } from "../../_types";

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
    status: string | null;
    feedback?: string | null;
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
	const [activeChat, setActiveChat] = useState<Chat | null>(null);
	const [isChatLoading, setIsChatLoading] = useState(false);
	const [completing, setCompleting] = useState(false);
	const [showResponseModal, setShowResponseModal] = useState(false);
	const [respondingTo, setRespondingTo] = useState<AppointmentData | null>(null);

	// Debounce timer for checklist notes
	const notesTimerRef = useRef<NodeJS.Timeout | null>(null);
    const supabase = useMemo(() => createClient(), []);
	const { toast } = useToast();
	const router = useRouter();




	const fetchReport = useCallback(async () => {
		try {
			const { data, error } = await supabase
				.from("reports")
				.select(`
					*,
					matched_services (
						*,
						service_details:support_services!matched_services_service_id_fkey (
							*
						),
						appointments:appointments!appointments_matched_services_fkey (
							*
						),
						hrd_details:profiles!matched_services_hrd_profile_id_fkey (
							*
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
				setReport(data as ReportWithRelations);

				
				// Map real matches to our UI structure
				const matchedServices = data.matched_services || [];
				const matches: ProviderMatch[] = (matchedServices as unknown[]).map(rawM => {
					const m = rawM as { 
						id: string; 
						match_status_type: string | null; 
						match_reason: string | null; 
						description: string | null; 
						notes: string | null; 
						feedback: string | null;
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
						professionalId,
						status: m.match_status_type,
						feedback: m.feedback
					};
				});

				setAllMatches(matches);
				const accepted = matches.find(m => m.status === 'accepted' || m.status === 'completed');
				if (accepted) {
					setAcceptedMatch(accepted);
					
					// Fetch chat for the accepted match
					const { data: { user } } = await supabase.auth.getUser();
					if (user) {
						setIsChatLoading(true);
						getCaseChat(accepted.id, user.id)
							.then(chat => setActiveChat(chat))
							.catch(err => console.error("Chat load failed", err))
							.finally(() => setIsChatLoading(false));
					}
				}

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
				setErrorState("Report not found.");
			}
		} catch (err: unknown) {
			setErrorState("A connection issue occurred.");
		} finally {
			setLoading(false);
		}
	}, [reportId, supabase]);




    useEffect(() => {
		const getUser = async () => {
			const { data: { user } } = await supabase.auth.getUser();
			if (user) setCurrentUserId(user.id);
		};
		getUser();
		fetchReport();

        // Subscribe to real-time updates for this report
        const reportChannel = supabase
            .channel(`report-main-${reportId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'reports',
                    filter: `report_id=eq.${reportId}`
                },
                () => {
                    console.log("Report table changed, refetching...");
                    fetchReport();
                }
            )
            .subscribe();

        // Subscribe to real-time updates for this report's matches
        const channel = supabase
            .channel(`report-matches-${reportId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'matched_services',
                    filter: `report_id=eq.${reportId}`
                },
                () => {
                    fetchReport();
                }
            )
            .subscribe();

        // Subscribe to real-time updates for appointments linked to this report's matches
        const appointmentChannel = supabase
            .channel(`report-appointments-${reportId}`)
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'appointments'
                },
                () => {
                    fetchReport();
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(reportChannel);
            supabase.removeChannel(channel);
            supabase.removeChannel(appointmentChannel);
        };
	}, [supabase, reportId, fetchReport]);


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

	const handleComplete = async () => {
		if (!acceptedMatch || !report) return;
		setCompleting(true);
		try {
			const { error } = await supabase
				.from("matched_services")
				.update({ match_status_type: "completed", completed_at: new Date().toISOString() })
				.eq("id", acceptedMatch.id);
			if (error) throw error;
            
            // Sync report status
            await supabase
                .from("reports")
                .update({ match_status: "completed" })
                .eq("report_id", reportId);

			toast({ title: "Case Completed", description: "You have finalized this healing journey." });
			fetchReport();
		} catch (err: any) {
			toast({ title: "Update failed", description: err.message, variant: "destructive" });
		} finally {
			setCompleting(false);
		}
	};

	const currentMatch = allMatches[matchIndex];

	// Parse media from report
	const getMediaFiles = (): MediaFile[] => {
		if (!report?.media) return [];
		try {
			const mediaData = typeof report.media === "string" 
				? JSON.parse(report.media) 
				: report.media;
			return Array.isArray(mediaData) ? mediaData : [mediaData];
		} catch {
			return [];
		}
	};

	const audioFiles = getMediaFiles().filter((m) => m.type?.startsWith("audio"));


	const handleSaveChecklist = async (newLists: ChecklistItem[]) => {
		// UI is updated before this call (optimistic)
		if (!report) return;
		const normalizedLists = newLists.map(c => ({ 
            id: c.id, 
            title: c.title, 
            notes: c.notes || '', 
            done: c.completed ?? c.done ?? false 
        }));
        
		const adminData: Record<string, unknown> = { 
            ...(report.administrative as Record<string, unknown> || {}), 
            checklist: normalizedLists 
        };
        
		if ('checklists' in adminData) {
			delete adminData['checklists'];
		}
        
		const { error } = await supabase
            .from('reports')
            .update({ administrative: adminData as unknown as Json })
            .eq('report_id', reportId);
            
        if (error) {
            toast({ 
                title: "Sync failed", 
                description: "Your checklist changes could not be saved to the cloud.",
                variant: "destructive"
            });
            // Re-fetch to sync back to server state
            fetchReport();
        }
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
    const displayStatus = getReportStatus(report as ReportWithRelations);

	return (
		<div className="min-h-screen bg-slate-50/50 pb-32 lg:pb-12 text-slate-900 selection:bg-teal-100">
			{/* Focused Header Navigation - Unified with Case View */}
			<nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 transition-all duration-300">
				<div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-6">
					<div className="flex items-center gap-4">
						<Link href="/dashboard/reports" className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-all text-slate-600">
							<ChevronLeft className="h-5 w-5" />
						</Link>
						<div className="hidden sm:block">
							<div className="flex items-center gap-2 text-teal-600 font-extrabold uppercase tracking-[0.2em] text-[10px] mb-0.5">
								<ShieldCheck className="h-3.5 w-3.5" />
								Secure Journey Hub
							</div>
							<h2 className="text-slate-900 font-bold tracking-tight uppercase">
                                {report?.type_of_incident?.replace(/_/g, " ") || "Incident Report"}
                            </h2>
						</div>
					</div>

					<div className="flex items-center gap-3">
                        <Badge className={cn("px-4 py-1.5 rounded-full text-[10px] font-bold border uppercase tracking-[0.2em] whitespace-nowrap shadow-sm", getStatusTheme(displayStatus))}>
                            {displayStatus}
                        </Badge>
                        <div className="h-6 w-px bg-slate-100 mx-2 hidden lg:block" />
						<Button onClick={exitSafely} variant="ghost" className="text-slate-400 hover:text-rose-500 font-bold text-[10px] gap-2 uppercase tracking-widest">
							<LogOut className="h-4 w-4" /> Quick Exit
						</Button>
					</div>
				</div>
			</nav>

			<main className="max-w-7xl mx-auto px-6 py-12">
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
					
					{/* Main Content: Story & Recovery */}
					<div className="lg:col-span-8 space-y-12">
						
                        <div className="space-y-6">
							<div className="flex items-center gap-3">
								<Activity className="h-6 w-6 text-teal-600" />
								<h1 className="text-4xl font-black tracking-tight text-slate-900 uppercase">Healing Journey</h1>
							</div>

                            <div className="flex flex-wrap items-center gap-8 py-4 px-6 bg-white border border-slate-100 rounded-3xl shadow-sm">
                                <div className="flex items-center gap-3 group">
                                    <div className="w-10 h-10 bg-teal-50 rounded-2xl flex items-center justify-center text-teal-600 shadow-sm shrink-0">
                                        <Heart className="h-5 w-5" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Journal Profile</p>
                                        <p className="text-sm font-bold text-slate-700 tracking-tight">{(report?.first_name || 'Anonymous').toUpperCase()}</p>
                                    </div>
                                </div>

                                <div className="h-8 w-px bg-slate-100 hidden sm:block" />

                                <div className="flex items-center gap-3 group">
                                    <div className="w-10 h-10 bg-sky-50 rounded-2xl flex items-center justify-center text-sky-600 shadow-sm shrink-0">
                                        <Calendar className="h-5 w-5" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Record Date</p>
                                        <p className="text-sm font-bold text-slate-700 tracking-tight">{formatDate(report?.submission_timestamp)}</p>
                                    </div>
                                </div>

                                <div className="h-8 w-px bg-slate-100 hidden sm:block" />

                                <div className="flex items-center gap-3 group">
                                    <div className="w-10 h-10 bg-violet-50 rounded-2xl flex items-center justify-center text-violet-600 shadow-sm shrink-0">
                                        <Activity className="h-5 w-5" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none">Current Phase</p>
                                        <p className="text-sm font-bold text-slate-700 tracking-tight capitalize">{displayStatus}</p>
                                    </div>
                                </div>
                            </div>

							<p className="text-lg text-slate-400 font-medium leading-relaxed max-w-2xl">
                                This is your private sanctuary. Share more about your experience when you're ready, track your healing steps, and record your private thoughts.
                            </p>
						</div>

						{/* My Story Card */}
						<Card className="border-0 bg-white shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden group">
							<CardHeader className="p-8 pb-0 border-0 bg-transparent flex flex-row items-center justify-between">
								<div className="flex items-center gap-4">
									<div className="w-12 h-12 bg-teal-50 rounded-2xl flex items-center justify-center text-teal-600">
										<BookOpen className="h-6 w-6" />
									</div>
									<div>
										<CardTitle className="text-2xl font-bold">Your Story</CardTitle>
										<p className="text-sm font-medium text-slate-400 mt-1">Shared with caring specialists</p>
									</div>
								</div>
								<Button variant="ghost" onClick={() => setShowAddDetails(!showAddDetails)} className="text-teal-600 hover:bg-teal-50 font-bold rounded-xl gap-2 transition-all">
									<Plus className="h-5 w-5" /> {showAddDetails ? "Cancel" : "Add Detail"}
								</Button>
							</CardHeader>
							<CardContent className="p-8 space-y-8">
								<div className="bg-slate-50/50 rounded-2xl p-8 border border-slate-50 leading-relaxed text-slate-600 font-medium text-lg italic relative">
                                    <div className="absolute top-4 left-4 text-teal-200/50 select-none"><span className="text-6xl font-serif">"</span></div>
									{report.incident_description || "Every story matters. You can start sharing yours whenever you're ready."}
                                    <div className="absolute bottom-4 right-4 text-teal-200/50 select-none"><span className="text-6xl font-serif">"</span></div>
								</div>

								{showAddDetails && (
									<div className="space-y-4 animate-in slide-in-from-top-4 fade-in duration-500">
										<Textarea 
											value={newDetail} onChange={(e) => setNewDetail(e.target.value)}
											placeholder="Add more details to your story..."
											className="min-h-[160px] rounded-2xl border-slate-100 bg-white focus:border-teal-400 focus:ring-0 p-8 text-lg font-medium shadow-inner"
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

							<Card className="border-0 bg-white shadow-xl shadow-slate-200/50 rounded-3xl overflow-hidden">
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
							<div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border-0 p-2 overflow-hidden">
								<RichTextEditor content={report.notes || ""} onSave={handleSaveNotes} placeholder="Reflect on your progress here..." />
							</div>
						</div>
					</div>

	                        {/* Sidebar: Coordination & Support */}
                        <div className="lg:col-span-4 space-y-8 lg:sticky lg:top-32 animate-in fade-in slide-in-from-right-8 duration-700">
                            
                            {(() => {
                                const m = acceptedMatch || allMatches.find(m => m.status && ['accepted', 'completed'].includes(m.status));
                                if (!m) return null;
                                return (
                                    <div id="secure-chat-section" className="space-y-4 animate-in slide-in-from-top-4 duration-700">
                                        <div className="flex flex-col gap-1 px-2">
                                            <div className="flex items-center gap-2 text-teal-600 font-bold uppercase tracking-[0.2em] text-[10px]">
                                                <Shield className="h-3.5 w-3.5" />
                                                Secure Channel
                                            </div>
                                            <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Coordination Line</h3>
                                        </div>
                                        
                                        <div className="h-[500px] sm:h-[600px] rounded-[2.5rem] border border-white shadow-2xl shadow-teal-500/10 overflow-hidden bg-white/70 backdrop-blur-2xl flex flex-col group">
                                            <div className="p-5 border-b border-slate-50 bg-slate-50/30 flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-8 h-8 rounded-2xl bg-teal-50 flex items-center justify-center text-teal-600">
                                                        <MessageCircle className="h-4 w-4" />
                                                    </div>
                                                    <div>
                                                        <span className="text-sm font-bold text-slate-900 leading-none block">{m.name}</span>
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{m.type}</span>
                                                    </div>
                                                </div>
                                                <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 font-bold tracking-widest uppercase text-[8px]">Encrypted</Badge>
                                            </div>
                                            
                                            {isChatLoading ? (
                                                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-400">
                                                    <div className="w-8 h-8 border-3 border-teal-100 border-t-teal-600 rounded-full animate-spin" />
                                                    <p className="font-bold text-[9px] uppercase tracking-widest">Securing Connection...</p>
                                                </div>
                                            ) : (
                                                <div className="flex-1 relative">
                                                    <CaseChatPanel
                                                        matchId={m.id}
                                                        survivorId={report.user_id || ''}
                                                        professionalId={m.professionalId || ''}
                                                        professionalName={m.name}
                                                        survivorName={report.first_name || "Myself"}
                                                        existingChatId={activeChat?.id}
                                                        className="absolute inset-0 h-full w-full rounded-none border-0 shadow-none !min-h-0"
                                                    />
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* 2. ACTIVITY / COORDINATION HUB */}
                            {acceptedMatch ? (
                                <div className="space-y-6">
                                    <div className="flex flex-col gap-1 px-2">
                                        <div className="flex items-center gap-2 text-teal-600 font-bold uppercase tracking-[0.2em] text-[10px]">
                                            <Activity className="h-3.5 w-3.5" />
                                            Active Support
                                        </div>
                                        <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Coordination Hub</h3>
                                    </div>

                                    {/* Action Card */}
                                    <Card className={cn(
                                        "border border-white shadow-2xl rounded-[2.5rem] overflow-hidden relative group",
                                        acceptedMatch.status === 'completed' 
                                            ? "bg-emerald-600 shadow-emerald-600/20 text-white" 
                                            : "bg-white/70 backdrop-blur-2xl border-slate-100 shadow-slate-200/50"
                                    )}>
                                        <CardContent className={cn("p-8 relative", acceptedMatch.status === 'completed' ? "text-white" : "text-slate-900")}>
                                            <div className="flex items-center justify-between mb-6">
                                                <div className="flex items-center gap-4">
                                                    <Avatar className="h-14 w-14 rounded-2xl border-2 border-slate-50 shadow-md">
                                                        <AvatarFallback className="bg-teal-50 text-teal-600 font-bold">
                                                            {acceptedMatch.name.charAt(0)}
                                                        </AvatarFallback>
                                                    </Avatar>
                                                    <div className="flex-1 min-w-0">
                                                        <h4 className="font-bold truncate">{acceptedMatch.name}</h4>
                                                        <p className={cn("text-[10px] font-bold uppercase tracking-widest", acceptedMatch.status === 'completed' ? "text-emerald-100" : "text-slate-400")}>
                                                            {acceptedMatch.type}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="flex flex-col items-end">
                                                    <Badge className="bg-teal-50 text-teal-600 border-0 font-bold text-[9px] uppercase tracking-widest">Active Partner</Badge>
                                                </div>
                                            </div>

                                            {acceptedMatch.status !== 'completed' ? (
                                                <Button 
                                                    onClick={handleComplete}
                                                    disabled={completing}
                                                    variant="ghost"
                                                    className="w-full h-10 text-slate-400 hover:text-teal-600 font-bold rounded-xl transition-all text-xs"
                                                >
                                                    {completing ? "Finalizing..." : "Subtly Complete Journey"}
                                                </Button>
                                            ) : (
                                                <div className="flex items-center gap-3 text-emerald-100 font-bold text-sm">
                                                    <CheckCircle2 className="h-5 w-5" /> Journey Finalized
                                                </div>
                                            )}
                                        </CardContent>
                                    </Card>

                                    {/* Upcoming Sessions */}
                                    {upcomingAppointments.length > 0 && (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                            <div className="flex items-center gap-2 px-2 text-slate-900 font-bold text-sm">
                                                <Calendar className="h-4 w-4 text-teal-600" />
                                                Upcoming Sessions
                                            </div>
                                            {upcomingAppointments.map((appt) => (
                                                <Card key={appt.id} className={cn(
                                                    "border-0 shadow-lg rounded-3xl overflow-hidden",
                                                    appt.status === 'requested' ? "bg-amber-50 border border-amber-100" : "bg-white border border-slate-100"
                                                )}>
                                                    <CardContent className="p-6">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <div className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                                                                {appt.type} Session
                                                            </div>
                                                            {appt.status === 'requested' && (
                                                                <Badge className="bg-amber-100 text-amber-700 border-0 text-[8px] uppercase tracking-widest px-2 py-0.5">Pending</Badge>
                                                            )}
                                                        </div>
                                                        <p className="text-xl font-bold text-slate-900 tracking-tight">{formatDate(appt.appointment_date)}</p>
                                                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4">{formatTime(appt.appointment_date)}</p>
                                                        
                                                        {appt.status === 'requested' && (
                                                            <Button 
                                                                onClick={() => {
                                                                    setRespondingTo(appt);
                                                                    setShowResponseModal(true);
                                                                }}
                                                                className="w-full bg-amber-600 hover:bg-amber-700 text-white rounded-xl h-9 text-xs font-bold transition-all"
                                                            >
                                                                Confirm Time
                                                            </Button>
                                                        )}
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            ) : (
                                <div className="space-y-6">
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
                                            </div>
                                        </CardContent>
                                    </Card>

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
									) : (
										<div className="space-y-6">
											{/* Matching Phase */}
											<div className="flex flex-col gap-1 px-2">
												<div className="flex items-center gap-2 text-teal-600 font-bold uppercase tracking-[0.2em] text-[10px]">
													<Activity className="h-3.5 w-3.5" />
													{acceptedMatch ? "Coordination Hub" : "Matching Center"}
												</div>
												<h3 className="text-2xl font-bold text-slate-900 tracking-tight">
													{acceptedMatch ? "Support Active" : "Matching Center"}
												</h3>
											</div>

											{(() => {
												if (acceptedMatch) {
													const activeAppt = appointments.find(a => a.status === 'upcoming' || a.status === 'confirmed') || appointments[0];
													
													return (
														<Card className="border-0 shadow-2xl rounded-[2.5rem] bg-white overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-700">
															<div className="bg-gradient-to-r from-teal-600 to-teal-500 p-8 text-white">
																<div className="flex items-center justify-between mb-6">
																	<Badge className="bg-white/20 text-white border-0 font-bold uppercase tracking-widest text-[9px] backdrop-blur-md">Connection Secured</Badge>
																	<ShieldCheck className="h-5 w-5 opacity-80" />
																</div>
																
																<div className="flex items-center gap-5">
																	<Avatar className="h-16 w-16 rounded-3xl border-4 border-white/20 shadow-xl">
																		<AvatarFallback className="bg-white text-teal-600 font-bold text-xl text-shadow-sm">
																			{acceptedMatch.name.charAt(0)}
																		</AvatarFallback>
																	</Avatar>
																	<div className="space-y-1">
																		<h4 className="text-2xl font-bold tracking-tight">{acceptedMatch.name}</h4>
																		<p className="text-teal-50/80 font-bold text-xs uppercase tracking-widest">{acceptedMatch.type}</p>
																	</div>
																</div>
															</div>
															
															<CardContent className="p-8 space-y-8">
																{activeAppt ? (
																	<div className="space-y-4">
																		<div className="flex items-center justify-between px-2">
																			<div className="flex items-center gap-2 text-slate-400 font-bold uppercase tracking-widest text-[10px]">
																				<Calendar className="h-3.5 w-3.5" />
																				Confirmed Session
																			</div>
																			<Badge variant="outline" className="text-teal-600 border-teal-100 bg-teal-50/30 font-bold text-[9px] uppercase tracking-wider">
																				{activeAppt.status}
																			</Badge>
																		</div>
																		
																		<div className="bg-slate-50/80 rounded-3xl p-6 border border-slate-100/50 flex flex-col sm:flex-row sm:items-center justify-between gap-6 hover:bg-slate-100/50 transition-colors">
																			<div className="space-y-1">
																				<p className="text-2xl font-bold text-slate-900 tracking-tight">
																					{new Date(activeAppt.appointment_date!).toLocaleDateString(undefined, {
																						weekday: 'long',
																						month: 'long',
																						day: 'numeric'
																					})}
																				</p>
																				<p className="text-base font-bold text-teal-600">
																					{new Date(activeAppt.appointment_date!).toLocaleTimeString([], { 
																						hour: '2-digit', 
																						minute: '2-digit' 
																					})}
																				</p>
																			</div>
																			
																			<Button 
																				variant="outline"
																				onClick={() => {
																					setRespondingTo(activeAppt);
																					setShowResponseModal(true);
																				}}
																				className="h-12 px-6 rounded-2xl border-slate-200 text-slate-600 font-bold hover:bg-white transition-all text-xs shrink-0"
																			>
																				Modify Time
																			</Button>
																		</div>
																	</div>
																) : (
																	<div className="bg-slate-50/50 rounded-3xl p-8 text-center border border-dashed border-slate-200">
																		<Calendar className="h-8 w-8 text-slate-300 mx-auto mb-3" />
																		<p className="text-sm font-bold text-slate-500">Awaiting session scheduling</p>
																		<p className="text-xs text-slate-400 mt-1">Your partner will propose a time shortly.</p>
																	</div>
																)}
																
																<div className="pt-4 flex flex-col sm:flex-row gap-4">
																	<Button 
																		onClick={() => router.push(`/dashboard/chat?id=${activeAppt?.id || 'new'}`)}
																		className="flex-1 h-14 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-[1.25rem] shadow-xl shadow-teal-600/20 transition-all hover:scale-[1.02] flex items-center justify-center gap-3"
																	>
																		<MessageCircle className="h-5 w-5" />
																		Enter Secure Chat
																		<ArrowRight className="h-4 w-4 opacity-50" />
																	</Button>
																	
																	<Button 
																		variant="outline"
																		onClick={() => {
																			toast({ title: "Profile", description: "Professional profile details are confidential." });
																		}}
																		className="h-14 px-8 rounded-[1.25rem] border-slate-100 bg-white text-slate-600 font-bold hover:bg-slate-50 transition-all text-xs"
																	>
																		View Credentials
																	</Button>
																</div>
															</CardContent>
														</Card>
													);
												}

												const activeProposal = allMatches.find(m => m.status === 'proposed' || m.status === 'requested' || m.status === 'confirmed');
												const matchingAppt = activeProposal ? appointments.find(a => a.status === 'pending' || a.status === 'requested') : null;
												
												if (activeProposal) {
													return (
														<Card className="border border-white shadow-2xl rounded-[2.5rem] bg-white/70 backdrop-blur-2xl border-teal-100/50 overflow-hidden animate-in fade-in zoom-in-95 duration-500">
															<CardHeader className="p-8 pb-4">
																<div className="flex items-center justify-between">
																	<Badge className="bg-teal-50 text-teal-600 border-0 font-bold uppercase tracking-widest text-[9px]">Partner Proposal Received</Badge>
																	<Sparkles className="h-4 w-4 text-teal-400 animate-pulse" />
																</div>
															</CardHeader>
															<CardContent className="p-8 pt-0 space-y-6">
																<div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
																	<Avatar className="h-12 w-12 rounded-2xl border-2 border-white shadow-sm">
																		<AvatarFallback className="bg-teal-100 text-teal-700 font-bold">
																			{activeProposal.name.charAt(0)}
																		</AvatarFallback>
																	</Avatar>
																	<div>
																		<p className="text-sm font-extrabold text-slate-900">{activeProposal.name}</p>
																		<p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{activeProposal.type}</p>
																	</div>
																</div>

																{matchingAppt ? (
																	<div className="space-y-4">
																		<div className="bg-teal-50/50 border border-teal-100 rounded-2xl p-5 space-y-3">
																			<div className="flex items-center gap-3 text-teal-700">
																				<Calendar className="h-4 w-4" />
																				<span className="text-sm font-bold">Proposed Meeting:</span>
																			</div>
																			<div className="flex flex-col gap-1 pl-7">
																				<p className="text-lg font-bold text-slate-900">{formatDate(matchingAppt.appointment_date)}</p>
																				<p className="text-sm font-medium text-teal-600">{formatTime(matchingAppt.appointment_date)}</p>
																			</div>
																		</div>
																		
																		<div className="flex flex-col gap-3">
																			<Button 
																				onClick={async () => {
																					await confirmAppointment(matchingAppt.id);
																					await syncReportStatus(reportId, activeProposal.id, 'accepted');
																					toast({ title: "Partner Confirmed", description: "You are now connected." });
																					fetchReport();
																				}}
																				className="w-full h-12 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-2xl shadow-lg shadow-teal-600/20 transition-all hover:scale-[1.02]"
																			>
																				Accept & Connect
																			</Button>
																			
																			<Dialog>
																				<DialogTrigger asChild>
																					<Button variant="outline" className="w-full h-12 border-slate-200 text-slate-600 font-bold rounded-2xl hover:bg-slate-50 transition-all text-xs">
																						Suggest Another Time
																					</Button>
																				</DialogTrigger>
																				<DialogContent className="max-w-2xl bg-white rounded-[2rem] p-0 overflow-hidden border-0 shadow-2xl">
																					<div className="p-8 border-b border-slate-50">
																						<DialogTitle className="text-2xl font-bold flex items-center gap-3">
																							<Calendar className="h-6 w-6 text-teal-600" />
																							Reschedule Meeting
																						</DialogTitle>
																						<DialogDescription className="text-slate-500 font-medium">
																							Suggest a new time that works better for you.
																						</DialogDescription>
																					</div>
																					<div className="p-8">
																						<EnhancedAppointmentScheduler 
																							inline={true}
																							isOpen={true}
																							onClose={() => {}}
																							userId={currentUserId || ''}
																							professionalName={activeProposal.name}
																							serviceName={activeProposal.type}
																							onSchedule={async (data) => {
																								await rescheduleAppointment(matchingAppt.id, data.date.toISOString(), data.notes);
																								await supabase.from('matched_services').update({ match_status_type: 'reschedule_requested' }).eq('id', activeProposal.id);
																								toast({ title: "Request Sent", description: "We'll notify you once confirmed." });
																								fetchReport();
																							}}
																						/>
																					</div>
																				</DialogContent>
																			</Dialog>
																		</div>
																	</div>
																) : (
																	<div className="bg-slate-50 rounded-2xl p-6 text-center space-y-3">
																		<p className="text-sm font-bold text-slate-600">Review in progress</p>
																		<p className="text-xs text-slate-400 italic">Wait until the partner suggests a time.</p>
																	</div>
																)}
															</CardContent>
														</Card>
													);
												}
												
												return (
													<Card className="border border-white shadow-2xl rounded-[2.5rem] bg-white/70 backdrop-blur-2xl border-slate-100 overflow-hidden group">
														<CardContent className="p-12 flex flex-col items-center text-center space-y-6">
															<div className="relative">
																<div className="w-20 h-20 bg-teal-50 rounded-full flex items-center justify-center text-teal-600">
																	<Sparkles className="h-10 w-10 animate-pulse" />
																</div>
																<div className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center shadow-sm">
																	<ShieldCheck className="h-4 w-4 text-teal-400" />
																</div>
															</div>
															<div className="space-y-2">
																<h4 className="text-xl font-bold text-slate-900 tracking-tight">Seeking Specialists</h4>
																<p className="text-xs font-bold text-slate-400 uppercase tracking-widest tracking-widest">
																	Evaluating the best match for your needs
																</p>
															</div>
															<div className="w-full max-w-[160px] h-1.5 bg-slate-50 rounded-full overflow-hidden">
																<div className="w-1/2 h-full bg-teal-400 rounded-full animate-[progress_2s_ease-in-out_infinite]" />
															</div>
														</CardContent>
													</Card>
												);
											})()}

											{/* Escalation / Help Card */}
											<Card className="bg-violet-600 rounded-[2rem] shadow-xl shadow-violet-600/20 border-0 p-8 text-white relative overflow-hidden group">
												<div className="absolute top-0 right-0 p-4 opacity-10 group-hover:scale-110 transition-transform">
													<Heart className="h-24 w-24" />
												</div>
												<div className="relative z-10 space-y-4">
													<h4 className="text-xl font-bold tracking-tight">Need urgent help?</h4>
													<p className="text-violet-100 font-medium text-sm leading-relaxed">
														Escalate your report to our coordination team if you feel you need more immediate attention.
													</p>
													<Button 
														onClick={handleEscalate}
														disabled={escalating}
														className="w-full h-12 bg-white/20 hover:bg-white/30 text-white font-bold rounded-2xl border border-white/20 backdrop-blur-md transition-all active:scale-[0.98]"
													>
														{escalating ? "Escalating..." : "Escalate My Report"}
													</Button>
												</div>
											</Card>
										</div>
                                    )}
                                </div>
                            )}

                            {/* Trauma Informed Tips */}
                            <div className="p-10 bg-white border border-slate-100 rounded-[2.5rem] shadow-xl shadow-slate-100/50 space-y-6 mt-10">
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
            {/* Appointment Response Modal */}
            {respondingTo && (
                <EnhancedAppointmentScheduler
                    isOpen={showResponseModal}
                    onClose={() => {
                        setShowResponseModal(false);
                        setRespondingTo(null);
                    }}
                    onSchedule={async (apptData) => {
                        try {
                            if (respondingTo.appointment_date && apptData.date.getTime() === new Date(respondingTo.appointment_date).getTime()) {
                                // Just confirm if time is unchanged
                                await confirmAppointment(respondingTo.id);
                            } else {
                                // Reschedule if different
                                await rescheduleAppointment(respondingTo.id, apptData.date.toISOString());
                            }
                            toast({ title: "Appointment Finalized" });
                            fetchReport();
                        } catch (err) {
                            toast({ title: "Failed to update appointment", variant: "destructive" });
                        }
                    }}
                    viewMode="respond"
                    initialAppointment={{
                        date: respondingTo.appointment_date ? new Date(respondingTo.appointment_date) : new Date(),
                        duration: 60,
                        type: respondingTo.type || 'consultation'
                    }}
                    professionalName={acceptedMatch?.name}
                    userId={report?.user_id || undefined}
                />
            )}
        </div>
    );
}
