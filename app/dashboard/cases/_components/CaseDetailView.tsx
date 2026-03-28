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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { CaseChatPanel } from "@/components/chat/CaseChatPanel";
import CaseNotesEditor from "../case-notes-editor";
import { Chat } from "@/types/chat";
import { AudioPlayer } from "../../_components/AudioPlayer";
import Link from "next/link";

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
    onAcceptCase?: (caseId: string) => void;
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

    return (
        <div className={cn(
            "flex flex-col h-full bg-slate-50/30 overflow-hidden",
            isFullPage ? "min-h-screen" : "w-full"
        )}>
            {/* Premium Header */}
            <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-xl border-b border-slate-100 px-6 py-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-4 min-w-0">
                    {!isFullPage && onClose && (
                        <Button 
                            variant="ghost" 
                            size="icon" 
                            onClick={onClose} 
                            className="rounded-xl hover:bg-slate-100 text-slate-500"
                        >
                            <ChevronLeft className="h-5 w-5" />
                        </Button>
                    )}
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 text-teal-600 font-extrabold uppercase tracking-[0.2em] text-[10px] mb-0.5">
                            <ShieldCheck className="h-3.5 w-3.5" />
                            Case Profile
                        </div>
                        <h2 className="text-slate-900 font-bold tracking-tight truncate">
                            {report?.type_of_incident || "Incident Report"}
                        </h2>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <Badge className={cn("px-3 py-1 rounded-full text-[10px] font-bold border uppercase tracking-[0.2em]", urgencyColor(report?.urgency))}>
                        {report?.urgency || 'Low'} Priority
                    </Badge>
                    {!isFullPage && (
                        <Button asChild variant="outline" size="sm" className="h-9 rounded-xl border-slate-200 text-slate-600 font-bold text-xs gap-2">
                            <Link href={`/dashboard/cases/${matchId}`}>
                                <ExternalLink className="h-3.5 w-3.5" /> Deep Dive
                            </Link>
                        </Button>
                    )}
                </div>
            </header>

            {/* Navigation Tabs */}
            <nav className="bg-white px-6 border-b border-slate-100 shrink-0">
                <div className="flex gap-8">
                    {["details", "chat", "notes"].map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setCurrentTab(tab)}
                            className={cn(
                                "py-4 text-xs font-bold uppercase tracking-[0.2em] transition-all relative",
                                currentTab === tab ? "text-teal-600" : "text-slate-400 hover:text-slate-600"
                            )}
                        >
                            {tab}
                            {currentTab === tab && (
                                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-teal-600 rounded-full" />
                            )}
                        </button>
                    ))}
                </div>
            </nav>

            {/* Scrollable Content Area */}
            <ScrollArea className="flex-1">
                <div className={cn(
                    "p-6 space-y-8 pb-24",
                    isFullPage ? "max-w-5xl mx-auto" : "max-w-4xl"
                )}>
                    {currentTab === "details" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                            
                            {/* Completion Status Banners */}
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
                            
                            {/* Summary Card */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card className="border-0 shadow-sm rounded-2xl bg-white p-5 flex items-center gap-4">
                                    <div className="w-10 h-10 bg-teal-50 rounded-xl flex items-center justify-center text-teal-600">
                                        <User className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Survivor</p>
                                        <p className="text-sm font-bold text-slate-900">{displaySurvivorName}</p>
                                    </div>
                                </Card>
                                <Card className="border-0 shadow-sm rounded-2xl bg-white p-5 flex items-center gap-4">
                                    <div className="w-10 h-10 bg-sky-50 rounded-xl flex items-center justify-center text-sky-600">
                                        <Calendar className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reported</p>
                                        <p className="text-sm font-bold text-slate-900">{formatDate(report?.submission_timestamp)}</p>
                                    </div>
                                </Card>
                                <Card className="border-0 shadow-sm rounded-2xl bg-white p-5 flex items-center gap-4">
                                    <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center text-violet-600">
                                        <Activity className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Status</p>
                                        <p className="text-sm font-bold text-slate-900 capitalize">{caseItem.match_status_type || "Matched"}</p>
                                    </div>
                                </Card>
                            </div>

                            {/* Status and Actions Card */}
                            <Card className={cn(
                                "border-0 shadow-xl rounded-[2rem] overflow-hidden",
                                caseItem.match_status_type === 'completed' ? "bg-emerald-600" : "bg-teal-600"
                            )}>
                                <CardContent className="p-8 text-white relative">
                                    <Sparkles className="absolute -top-4 -right-4 h-24 w-24 text-white/10" />
                                    <div className="space-y-4 relative">
                                        <div className="flex items-center gap-2 text-white/80 font-bold uppercase tracking-[0.2em] text-[10px]">
                                            <Shield className="h-3.5 w-3.5" />
                                            Case Management
                                        </div>
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
                                            <div className="space-y-1">
                                                <h3 className="text-2xl font-bold tracking-tight">
                                                    {caseItem.match_status_type === 'completed' ? "Case Successfully Closed" : "Active Match Support"}
                                                </h3>
                                                <p className="text-white/80 font-medium text-sm max-w-md">
                                                    {caseItem.match_status_type === 'completed' 
                                                        ? "This case has been marked as resolved. You can still access notes and history." 
                                                        : "You are currently providing support for this survivor. Coordinate via chat and track progress below."}
                                                </p>
                                            </div>
                                            <div className="shrink-0 flex gap-3">
                                                {caseItem.match_status_type === 'pending' && onAcceptCase && (
                                                    <Button 
                                                        onClick={() => onAcceptCase(matchId)}
                                                        disabled={isUpdatingStatus}
                                                        className="bg-white text-teal-600 hover:bg-teal-50 font-extrabold rounded-xl px-6 h-12 shadow-lg transition-all"
                                                    >
                                                        {isUpdatingStatus ? "Opening Options..." : "Begin Support"}
                                                    </Button>
                                                )}
                                                {caseItem.match_status_type !== 'completed' && caseItem.match_status_type !== 'pending' && onCompleteCase && (
                                                    <Button 
                                                        onClick={() => onCompleteCase(matchId)}
                                                        disabled={isUpdatingStatus}
                                                        className="bg-white text-emerald-600 hover:bg-emerald-50 font-extrabold rounded-xl px-6 h-12 shadow-lg transition-all"
                                                    >
                                                        {isUpdatingStatus ? "Updating..." : "Complete Case"}
                                                    </Button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Story / Incident Description */}
                            <Card className="border-0 bg-white shadow-xl shadow-slate-200/50 rounded-[2.5rem] overflow-hidden">
                                <CardHeader className="p-10 pb-0 flex flex-row items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400">
                                            <BookOpen className="h-6 w-6" />
                                        </div>
                                        <div>
                                            <CardTitle className="text-xl font-bold">Incident Story</CardTitle>
                                            <p className="text-xs font-medium text-slate-400 mt-1">
                                                {isAccepted ? "Shared by survivor" : "Privacy Protected - Begin support to unlock"}
                                            </p>
                                        </div>
                                    </div>
                                </CardHeader>
                                <CardContent className="p-10 space-y-8">
                                    <div className="bg-slate-50/50 rounded-3xl p-8 border border-slate-50 leading-relaxed text-slate-600 font-medium text-base italic relative">
                                        <div className="absolute top-4 left-4 text-teal-200/20 select-none"><span className="text-6xl font-serif">"</span></div>
                                        {isAccepted ? (report?.incident_description || "No description provided.") : (
                                            <div className="flex flex-col items-center justify-center py-10 text-slate-400 gap-4">
                                                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center">
                                                    <Lock className="h-8 w-8" />
                                                </div>
                                                <div className="text-center space-y-1">
                                                    <p className="text-base font-bold text-slate-600 not-italic">Privacy Protected</p>
                                                    <p className="text-sm text-slate-400 not-italic">
                                                        Full incident details are protected for survivor privacy. <br/>
                                                        Accept this case to begin providing support and view the story.
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

                            {/* Recovery Tracker */}
                            <div className="space-y-6">
                                <div className="flex items-center justify-between px-2">
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
                                                                <h4 className={cn("text-lg font-bold transition-all", item.completed ? "text-slate-300 line-through" : "text-slate-800")}>
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
                                                                className="text-sm text-slate-400 font-medium bg-transparent border-0 focus-visible:ring-0 p-0 resize-none min-h-[40px] focus:text-slate-600"
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
                                                placeholder="Add a new milestone..."
                                                className="h-14 border-slate-100 rounded-2xl bg-white shadow-sm flex-1 focus-visible:ring-teal-400/20 text-base font-medium px-6"
                                                onKeyDown={(e) => { if (e.key === 'Enter') addChecklistItem(); }}
                                            />
                                            <Button size="icon" onClick={addChecklistItem} disabled={!newChecklistItem.trim()} className="h-14 w-14 shrink-0 bg-teal-600 hover:bg-teal-700 rounded-2xl text-white shadow-xl shadow-teal-600/20 transition-all active:scale-95">
                                                <Plus className="h-6 w-6" />
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    )}

                    {currentTab === "chat" && (
                        <div className="h-[700px] animate-in fade-in slide-in-from-right-4 duration-500 rounded-[2.5rem] overflow-hidden shadow-xl border border-slate-100 bg-white flex flex-col">
                            {isChatLoading ? (
                                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-slate-400">
                                    <div className="w-10 h-10 border-4 border-teal-100 border-t-teal-600 rounded-full animate-spin" />
                                    <p className="font-bold text-xs uppercase tracking-widest">Entering Secure Chat...</p>
                                </div>
                            ) : (
                                <CaseChatPanel 
                                    matchId={matchId}
                                    survivorId={(caseItem.survivor_id || report?.user_id) as string}
                                    professionalId={userId}
                                    professionalName="You"
                                    survivorName={report?.first_name || 'Survivor'}
                                    existingChatId={activeChat?.id}
                                    className="border-0 rounded-none shadow-none h-full"
                                    isExpanded={true}
                                />
                            )}
                        </div>
                    )}

                    {currentTab === "notes" && (
                        <div className="space-y-6 animate-in fade-in slide-in-from-left-4 duration-500">
                            <div className="flex items-center gap-4 px-2">
                                <div className="w-10 h-10 bg-violet-50 rounded-xl flex items-center justify-center text-violet-600">
                                    <PenLine className="h-5 w-5" />
                                </div>
                                <h2 className="text-xl font-bold tracking-tight">Private Case Notes</h2>
                            </div>
                            <p className="text-sm text-slate-400 font-medium leading-relaxed px-2">Only you can access these notes. Use them to track observations and internal coordination details.</p>
                            <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/50 border-0 p-2 overflow-hidden">
                                <CaseNotesEditor 
                                    matchId={matchId} 
                                    initialHtml={caseItem.notes || ""} 
                                    onSaved={(html) => {
                                        // Parent will be updated via live subscription or fetch
                                    }} 
                                />
                            </div>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
}
