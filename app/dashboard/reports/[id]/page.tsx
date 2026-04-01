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
	Shield, Quote, X, AlertCircle, Archive
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
import { escalateReport } from "@/app/actions/escalate-report";
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
	const [currentUserId, setCurrentUserId] = useState<string | null>(null);
	const isOwner = report?.user_id === currentUserId;
	const [checklists, setChecklists] = useState<ChecklistItem[]>([]);

	const [newChecklistItem, setNewChecklistItem] = useState("");
	const [editingItemId, setEditingItemId] = useState<string | null>(null);
	const [editingTitle, setEditingTitle] = useState("");
	const [appointments, setAppointments] = useState<AppointmentData[]>([]);
	const [activeChat, setActiveChat] = useState<Chat | null>(null);
	const [isArchiving, setIsArchiving] = useState(false);
	const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);

	const handleArchiveReport = async () => {
		if (!report) return;
		setIsArchiving(true);
		
		const currentAdmin = (report.administrative as Record<string, unknown>) || {};
		const updatedAdmin = { ...currentAdmin, is_archived: true };

		const { error } = await supabase
			.from("reports")
			.update({ administrative: updatedAdmin })
			.eq("report_id", reportId);

		if (error) {
			toast({ title: "Archival failed", description: error.message, variant: "destructive" });
		} else {
			toast({ title: "Report Closed", description: "This report has been moved to your archives." });
			router.push("/dashboard/reports");
		}
		setIsArchiving(false);
		setShowArchiveConfirm(false);
	};

	const handleEscalate = async () => {
		if (!report) return;
		setEscalating(true);
		try {
			await escalateReport(reportId);
			toast({ 
				title: "Report Escalated", 
				description: "Our coordination team has been notified and matching is now active." 
			});
			fetchReport();
		} catch (err: any) {
			toast({ 
				title: "Escalation failed", 
				description: err.message || "Something went wrong.", 
				variant: "destructive" 
			});
		} finally {
			setEscalating(false);
		}
	};
	const [isChatLoading, setIsChatLoading] = useState(false);
	const [completing, setCompleting] = useState(false);
	const [respondingTo, setRespondingTo] = useState<AppointmentData | null>(null);
	const [showResponseModal, setShowResponseModal] = useState(false);
	const [showMobileChat, setShowMobileChat] = useState(false);
	const [unreadCount, setUnreadCount] = useState(0);
	const [escalating, setEscalating] = useState(false);

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
	}, [reportId, supabase, router]);

	// Preload chat as soon as we have an accepted match
	useEffect(() => {
		const preloadChat = async () => {
			if (!acceptedMatch) return;
			const { data: { user } } = await supabase.auth.getUser();
			if (!user) return;
            setCurrentUserId(user.id);

			setIsChatLoading(true);
			try {
				const chat = await getCaseChat(acceptedMatch.id, user.id);
				setActiveChat(chat);
			} catch (err) {
				console.error("Chat preload failed:", err);
			} finally {
				setIsChatLoading(false);
			}
		};
		preloadChat();
	}, [acceptedMatch, supabase]);

    // Handle real-time unread count
    useEffect(() => {
        if (!activeChat || !currentUserId) return;

        const channel = supabase
            .channel(`unread-count:${activeChat.id}`)
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'messages',
                    filter: `chat_id=eq.${activeChat.id}`
                },
                (payload) => {
                    const newMsg = payload.new as any;
                    // Only count if from OTHER party and chat overlay is NOT open
                    if (newMsg.sender_id !== currentUserId && !showMobileChat) {
                        setUnreadCount(prev => prev + 1);
                    }
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [activeChat, currentUserId, showMobileChat, supabase]);

    // Clear unread count when opening chat
    useEffect(() => {
        if (showMobileChat && activeChat) {
            setUnreadCount(0);
        }
    }, [showMobileChat, activeChat]);




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

	const isArchived = (report.administrative as any)?.is_archived === true;

	return (
		<div className="min-h-screen bg-slate-50/50 pb-32 lg:pb-12 text-slate-900 selection:bg-teal-100">
			{/* Case Archival Synergy Banner */}
			{isArchived && (
				<div className="bg-amber-600 text-white py-3 px-4 flex items-center justify-center gap-3 animate-in slide-in-from-top duration-500 sticky top-0 z-[60]">
					<AlertCircle className="h-5 w-5 animate-pulse" />
					<p className="text-xs sm:text-sm font-bold tracking-tight">
						The {isOwner ? 'case partner' : 'reporter'} has finalized their portion of the journey. Would you like to archive this {isOwner ? 'report' : 'case'} now?
					</p>
					<Button 
						onClick={() => setShowArchiveConfirm(true)}
						className="bg-white text-amber-600 hover:bg-amber-50 h-8 px-4 rounded-xl font-bold text-[10px] uppercase tracking-widest ml-4 shadow-sm"
					>
						Yes, Archive {isOwner ? 'Report' : 'Case'}
					</Button>
				</div>
			)}
			
			{/* Focused Header Navigation - Unified with Case View */}
			<nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 transition-all duration-300 min-h-[64px] sm:min-h-[72px] flex items-center">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 w-full flex items-center justify-between gap-4 py-2 sm:py-0">
					<div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
						<Link href="/dashboard/reports" className="shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-all text-slate-600">
							<ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
						</Link>
						<div className="flex-1 min-w-0">
							<div className="hidden sm:flex items-center gap-2 text-teal-600 font-extrabold uppercase tracking-[0.2em] text-[8px] sm:text-[10px] mb-0.5">
								<ShieldCheck className="h-3.5 w-3.5" />
								<span className="truncate">{isOwner ? 'Secure Journey Hub' : 'Case Coordination Hub'}</span>
							</div>
							<div className="flex flex-col sm:flex-row sm:items-center gap-0 sm:gap-4 shrink-0 min-w-0">
                                <h2 className="text-slate-900 font-bold tracking-tight uppercase text-[10px] sm:text-base whitespace-nowrap overflow-hidden text-ellipsis">
                                    {(() => {
                                        const type = report?.type_of_incident?.replace(/_/g, " ") || "Incident";
                                        return type.toLowerCase().includes("abuse") ? type : `${type} Abuse`;
                                    })()}
                                </h2>
                                <div className="hidden sm:block h-3 w-px bg-slate-200" />
                                <div className="flex items-center gap-2">
                                    <Badge variant="outline" className="bg-slate-50/50 border-slate-100 text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-widest px-1.5 py-0">
                                        {report?.is_onBehalf ? "Child" : "Personal"}
                                    </Badge>
                                    <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-widest hidden lg:block">
                                        {report?.submission_timestamp ? new Date(report.submission_timestamp).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) : ""}
                                    </span>
                                </div>
                            </div>
						</div>
					</div>

					<div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <Badge className={cn("px-2 sm:px-4 py-1 sm:py-1.5 rounded-full text-[8px] sm:text-[10px] font-bold border uppercase tracking-[0.1em] sm:tracking-[0.2em] whitespace-nowrap shadow-sm truncate max-w-[80px] sx:max-w-none", getStatusTheme(displayStatus))}>
                            {displayStatus}
                        </Badge>
						
						<Dialog open={showArchiveConfirm} onOpenChange={setShowArchiveConfirm}>
							<DialogTrigger asChild>
								<Button variant="ghost" className="text-slate-400 hover:text-teal-600 font-bold text-[9px] sm:text-[10px] gap-2 uppercase tracking-widest h-8 sm:h-10 px-1 sm:px-2 group">
									<Archive className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:scale-110 transition-transform" /> 
									<span className="hidden sm:inline text-slate-500">{isOwner ? 'Close Report' : 'Close Case'}</span>
								</Button>
							</DialogTrigger>
							<DialogContent className="sm:max-w-[425px] rounded-[2rem] border-slate-100 p-8 bg-white shadow-2xl">
								<DialogHeader className="space-y-4">
									<div className="w-14 h-14 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-500 mx-auto">
										<AlertCircle className="h-7 w-7" />
									</div>
									<div className="text-center space-y-2">
										<DialogTitle className="text-xl font-bold tracking-tight text-slate-900">Archive this report?</DialogTitle>
										<DialogDescription className="text-slate-500 font-medium leading-relaxed">
											Archiving will move this report to your history. You will still be able to access it later from the archived reports section.
										</DialogDescription>
									</div>
								</DialogHeader>
								<div className="flex flex-col gap-3 mt-6">
									<Button 
										onClick={handleArchiveReport} 
										disabled={isArchiving}
										className="h-12 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-2xl w-full shadow-lg transition-all"
									>
										{isArchiving ? "Archiving..." : "Yes, Archive Report"}
									</Button>
									<Button 
										variant="ghost" 
										onClick={() => setShowArchiveConfirm(false)}
										className="h-12 text-slate-400 font-bold rounded-2xl w-full hover:bg-slate-50"
									>
										Keep {isOwner ? 'Report' : 'Case'} Active
									</Button>
								</div>
							</DialogContent>
						</Dialog>
					</div>
				</div>
			</nav>

			<main className="max-w-7xl mx-auto px-6 py-12">
				<div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
					
					{/* Main Content: Story & Recovery */}
					<div className="lg:col-span-8 space-y-8">
						
						<div className="space-y-3">
							<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-1">
								<div className="space-y-1.5 flex flex-col">
									<h1 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-800">Your Healing Journey</h1>
									<p className="text-sm text-slate-400 font-medium max-w-sm leading-relaxed">
										A private, secure space for your recovery steps and private thoughts.
									</p>
								</div>
							</div>
						</div>


						{/* Recovery Tracker Section - Moved to top for Empowerment Priority */}
						<div className="space-y-2">
							<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-2 gap-4">
								<div className="flex items-center gap-4">
									<div className="w-8 h-8 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600">
										<Sparkles className="h-4 w-4" />
									</div>
									<h2 className="text-xl font-bold tracking-tight text-slate-800">Your Recovery Progress</h2>
								</div>
								<span className="text-[10px] font-bold text-teal-600 uppercase tracking-widest bg-teal-50/50 border border-teal-100 px-4 py-1.5 rounded-full shadow-sm">
									{checklists.filter(c => c.completed).length}/{checklists.length} Steps Taken
								</span>
							</div>

							<Card className="border-0 bg-white/40 backdrop-blur-sm shadow-xl shadow-slate-200/30 rounded-2xl sm:rounded-3xl overflow-hidden border border-white/50">
								<CardContent className="p-0">
									{checklists.map((item, idx) => (
										<div key={item.id} className={cn("group transition-all duration-300", idx < checklists.length - 1 && "border-b border-slate-100/50")}>
											<div className="p-4 sm:p-6 hover:bg-white/60 transition-colors">
												<div className="flex items-start gap-4 sm:gap-6">
													<Checkbox 
														checked={item.completed} 
														onCheckedChange={() => toggleChecklist(item.id)} 
														className="h-5 w-5 rounded-lg border-2 border-slate-200 data-[state=checked]:bg-teal-500 data-[state=checked]:border-teal-500 transition-all mt-1 flex-shrink-0"
													/>
													<div className="flex-1 min-w-0">
														<div className="flex items-center justify-between gap-4 mb-1 text-wrap">
															{editingItemId === item.id ? (
																<Input
																	value={editingTitle}
																	onChange={(e) => setEditingTitle(e.target.value)}
																	onKeyDown={(e) => { if (e.key === 'Enter') saveEditingTitle(); if (e.key === 'Escape') setEditingItemId(null); }}
																	onBlur={saveEditingTitle} autoFocus
																	className="h-8 text-sm font-bold border-teal-200 rounded-xl focus-visible:ring-0 focus-visible:border-teal-400 bg-white shadow-sm"
																/>
															) : (
																<h4 className={cn("text-base font-bold transition-all cursor-text hover:text-teal-600 break-words", item.completed ? "text-slate-300 line-through" : "text-slate-700")}
																	onClick={() => startEditingTitle(item.id, item.title)}>
																	{item.title}
																</h4>
															)}
															<button onClick={() => deleteChecklistItem(item.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-rose-500 transition-all">
																<Trash2 className="h-4 w-4" />
															</button>
														</div>
														<p className="text-xs text-slate-400 font-medium">Record private notes about this step below</p>
														<Textarea
															value={item.notes || ""}
															onChange={(e) => updateChecklistNotes(item.id, e.target.value)}
															placeholder="Private recovery notes for this step..."
															className="text-sm text-slate-500 font-medium bg-transparent border-0 focus-visible:ring-0 p-0 resize-none min-h-[30px] focus:text-slate-700 mt-1"
														/>
													</div>
												</div>
											</div>
										</div>
									))}
									<div className="p-4 sm:p-6 bg-slate-50/30 flex flex-col sm:flex-row gap-3 border-t border-white/50">
										<Input 
											value={newChecklistItem}
											onChange={(e) => setNewChecklistItem(e.target.value)}
											placeholder="Add a new healing milestone..."
											className="h-11 border-slate-100 rounded-xl bg-white shadow-sm flex-1 focus-visible:ring-teal-400/20 text-sm font-medium px-4"
											onKeyDown={(e) => { if (e.key === 'Enter') addChecklistItem(); }}
										/>
										<Button onClick={addChecklistItem} disabled={!newChecklistItem.trim()} className="h-11 w-full sm:w-11 shrink-0 bg-teal-500 hover:bg-teal-600 rounded-xl text-white shadow-lg shadow-teal-600/10 transition-all active:scale-95 gap-2 flex items-center justify-center p-0">
											<Plus className="h-5 w-5" />
											<span className="sm:hidden font-bold text-xs uppercase tracking-widest">Add Milestone</span>
										</Button>
									</div>
								</CardContent>
							</Card>
						</div>

						{/* Report Info & Personal Details Section - Rebranded as Discrete Accordion */}
						<div className="max-w-2xl">
							<Accordion type="single" collapsible className="w-full">
								<AccordionItem value="report-details" className="border-0">
									<Card className="border border-slate-100 bg-white shadow-sm rounded-3xl overflow-hidden group/statement transition-all duration-300">
										<AccordionTrigger className="w-full text-left p-4 sm:p-6 hover:no-underline group/trigger">
											<div className="flex items-center gap-4 w-full">
												<div className="w-10 h-10 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-data-[state=open]/trigger:bg-teal-50 group-data-[state=open]/trigger:text-teal-600 transition-all duration-300">
													<FileText className="h-5 w-5" />
												</div>
												<div className="space-y-0 text-left">
													<h3 className="text-sm sm:text-base font-bold text-slate-800 tracking-tight">Your Detailed Statement</h3>
													<p className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-widest">Formal Incident Record</p>
												</div>
											</div>
										</AccordionTrigger>
										<AccordionContent className="p-4 sm:p-6 pt-0 border-t border-slate-50">
											<div className="space-y-6 py-2">
												
												{/* Statement Box - Hidden if empty */}
												{report.incident_description ? (
                                                    <div className="bg-slate-50/50 rounded-2xl p-4 sm:p-6 border border-slate-100/50">
                                                        <p className="text-slate-600 font-medium text-sm leading-relaxed whitespace-pre-wrap italic">
                                                            {report.incident_description}
                                                        </p>
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col items-center justify-center py-6 px-4 border border-dashed border-slate-100 rounded-2xl bg-slate-50/20">
                                                        <p className="text-xs font-bold text-slate-400 uppercase tracking-widest text-center">No personal statement was shared during report</p>
                                                    </div>
                                                )}

												{/* Form Details Grid */}
												<div className="grid grid-cols-2 sm:grid-cols-4 gap-4 sm:gap-6 pt-2">
													<div className="space-y-0.5">
														<p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                            <MapPin className="h-2.5 w-2.5 text-teal-500" /> Location
                                                        </p>
														<p className="text-xs sm:text-sm font-bold text-slate-700">{report.location || report.city || "Not specified"}</p>
													</div>
                                                    <div className="space-y-0.5">
														<p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                            <Activity className="h-2.5 w-2.5 text-teal-500" /> Urgency
                                                        </p>
														<p className="text-xs sm:text-sm font-bold text-slate-700 capitalize">{report.urgency || "Normal"}</p>
													</div>
                                                    <div className="space-y-0.5">
														<p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                            <BookOpen className="h-2.5 w-2.5 text-teal-500" /> Language
                                                        </p>
														<p className="text-xs sm:text-sm font-bold text-slate-700 capitalize">{report.preferred_language || "English"}</p>
													</div>
                                                    <div className="space-y-0.5">
														<p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                                            <Phone className="h-2.5 w-2.5 text-teal-500" /> Contact
                                                        </p>
														<p className="text-xs sm:text-sm font-bold text-slate-700 capitalize">{report.contact_preference?.replace(/_/g, " ") || "No preference"}</p>
													</div>
												</div>

												{/* Audio Records - Grouped more prominently if present */}
												{audioFiles.length > 0 && (
													<div className="space-y-3 pt-4 border-t border-slate-50">
														<p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-widest flex items-center gap-2">
															<Mic className="h-3 w-3 text-teal-500" />
															Audio Records ({audioFiles.length})
														</p>
														<div className="grid grid-cols-1 gap-3">
															{audioFiles.map((audio, index) => (
																<div key={index} className="bg-slate-50 border border-slate-100/50 rounded-2xl p-3 shadow-none">
																	<AudioPlayer src={audio.url} title={audio.title || `Voice Note ${index + 1}`} />
																</div>
															))}
														</div>
													</div>
												)}

												{/* Simplified Add Details Form */}
												<div className="pt-4 border-t border-slate-50 space-y-4">
													{!showAddDetails ? (
														<Button 
															variant="outline" 
															size="sm"
															onClick={() => setShowAddDetails(true)} 
															className="h-9 px-4 rounded-xl border-slate-200 text-teal-600 font-bold text-[10px] uppercase tracking-widest hover:bg-teal-50 hover:border-teal-100 transition-all"
														>
															<Plus className="h-3.5 w-3.5 mr-2" /> {report.incident_description ? "Supplement statement" : "Share more details"}
														</Button>
													) : (
														<div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-300">
															<Textarea 
																value={newDetail} 
																onChange={(e) => setNewDetail(e.target.value)}
																placeholder="Record any additional thoughts or details here..."
																className="min-h-[100px] rounded-xl border-slate-200 bg-white focus:border-teal-400 focus:ring-0 p-4 text-xs font-medium transition-all"
															/>
															<div className="flex items-center justify-between">
                                                                <Button variant="ghost" onClick={() => setShowAddDetails(false)} className="h-8 px-4 text-slate-400 font-bold text-[9px] uppercase tracking-widest hover:text-slate-600 transition-all">
                                                                    Cancel
                                                                </Button>
																<Button 
																	onClick={handleAddDetail} 
																	disabled={updating || !newDetail.trim()} 
																	className="h-9 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl px-6 text-[10px] uppercase tracking-widest transition-all"
																>
																	{updating ? "Saving..." : "Add Update"}
																</Button>
															</div>
														</div>
													)}
												</div>
											</div>
										</AccordionContent>
									</Card>
								</AccordionItem>
							</Accordion>
						</div>

						{/* Healing Journal Section - Privacy & Reflection */}
						<div className="space-y-6">
							<div className="flex items-center gap-4 px-2">
								<div className="w-9 h-9 bg-violet-50 rounded-xl flex items-center justify-center text-violet-600">
									<PenLine className="h-4 w-4" />
								</div>
								<h2 className="text-xl font-bold tracking-tight text-slate-800">Your Private Journal</h2>
							</div>
							<p className="text-sm text-slate-400 font-medium leading-relaxed px-2">Only you can see these notes. Reflect on your healing, progress, and thoughts here.</p>
							<div className="bg-white/50 backdrop-blur-sm rounded-[2.5rem] shadow-xl shadow-slate-200/20 border border-white p-2 overflow-hidden">
								<RichTextEditor content={report.notes || ""} onSave={handleSaveNotes} placeholder="How are you feeling today?" />
</div>
						</div>
					</div>

					{/* Sidebar: Coordination & Support */}
					<div className="lg:col-span-4 space-y-8 lg:sticky lg:top-32 animate-in fade-in slide-in-from-right-8 duration-700">
						
						{/* COORDINATION FLOW */}
						{acceptedMatch ? (
							<div className="space-y-8">
								{/* 1. SECURE CHAT - Desktop Sidebar Only */}
								<div id="secure-chat-section" className="hidden lg:block space-y-4 animate-in slide-in-from-top-4 duration-700">
									<div className="flex flex-col gap-1 px-2">
										<div className="flex items-center gap-2 text-teal-600 font-bold uppercase tracking-[0.2em] text-[10px]">
											<Shield className="h-3.5 w-3.5" />
											Secure Channel
										</div>
										<h3 className="text-2xl font-bold text-slate-900 tracking-tight">Coordination Line</h3>
									</div>
									
									<div className="h-[600px] rounded-3xl border border-slate-100 shadow-2xl shadow-slate-200/50 overflow-hidden bg-white flex flex-col group">
										{isChatLoading ? (
											<div className="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4">
												<div className="w-12 h-12 rounded-2xl bg-teal-50 flex items-center justify-center animate-spin">
													<Shield className="h-6 w-6 text-teal-600" />
												</div>
												<p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Securing Connection...</p>
											</div>
										) : (
											<CaseChatPanel
												matchId={acceptedMatch.id}
												survivorId={report.user_id || ''}
												professionalId={acceptedMatch.professionalId || ''}
												professionalName={acceptedMatch.name}
												professionalType={acceptedMatch.type}
												survivorName={report.first_name || "Myself"}
												existingChatId={activeChat?.id}
												className="flex-1 rounded-none border-0 shadow-none"
											/>
										)}
									</div>
								</div>

								{/* 2. COORDINATION HUB - Desktop Only */}
								<div className="hidden lg:block space-y-6">
									<div className="flex flex-col gap-1 px-2">
										<div className="flex items-center gap-2 text-teal-600 font-bold uppercase tracking-[0.2em] text-[10px]">
											<Activity className="h-3.5 w-3.5" />
											Active Support
										</div>
										<h3 className="text-2xl font-bold text-slate-900 tracking-tight">Coordination Hub</h3>
									</div>

									{/* Sauti Salama Tips Card */}
									<Card className="border-0 bg-gradient-to-br from-teal-600 to-emerald-700 shadow-xl shadow-teal-600/20 rounded-3xl overflow-hidden group">
										<CardContent className="p-8 relative">
											<div className="absolute top-0 right-0 p-4 opacity-10">
												<ShieldCheck className="h-20 w-20 text-white" />
											</div>
											<div className="space-y-4 relative text-white">
												<h3 className="text-xl font-bold tracking-tight">How Sauti Salama Works</h3>
												<div className="space-y-3 opacity-90">
													<p className="text-sm font-medium leading-relaxed">
														• <strong>100% Confidential</strong>: Your identity is masked until you choose to reveal it.
													</p>
													<p className="text-sm font-medium leading-relaxed">
														• <strong>Verified Experts</strong>: Every partner is strictly vetted by our human rights team.
													</p>
													<p className="text-sm font-medium leading-relaxed">
														• <strong>Survivor First</strong>: You lead the conversation and set the pace of coordination.
													</p>
												</div>
											</div>
										</CardContent>
									</Card>

									{/* Supportive Hint Card */}
									<Card className="border border-slate-100 bg-white/50 backdrop-blur-sm shadow-sm rounded-3xl overflow-hidden">
										<CardContent className="p-8 space-y-6">
											<div className="flex items-center gap-3">
												<div className="w-10 h-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600">
													<Sparkles className="h-5 w-5" />
												</div>
												<h4 className="text-lg font-bold text-slate-800 tracking-tight text-center">Journey Tip</h4>
											</div>
											<p className="text-sm text-slate-500 font-medium leading-relaxed">
												Use the coordination line to share any evidence or documentation you'd like your partner to review before your first official session.
											</p>
										</CardContent>
									</Card>
								</div>

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
												Matching Center
											</div>
											<h3 className="text-2xl font-bold text-slate-900 tracking-tight">
												Matching Center
											</h3>
										</div>

										{(() => {
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

								{/* Supportive Tips - Always visible in sidebar */}
								<div className="p-8 bg-white/40 backdrop-blur-sm border border-white shadow-xl rounded-[2.5rem] space-y-4">
									<div className="flex items-center gap-3 text-teal-600">
										<div className="w-8 h-8 bg-teal-50 rounded-xl flex items-center justify-center">
											<Heart className="h-4 w-4" />
										</div>
										<h4 className="font-bold text-base tracking-tight text-slate-800">Caring Reminder</h4>
									</div>
									<p className="text-sm text-slate-500 leading-relaxed font-medium">
										You are doing great. Taking these steps is an act of bravery. We are here to support you at your own pace.
									</p>
								</div>
							</div>
						)}
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
								await confirmAppointment(respondingTo.id);
							} else {
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
