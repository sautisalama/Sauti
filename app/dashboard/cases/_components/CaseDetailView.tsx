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
    X, MoreHorizontal, AlertCircle
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
    const [editingItemId, setEditingItemId] = useState<string | null>(null);
    const [editingTitle, setEditingTitle] = useState("");
    const notesTimerRef = useRef<NodeJS.Timeout | null>(null);

    const report = caseItem.report;
    const matchId = caseItem.id;
    const isAccepted = caseItem.match_status_type === 'accepted' || caseItem.match_status_type === 'completed';
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


            <Card className="border-0 bg-white shadow-xl shadow-slate-200/50 rounded-[1.5rem] sm:rounded-[2.5rem] overflow-hidden">
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

                <Card className="border-0 bg-white shadow-xl shadow-slate-200/50 rounded-[1.5rem] sm:rounded-[2.5rem] overflow-hidden">
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
                        <div className="p-5 sm:p-8 bg-slate-50/50 flex flex-col sm:flex-row gap-3 sm:gap-4 border-t border-slate-100">
                            <Input 
                                value={newChecklistItem}
                                onChange={(e) => setNewChecklistItem(e.target.value)}
                                placeholder="Add a new milestone..."
                                className="h-12 sm:h-14 border-slate-100 rounded-xl sm:rounded-2xl bg-white shadow-sm flex-1 focus-visible:ring-teal-400/20 text-sm sm:text-base font-medium px-4 sm:px-6"
                                onKeyDown={(e) => { if (e.key === 'Enter') addChecklistItem(); }}
                            />
                            <Button onClick={addChecklistItem} disabled={!newChecklistItem.trim()} className="h-12 sm:h-14 w-full sm:w-14 shrink-0 bg-teal-600 hover:bg-teal-700 rounded-xl sm:rounded-2xl text-white shadow-xl shadow-teal-600/20 transition-all active:scale-95 gap-2">
                                <Plus className="h-5 w-5 sm:h-6 sm:w-6" />
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
                <div className="h-[400px] sm:h-[600px] rounded-[1.5rem] sm:rounded-[2.5rem] border border-white shadow-2xl shadow-teal-500/10 overflow-hidden bg-white/70 backdrop-blur-2xl flex flex-col group mt-0">

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
                <AccordionItem value="notes" className="bg-white rounded-[1.5rem] sm:rounded-[2.5rem] border border-slate-100 shadow-xl shadow-slate-200/50 overflow-hidden">
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
            "flex flex-col h-full bg-slate-50/30 overflow-hidden",
            isFullPage ? "min-h-screen" : "w-full"
        )}>
            <header className="sticky top-0 z-40 bg-white border-b border-slate-100 px-4 sm:px-8 py-4 sm:py-6 shadow-sm overflow-hidden min-h-[80px] sm:min-h-0 flex items-center">
                <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4 w-full">
                    <div className="flex items-center gap-3 sm:gap-6 min-w-0">
                        {!isFullPage && onClose && (
                            <Button variant="ghost" size="icon" onClick={onClose} className="rounded-xl hover:bg-slate-50 text-slate-400 h-9 w-9 sm:h-10 sm:w-10">
                                <ChevronLeft className="h-5 w-5" />
                            </Button>
                        )}
                        
                        <div className="flex items-center gap-3 sm:gap-6">
                            <div className="space-y-0.5">
                                <div className="flex items-center gap-2 text-teal-600 font-extrabold uppercase tracking-[0.2em] text-[9px] sm:text-[10px] leading-none mb-1">
                                    <ShieldCheck className="h-3.5 w-3.5" /> Case Profile
                                </div>
                                <h1 className="text-base sm:text-xl font-black text-slate-900 tracking-tight leading-none uppercase truncate max-w-[150px] sm:max-w-none">
                                    {report?.type_of_incident?.replace(/_/g, " ") || "Incident Report"}
                                </h1>
                            </div>

                            <div className="h-8 sm:h-10 w-px bg-slate-100 mx-1 sm:mx-2 hidden md:block" />

                            <div className="hidden md:flex items-center gap-4 lg:gap-8 min-w-0">
                                <div className="flex items-center gap-2 lg:gap-3 group shrink-0">
                                    <div className="w-8 h-8 lg:w-9 lg:h-9 bg-slate-50 rounded-lg lg:rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-teal-50 group-hover:text-teal-600 transition-all">
                                        <User className="h-3.5 w-3.5" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-[8px] lg:text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Survivor</p>
                                        <p className="text-[10px] lg:text-xs font-bold text-slate-700 tracking-tight whitespace-nowrap">{displaySurvivorName}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 lg:gap-3 group shrink-0">
                                    <div className="w-8 h-8 lg:w-9 lg:h-9 bg-slate-50 rounded-lg lg:rounded-xl flex items-center justify-center text-slate-400 group-hover:bg-sky-50 group-hover:text-sky-600 transition-all">
                                        <Calendar className="h-3.5 w-3.5" />
                                    </div>
                                    <div className="space-y-0.5">
                                        <p className="text-[8px] lg:text-[9px] font-bold text-slate-400 uppercase tracking-widest leading-none">Reported</p>
                                        <p className="text-[10px] lg:text-xs font-bold text-slate-700 tracking-tight whitespace-nowrap">{formatDate(report?.submission_timestamp)}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 sm:gap-4 shrink-0 overflow-x-auto pb-1 sm:pb-0 scrollbar-hide">
                        <Badge className={cn("px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-[8px] sm:text-[10px] font-bold border uppercase tracking-widest sm:tracking-[0.2em] whitespace-nowrap", urgencyColor(report?.urgency))}>
                            {report?.urgency || 'Low'}
                        </Badge>

                        {caseItem.match_status_type === 'pending' && onAcceptCase && (
                            <div className="relative shrink-0">
                                <Button onClick={() => setIsSchedulerOpen(true)} className="h-9 sm:h-11 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-lg sm:rounded-xl px-4 sm:px-5 shadow-lg shadow-teal-600/20 text-[10px] sm:text-xs gap-2 transition-all active:scale-95 whitespace-nowrap">
                                    <Calendar className="h-3.5 w-3.5" /> Accept & Schedule
                                </Button>
                                <EnhancedAppointmentScheduler isOpen={isSchedulerOpen} onClose={() => setIsSchedulerOpen(false)} userId={userId} professionalName="You" serviceName={caseItem.service_details?.name} onSchedule={async (appt: any) => { if (onAcceptCase) { onAcceptCase(matchId, appt); setIsSchedulerOpen(false); } }} />
                            </div>
                        )}

                        {caseItem.match_status_type !== 'completed' && caseItem.match_status_type !== 'pending' && onCompleteCase && (
                            <Dialog open={isCompletionDialogOpen} onOpenChange={setIsCompletionDialogOpen}>
                                <DialogTrigger asChild>
                                    <Button disabled={isUpdatingStatus} className="h-9 sm:h-11 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold rounded-lg sm:rounded-xl px-4 sm:px-5 shadow-lg shadow-emerald-600/20 text-[10px] sm:text-xs gap-2 transition-all active:scale-95 whitespace-nowrap">
                                        <CheckCircle2 className="h-3.5 w-3.5" /> {isUpdatingStatus ? "Closing..." : "Complete Case"}
                                    </Button>
                                </DialogTrigger>
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
                        )}
                    </div>
                </div>
            </header>

            <ScrollArea className="flex-1">
                <div className={cn(
                    "p-8 mx-auto",
                    isFullPage ? "max-w-7xl pb-24" : "w-full pb-8"
                )}>
                    {isFullPage ? (
                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
                            <div className="lg:col-span-8">
                                {mainContent}
                            </div>
                            <div className="lg:col-span-4 lg:sticky lg:top-32 h-full">
                                {sidebarContent}
                            </div>
                        </div>
                    ) : (
                        <div className="flex flex-col gap-8">
                            {sidebarContent}
                            {mainContent}
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
