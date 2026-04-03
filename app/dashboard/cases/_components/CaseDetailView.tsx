"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { createClient } from "@/utils/supabase/client";
import { Tables, Json } from "@/types/db-schema";
import { 
    Calendar, Phone, Clock, CheckCircle2, MapPin, 
    Plus, Lock, Heart, ShieldCheck, LogOut,
    BookOpen, HandHeart, Mic, FileText, PenLine, 
    VideoIcon, CheckSquare, Trash2, MessageCircle, 
    ChevronLeft, Sparkles, Activity, ArrowRight,
    Shield, User, Briefcase, MessageSquare, ExternalLink,
    X, MoreHorizontal, AlertCircle, MoreVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { CaseChatPanel } from "@/components/chat/CaseChatPanel";
import CaseNotesEditor from "../case-notes-editor";
import { Chat } from "@/types/chat";
import { AudioPlayer } from "../../_components/AudioPlayer";
import Link from "next/link";
import { 
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
    DialogDescription
} from "@/components/ui/dialog";
import { confirmAppointment, rescheduleAppointment, confirmReschedule } from "../../_views/actions/appointments";
import { EnhancedAppointmentScheduler } from "../../_components/EnhancedAppointmentScheduler";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { ChatFAB } from "@/components/navigation/ChatFAB";
import { AppointmentBanner } from "@/components/dashboard/AppointmentBanner";

interface ChecklistItem {
    id: string;
    title: string;
    notes?: string;
    completed: boolean;
    done?: boolean;
}

interface CaseDetailViewProps {
    caseItem: any; // MatchedServiceItem with nested report and service_details
    userId: string;
    onCompleteCase?: (caseId: string) => void;
    onAcceptCase?: (caseId: string, appointment?: any) => void;
    isUpdatingStatus?: boolean;
    onClose?: () => void;
    isFullPage?: boolean;
    activeTab?: string;
    onTabChange?: (tab: string) => void;
    activeChat?: Chat | null;
    isChatLoading?: boolean;
}

export function CaseDetailView({
    caseItem,
    userId,
    onCompleteCase,
    onAcceptCase,
    isUpdatingStatus = false,
    onClose,
    isFullPage = false,
    activeTab = "details",
    onTabChange,
    activeChat,
    isChatLoading = false
}: CaseDetailViewProps) {
    const { toast } = useToast();
    const supabase = useMemo(() => createClient(), []);
    const [internalTab, setInternalTab] = useState<string>("details");
    
    // Use controlled tab if provided
    const currentTab = onTabChange ? activeTab : internalTab;
    const setCurrentTab = onTabChange ? onTabChange : setInternalTab;

    const [checklists, setChecklists] = useState<ChecklistItem[]>([]);
    const [newChecklistItem, setNewChecklistItem] = useState("");
    const [editingTitle, setEditingTitle] = useState("");
    const notesTimerRef = useRef<NodeJS.Timeout | null>(null);
    const [appointments, setAppointments] = useState<any[]>([]);

    useEffect(() => {
        const fetchAppointments = async () => {
            const { data } = await supabase
                .from('appointments')
                .select('*, service_details:support_services(*)')
                .eq('matched_services', matchId)
                .order('appointment_date', { ascending: true });
            
            if (data) setAppointments(data);
        };
        if (matchId) fetchAppointments();
    }, [matchId, supabase]);

    const report = caseItem.report;
    const matchId = caseItem.id;
    const isAccepted = caseItem.match_status_type === 'accepted' || caseItem.match_status_type === 'completed' || caseItem.match_status_type === 'archived';
    const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);
    const [isCompletionDialogOpen, setIsCompletionDialogOpen] = useState(false);

    // Parse completion status from feedback string
    const completionStatus = useMemo(() => {
        try {
            if (caseItem.feedback && caseItem.feedback.startsWith('{')) {
                return JSON.parse(caseItem.feedback);
            }
        } catch (e) {
            console.warn("Failed to parse completion status:", e);
        }
        return { is_prof_complete: false, is_surv_complete: false };
    }, [caseItem.feedback]);

    const isProfComplete = completionStatus.is_prof_complete;
    const isSurvComplete = completionStatus.is_surv_complete;

    const calculateAge = (dob: string | null) => {
        if (!dob) return "Adult";
        const birthDate = new Date(dob);
        if (isNaN(birthDate.getTime())) return "Adult";
        const ageDifMs = Date.now() - birthDate.getTime();
        const ageDate = new Date(ageDifMs);
        const age = Math.abs(ageDate.getUTCFullYear() - 1970);
        return age < 18 ? "Child" : `${age} yrs`;
    };

    const formatIncidentType = (type: string) => {
        if (!type) return "Incident Report";
        const normalized = type.replace(/_/g, " ");
        if (normalized.toLowerCase().includes("abuse")) return normalized;
        return `${normalized} abuse`;
    };

    const displaySurvivorName = isAccepted 
        ? `${report?.first_name || 'Survivor'} ${report?.last_name || ''}`.trim()
        : `${report?.gender || 'Survivor'}, ${calculateAge(report?.dob)}`;

    // Parse media
    const getMediaFiles = (): any[] => {
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

    // Checklist logic (shared with reports page)
    useEffect(() => {
        if (report?.administrative && typeof report.administrative === 'object') {
            const admin = report.administrative as Record<string, any>;
            const rawItems = admin.checklist || admin.checklists || [];
            setChecklists(rawItems.map((c: any) => ({ ...c, completed: c.done ?? c.completed ?? false })));
        } else {
            setChecklists([
                { id: "1", title: "Review incident details", notes: "Initial case review", completed: false },
                { id: "2", title: "Establish contact with survivor", notes: "Use secure chat", completed: false }
            ]);
        }
    }, [report]);

    const handleSaveChecklist = async (newLists: ChecklistItem[]) => {
        setChecklists(newLists);
        if (!report) return;
        const normalizedLists = newLists.map(c => ({ 
            id: c.id, 
            title: c.title, 
            notes: c.notes || '', 
            done: c.completed ?? c.done ?? false 
        }));
        const adminData = { 
            ...(report.administrative as Record<string, any> || {}), 
            checklist: normalizedLists 
        };
        await supabase.from('reports').update({ 
            administrative: adminData as any 
        }).eq('report_id', report.report_id);
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

    const deleteChecklistItem = (id: string) => {
        const updated = checklists.filter(c => c.id !== id);
        handleSaveChecklist(updated);
    };

    const addChecklistItem = () => {
        if (!newChecklistItem.trim()) return;
        const updated = [...checklists, { 
            id: Date.now().toString(), 
            title: newChecklistItem, 
            notes: '', 
            completed: false, 
            done: false 
        }];
        setNewChecklistItem("");
        handleSaveChecklist(updated);
    };

    const urgencyColor = (u?: string | null) => {
        switch (u?.toLowerCase()) {
            case "high": return "bg-rose-50 text-rose-700 border-rose-100";
            case "medium": return "bg-amber-50 text-amber-700 border-amber-100";
            default: return "bg-sky-50 text-sky-700 border-sky-100";
        }
    };

    const formatDate = (date: string | null) => {
        if (!date) return "";
        return new Date(date).toLocaleDateString("en-US", { 
            weekday: "short", 
            year: "numeric", 
            month: "short", 
            day: "numeric" 
        });
    };

    const mainContent = (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {isSurvComplete && !isProfComplete && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 text-emerald-700">
                        <CheckCircle2 className="h-5 w-5" />
                        <p className="text-sm font-bold">The survivor has marked this case as completed. Do you want to close it?</p>
                    </div>
                    <Button 
                        size="sm" 
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg h-9"
                        onClick={() => onCompleteCase?.(matchId)}
                    >
                        Yes, Close Case
                    </Button>
                </div>
            )}

            {isProfComplete && !isSurvComplete && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-4 flex items-center gap-3 text-amber-700">
                    <Clock className="h-5 w-5" />
                    <p className="text-sm font-medium">You've marked this as complete. Waiting for survivor to confirm and archive.</p>
                </div>
            )}

            {/* New Incident Metadata Section - Primary for mobile navigation relief */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 lg:hidden">
                <Card className="border border-slate-100 bg-white/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden p-4">
                    <div className="flex items-center gap-3">
                        <div className={cn("w-8 h-8 rounded-lg border flex items-center justify-center shrink-0", urgencyColor(report?.urgency))}>
                            <Activity className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Urgency</p>
                            <p className="text-xs font-bold text-slate-700 uppercase tracking-tight">{report?.urgency || 'Low'} Priority</p>
                        </div>
                    </div>
                </Card>

                <Card className="border border-slate-100 bg-white/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shrink-0">
                            <MapPin className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Location</p>
                            <p className="text-xs font-bold text-slate-700 truncate">{report?.location || report?.city || "Unknown"}</p>
                        </div>
                    </div>
                </Card>

                <Card className="border border-slate-100 bg-white/50 backdrop-blur-sm shadow-sm rounded-2xl overflow-hidden p-4">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shrink-0">
                            <Clock className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-none mb-1">Submitted</p>
                            <p className="text-xs font-bold text-slate-700">{formatDate(report?.submission_timestamp)}</p>
                        </div>
                    </div>
                </Card>
            </div>

            {!isAccepted && (
                <div className="bg-serene-blue-50/50 border border-serene-blue-100 rounded-2xl p-4 flex items-start gap-3">
                    <Shield className="h-5 w-5 text-serene-blue-600 mt-0.5" />
                    <div className="space-y-1">
                        <p className="text-sm font-bold text-serene-blue-900">Privacy Mode Enabled</p>
                        <p className="text-xs text-serene-blue-700 leading-relaxed">
                            Survivor details are protected. Full contact information and incident history will be visible once you accept the case and schedule a meeting.
                        </p>
                    </div>
                </div>
            )}

            {caseItem.match_status_type === 'reschedule_requested' && (
                <div className="bg-amber-600 shadow-xl shadow-amber-600/20 rounded-[2rem] p-8 text-white relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform duration-700">
                        <Calendar className="h-24 w-24" />
                    </div>
                    <div className="relative z-10 space-y-6">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md">
                                <Clock className="h-6 w-6" />
                            </div>
                            <div>
                                <h4 className="text-xl font-bold tracking-tight">Reschedule Requested</h4>
                                <p className="text-amber-100 font-medium text-sm">The survivor has proposed a new meeting time.</p>
                            </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-3">
                            <Button 
                                onClick={async () => {
                                    // Logic to confirm the pending appointment
                                    const { data: appt } = await supabase.from('appointments').select('*').eq('matched_services', matchId).eq('status', 'requested').maybeSingle();
                                    if (appt) {
                                        await confirmReschedule(appt.appointment_id, matchId);
                                        toast({ title: "Appointment Confirmed" });
                                        // fetchCase is called via real-time subscription or we could trigger it manually
                                    }
                                }}
                                className="h-12 bg-white text-amber-600 hover:bg-amber-50 font-bold rounded-2xl px-8 shadow-lg transition-all"
                            >
                                Confirm New Time
                            </Button>
                            <Button 
                                variant="ghost"
                                onClick={() => setIsSchedulerOpen(true)}
                                className="h-12 bg-white/10 hover:bg-white/20 text-white border border-white/20 font-bold rounded-2xl px-8 backdrop-blur-md transition-all"
                            >
                                Suggest Different Time
                            </Button>
                        </div>
                    </div>
                </div>
            )}


            <Card className="border-0 bg-white shadow-xl shadow-slate-200/50 rounded-2xl sm:rounded-[2.5rem] overflow-hidden">
                <CardHeader className="p-6 sm:p-10 pb-0 flex flex-row items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 sm:w-12 sm:h-12 bg-slate-50 rounded-xl sm:rounded-2xl flex items-center justify-center text-slate-400">
                            <BookOpen className="h-5 w-5 sm:h-6 sm:w-6" />
                        </div>
                        <div>
                            <CardTitle className="text-lg sm:text-xl font-bold">Incident Story</CardTitle>
                            <p className="text-[10px] sm:text-xs font-medium text-slate-400 mt-0.5 sm:mt-1">
                                {isAccepted ? "Shared by survivor" : "Privacy Protected - Begin support to unlock"}
                            </p>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="p-6 sm:p-10 space-y-6 sm:space-y-8">
                    <div className="bg-slate-50/50 rounded-2xl sm:rounded-3xl p-6 sm:p-8 border border-slate-50 leading-relaxed text-slate-600 font-medium text-sm sm:text-base italic relative text-center sm:text-left">
                        <div className="absolute top-4 left-4 text-teal-200/20 select-none"><span className="text-6xl font-serif">"</span></div>
                        {isAccepted ? (report?.incident_description || "No description provided.") : (
                            <div className="flex flex-col items-center justify-center py-6 text-slate-400 gap-4">
                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                                    <Lock className="h-8 w-8" />
                                </div>
                                <div className="text-center space-y-1">
                                    <p className="text-base font-bold text-slate-600 not-italic">Privacy Protected</p>
                                    <p className="text-sm text-slate-400 not-italic">
                                        Accept this case to view the story.
                                    </p>
                                </div>
                            </div>
                        )}
                        <div className="absolute bottom-4 right-4 text-teal-200/20 select-none"><span className="text-6xl font-serif">"</span></div>
                    </div>

                    {isAccepted && audioFiles.length > 0 && (
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

            {/* Appointments Banner - Conditional high-importance UI */}
            {appointments.length > 0 && (
                <AppointmentBanner 
                    appointments={appointments.map(a => ({
                        id: a.appointment_id,
                        appointment_date: a.appointment_date,
                        start_time: a.start_time,
                        location_type: a.location_type as any,
                        status: a.status as any,
                        service_name: a.service_details?.name,
                        professional_name: a.service_details?.provider_name,
                        professional_id: a.professional_id,
                        match_id: matchId
                    }))} 
                    onUpdate={() => {
                        const fetchAgain = async () => {
                            const { data } = await supabase
                                .from('appointments')
                                .select('*, service_details:support_services(*)')
                                .eq('matched_services', matchId)
                                .order('appointment_date', { ascending: true });
                            if (data) setAppointments(data);
                        };
                        fetchAgain();
                    }}
                />
            )}

            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between px-2 gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600">
                            <CheckSquare className="h-5 w-5" />
                        </div>
                        <h2 className="text-xl font-bold tracking-tight">Recovery Milestones</h2>
                    </div>
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest bg-white border border-slate-100 px-4 py-1.5 rounded-full shadow-sm">
                        {checklists.filter(c => c.completed).length}/{checklists.length} Complete
                    </span>
                </div>

                <Card className="border-0 bg-white shadow-xl shadow-slate-200/50 rounded-2xl sm:rounded-[2.5rem] overflow-hidden">
                    <CardContent className="p-0">
                        {checklists.map((item, idx) => (
                            <div key={item.id} className={cn("group transition-all duration-300", idx < checklists.length - 1 && "border-b border-slate-50")}>
                                <div className="p-5 sm:p-8 hover:bg-teal-50/10 transition-colors">
                                    <div className="flex items-start gap-4 sm:gap-6">
                                        <Checkbox 
                                            checked={item.completed} 
                                            onCheckedChange={() => toggleChecklist(item.id)} 
                                            className="h-5 w-5 sm:h-6 sm:w-6 shrink-0 rounded-lg border-2 border-slate-200 data-[state=checked]:bg-teal-600 data-[state=checked]:border-teal-600 transition-all mt-1"
                                        />
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between gap-4 mb-1 sm:mb-2">
                                                <h4 className={cn("text-base sm:text-lg font-bold transition-all truncate", item.completed ? "text-slate-300 line-through" : "text-slate-800")}>
                                                    {item.title}
                                                </h4>
                                                <button onClick={() => deleteChecklistItem(item.id)} className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-rose-500 transition-all">
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                            <Textarea
                                                value={item.notes || ""}
                                                onChange={(e) => updateChecklistNotes(item.id, e.target.value)}
                                                placeholder="Add notes for this milestone..."
                                                className="text-xs sm:text-sm text-slate-400 font-medium bg-transparent border-0 focus-visible:ring-0 p-0 resize-none min-h-[30px] sm:min-h-[40px] focus:text-slate-600 shadow-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        <div className="p-4 sm:p-8 bg-slate-50/50 flex flex-col sm:flex-row gap-3 sm:gap-4 border-t border-slate-100">
                            <Input 
                                value={newChecklistItem}
                                onChange={(e) => setNewChecklistItem(e.target.value)}
                                placeholder="Add a new milestone..."
                                className="h-12 border-slate-100 rounded-xl bg-white shadow-sm flex-1 focus-visible:ring-teal-400/20 text-sm font-medium px-4"
                                onKeyDown={(e) => { if (e.key === 'Enter') addChecklistItem(); }}
                            />
                            <Button onClick={addChecklistItem} disabled={!newChecklistItem.trim()} className="h-12 w-full sm:w-14 shrink-0 bg-teal-600 hover:bg-teal-700 rounded-xl text-white shadow-xl shadow-teal-600/20 transition-all active:scale-95 gap-2">
                                <Plus className="h-5 w-5" />
                                <span className="sm:hidden font-bold text-xs uppercase tracking-widest">Add Milestone</span>
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );

    const sidebarContent = (
        <div className="space-y-6">
            {isAccepted && (
                <div className="hidden lg:flex flex-col h-[400px] sm:h-[600px] rounded-2xl sm:rounded-[2.5rem] border border-white shadow-2xl shadow-teal-500/10 overflow-hidden bg-white/70 backdrop-blur-2xl group mt-0">

                    {isChatLoading ? (
                        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-400">
                            <div className="w-10 h-10 border-4 border-teal-100 border-t-teal-600 rounded-full animate-spin" />
                            <p className="font-bold text-xs uppercase tracking-widest">Accessing Chat...</p>
                        </div>
                    ) : (
                        <div className="flex-1 relative">
                            <CaseChatPanel 
                                matchId={matchId}
                                survivorId={(caseItem.survivor_id || report?.user_id) as string}
                                professionalId={userId}
                                professionalName="You"
                                survivorName={report?.first_name || 'Survivor'}
                                existingChatId={activeChat?.id}
                                className="absolute inset-0 border-0 rounded-none shadow-none h-full w-full"
                            />
                        </div>
                    )}
                </div>
            )}

            <Accordion type="single" collapsible className="w-full">
                <AccordionItem value="notes" className="bg-white rounded-2xl sm:rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
                    <AccordionTrigger className="px-8 py-6 hover:no-underline [&[data-state=open]>svg]:rotate-180">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center text-violet-600">
                                <PenLine className="h-5 w-5" />
                            </div>
                            <span className="text-xl font-bold tracking-tight text-slate-900">Private Notes</span>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent className="px-8 pb-8 pt-0">
                        <p className="text-sm text-slate-400 font-medium leading-relaxed mb-4">Only you can access these notes.</p>
                        <div className="h-[300px] border border-slate-100 rounded-2xl overflow-hidden shadow-inner">
                            <CaseNotesEditor 
                                matchId={matchId} 
                                initialHtml={caseItem.notes || ""} 
                                onSaved={() => {}} 
                            />
                        </div>
                    </AccordionContent>
                </AccordionItem>
            </Accordion>
        </div>
    );

    return (
        <div className={cn(
            "flex flex-col bg-slate-50/30 overflow-hidden",
            isFullPage ? "min-h-screen w-full" : "h-full w-full"
        )}>
			<nav className="lg:hidden sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-serene-neutral-100/50 transition-all duration-300 min-h-[64px] sm:min-h-[72px] flex items-center">
				<div className="max-w-7xl mx-auto px-2 xs:px-4 sm:px-6 w-full flex items-center justify-between gap-2 sm:gap-4 py-2 sm:py-0">
					<div className="flex items-center gap-1 sm:gap-4 flex-1 min-w-0">
						{!isFullPage && onClose ? (
							<Button variant="ghost" size="icon" onClick={onClose} className="shrink-0 w-10 h-10 rounded-xl bg-serene-neutral-50 flex items-center justify-center hover:bg-serene-neutral-100 transition-all text-serene-neutral-600">
								<ChevronLeft className="h-5 w-5" />
							</Button>
						) : (
							<div className="shrink-0 w-10 h-10 rounded-xl bg-serene-neutral-50 flex items-center justify-center text-serene-neutral-600">
								<Briefcase className="h-5 w-5" />
							</div>
						)}
						<div className="flex-1 min-w-0 flex items-center gap-2">
							<h2 className="text-sauti-dark font-bold tracking-tight uppercase text-xs sm:text-base whitespace-nowrap overflow-hidden text-ellipsis w-fit shrink-0">
								{formatIncidentType(report?.type_of_incident)}
							</h2>
							{(report?.additional_info as any)?.is_for_child && (
								<Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[10px] sm:text-[11px] font-black uppercase tracking-widest px-2 py-0.5 rounded-lg shadow-sm shrink-0 w-fit whitespace-nowrap">
									Child Abuse
								</Badge>
							)}
						</div>
					</div>
                <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                        <div className="hidden lg:flex items-center gap-2 sm:gap-3 shrink-0">
                            <Badge className={cn("px-2 sm:px-4 py-1 sm:py-1.5 rounded-full text-[8px] sm:text-[10px] font-bold border uppercase tracking-[0.1em] sm:tracking-[0.2em] whitespace-nowrap shadow-sm truncate max-w-[80px] sx:max-w-none", urgencyColor(report?.urgency))}>
                                {report?.urgency || 'Low'} Priority
                            </Badge>
                        </div>

                        {caseItem.match_status_type === 'pending' && onAcceptCase && (
                            <div className="relative shrink-0">
                                <Button onClick={() => setIsSchedulerOpen(true)} className="h-9 sm:h-11 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg sm:rounded-xl px-2 sm:px-5 shadow-lg shadow-teal-600/20 text-[10px] sm:text-xs gap-1 sm:gap-2 transition-all active:scale-95 whitespace-nowrap shrink-0">
                                    <Calendar className="h-3.5 w-3.5" /> Accept & Schedule
                                </Button>
                                <EnhancedAppointmentScheduler isOpen={isSchedulerOpen} onClose={() => setIsSchedulerOpen(false)} userId={userId} professionalName="You" serviceName={caseItem.service_details?.name} onSchedule={async (appt: any) => { if (onAcceptCase) { onAcceptCase(matchId, appt); setIsSchedulerOpen(false); } }} />
                            </div>
                        )}
                        
                        {caseItem.match_status_type !== 'completed' && caseItem.match_status_type !== 'pending' && onCompleteCase && (
                            <div className="flex items-center gap-2">
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon" className="h-9 w-9 sm:h-11 sm:w-11 rounded-lg sm:rounded-xl text-serene-neutral-400 hover:text-sauti-teal hover:bg-serene-neutral-50 transition-all">
                                            <MoreVertical className="h-5 w-5" />
                                        </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-56 rounded-2xl border-serene-neutral-100 p-2 shadow-2xl bg-white">
                                        <DropdownMenuItem 
                                            onClick={() => setIsCompletionDialogOpen(true)}
                                            className="flex items-center gap-2 p-3 text-sm font-bold text-slate-700 rounded-xl hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer"
                                        >
                                            <CheckCircle2 className="h-4 w-4" />
                                            Complete Case
                                        </DropdownMenuItem>
                                    </DropdownMenuContent>
                                </DropdownMenu>

                                <Dialog open={isCompletionDialogOpen} onOpenChange={setIsCompletionDialogOpen}>
                                    <DialogContent className="w-[95vw] sm:max-w-md rounded-[2rem] border-0 shadow-2xl bg-white p-6 sm:p-8">
                                        <DialogHeader className="space-y-4">
                                            <div className="w-12 sm:w-16 h-12 sm:h-16 bg-emerald-50 rounded-xl sm:rounded-[1.5rem] flex items-center justify-center text-emerald-600 mb-2">
                                                <ShieldCheck className="h-6 sm:h-8 w-6 sm:w-8" />
                                            </div>
                                            <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">Close this case?</DialogTitle>
                                            <DialogDescription className="text-slate-500 font-medium text-sm sm:text-base">
                                                Completing this case will finalize all coordination actions for the survivor.
                                            </DialogDescription>
                                        </DialogHeader>
                                        <DialogFooter className="flex flex-row gap-3 pt-6 mt-4 sm:mt-6 border-t border-slate-50">
                                            <Button 
                                                variant="outline" 
                                                className="flex-1 h-10 sm:h-12 rounded-xl border-slate-100 font-bold text-[10px] uppercase tracking-widest text-slate-500"
                                                onClick={() => setIsCompletionDialogOpen(false)}
                                            >
                                                Cancel
                                            </Button>
                                            <Button 
                                                className="flex-1 h-10 sm:h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-600/20"
                                                onClick={async () => {
                                                    if (onCompleteCase) await onCompleteCase(matchId);
                                                    setIsCompletionDialogOpen(false);
                                                }}
                                            >
                                                Complete
                                            </Button>
                                        </DialogFooter>
                                    </DialogContent>
                                </Dialog>
                            </div>
                        )}
                    </div>
                </div>
            </nav>

            <ScrollArea className="flex-1">
                <div className={cn(
                    "p-2 xs:p-4 sm:p-8 mx-auto w-full",
                    isFullPage ? "max-w-7xl pb-24" : "pb-8"
                )}>
                    {isFullPage ? (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
                            <div className="lg:col-span-8">
                                {mainContent}
                            </div>
                            <div className="lg:col-span-4 lg:sticky lg:top-24 self-start">
                                {sidebarContent}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-8">
                            {mainContent}
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Floating Action Button for Chats (Mobile) */}
            {matchId && (
                <ChatFAB 
                    matchId={matchId}
                    survivorId={(caseItem.survivor_id || report?.user_id) as string}
                    professionalId={userId}
                    professionalName="You"
                    survivorName={report?.first_name || 'Survivor'}
                />
            )}
        </div>
    );
}
