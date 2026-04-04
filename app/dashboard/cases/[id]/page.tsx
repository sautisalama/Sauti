"use client";

import { use, useEffect, useState, useMemo, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { CaseDetailView } from "../_components/CaseDetailView";
import { Tables } from "@/types/db-schema";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { ChevronLeft, ShieldCheck, LogOut, Heart, Lock } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getCaseChat } from "@/app/actions/chat";
import { acceptAndScheduleCase } from "@/app/actions/matching";
import { Chat } from "@/types/chat";
import { 
    MoreVertical, 
    CheckCircle2, 
    Trash2,
    Calendar as CalendarIcon,
    ShieldCheck as ShieldCheckIcon,
    Check,
    Archive
} from "lucide-react";
import { 
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
import { SereneBreadcrumb } from "@/components/ui/SereneBreadcrumb";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export default function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const resolvedParams = use(params);
    const caseId = resolvedParams.id;
    const { toast } = useToast();
    const router = useRouter();
    const supabase = useMemo(() => createClient(), []);

    const [caseData, setCaseData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [userId, setUserId] = useState<string | null>(null);
    const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
    const [activeChat, setActiveChat] = useState<Chat | null>(null);
    const [isChatLoading, setIsChatLoading] = useState(false);
    const [isCompletionDialogOpen, setIsCompletionDialogOpen] = useState(false);
    const dash = useDashboardData();

    useEffect(() => {
        const fetchUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) setUserId(user.id);
        };
        fetchUser();
    }, [supabase]);

    const fetchCase = useCallback(async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("matched_services")
                .select(`
                    *,
                    report:reports(*),
                    service_details:support_services(*)
                `)
                .eq("id", caseId)
                .maybeSingle();

            if (error) throw error;
            if (data) {
                setCaseData(data);
            } else {
                toast({ title: "Case not found", variant: "destructive" });
                router.push("/dashboard/cases");
            }
        } catch (err: any) {
            toast({ title: "Error loading case", description: err.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [caseId, supabase, toast, router]);

    useEffect(() => {
        fetchCase();

        // Real-time listener for this case
        const channel = supabase
            .channel(`case-updates-${caseId}`)
            .on(
                'postgres_changes',
                {
                    event: 'UPDATE',
                    schema: 'public',
                    table: 'matched_services',
                    filter: `id=eq.${caseId}`
                },
                () => {
                    console.log("Case updated in real-time by survivor/system");
                    fetchCase();
                }
            )
			.on(
				'postgres_changes',
				{
					event: 'UPDATE',
					schema: 'public',
					table: 'reports',
					filter: `report_id=eq.${caseData?.report_id}`
				},
				() => {
					console.log("Associated report status changed, refetching case...");
					fetchCase();
				}
			)
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [fetchCase, supabase, caseId, caseData?.report_id]);

    const setTopBarTitle = dash?.setTopBarTitle;

    const setTopBarActions = dash?.setTopBarActions;

    const formatDate = (dateString: string | null) => {
        if (!dateString) return "";
        return new Date(dateString).toLocaleDateString("en-US", { 
            weekday: "short", 
            year: "numeric", 
            month: "short", 
            day: "numeric" 
        });
    };

    const formatIncidentType = (type: string | undefined) => {
        if (!type) return "Incident";
        const formatted = type.replace(/_/g, " ");
        return formatted.toLowerCase().includes("abuse") ? formatted : `${formatted} Abuse`;
    };

    // Sync title and actions with top bar
    useEffect(() => {
        if (!caseData?.report) return;
        
        const report = caseData.report;
        const abuseType = formatIncidentType(report.type_of_incident);
        const isChildAbuse = (report?.additional_info as any)?.is_for_child;

        const title = (
            <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-serene-neutral-900 truncate">
                        {abuseType}
                    </span>
                    {isChildAbuse && (
                        <Badge className="bg-purple-100 text-purple-700 border-purple-200 text-[9px] font-black uppercase tracking-widest px-1.5 py-0 rounded-md shadow-sm shrink-0">
                            Child Abuse
                        </Badge>
                    )}
                </div>
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-serene-neutral-500">
                    <CalendarIcon className="h-3 w-3" />
                    <span>{formatDate(report.submission_timestamp)}</span>
                    <TooltipProvider>
                        <Tooltip delayDuration={0}>
                            <TooltipTrigger asChild>
                                <div className="flex items-center ml-0.5 cursor-help">
                                    <div className="flex items-center">
                                        <Check className={cn("h-3 w-3 stroke-[3]", caseData.match_status_type === 'accepted' ? "text-blue-500" : "text-serene-neutral-300")} />
                                        <Check className={cn("h-3 w-3 stroke-[3] -ml-2", caseData.match_status_type === 'accepted' ? "text-blue-500" : "text-serene-neutral-300")} />
                                    </div>
                                </div>
                            </TooltipTrigger>
                            <TooltipContent side="bottom" align="center" className="bg-slate-900 border-0 text-white rounded-xl shadow-2xl p-3 max-w-[200px] animate-in fade-in zoom-in-95 duration-200">
                                <p className="text-[10px] font-bold uppercase tracking-wider mb-1 text-slate-400">
                                    {caseData.match_status_type === 'accepted' ? "Accepted & Scheduled" : "Case Pending"}
                                </p>
                                <p className="text-xs font-medium leading-tight text-white/90">
                                    {caseData.match_status_type === 'accepted' 
                                        ? "Coordination is finalized and a support session is locked in with the survivor." 
                                        : "You have been matched. Please review, accept, and schedule to unlock full survivor access."}
                                </p>
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>
            </div>
        );
        
        if (setTopBarTitle) setTopBarTitle(title);

        const actions = (
            <div className="flex items-center gap-3">
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-9 w-9 p-0 rounded-full hover:bg-serene-neutral-50 shrink-0">
                            <MoreVertical className="h-5 w-5 text-serene-neutral-500" />
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56 rounded-2xl border-serene-neutral-200 shadow-xl p-2 animate-in fade-in zoom-in-95 duration-200">
                        <div className="px-3 py-2 border-b border-serene-neutral-50 mb-1">
                            <p className="text-[10px] font-bold text-serene-neutral-400 uppercase tracking-widest">Case Management</p>
                        </div>
                        
                        {(caseData.match_status_type === 'accepted' || caseData.match_status_type === 'reschedule_requested') && (
                            <DropdownMenuItem 
                                onClick={() => setIsCompletionDialogOpen(true)}
                                className="flex items-center gap-3 cursor-pointer rounded-xl focus:bg-serene-neutral-50 focus:text-sauti-teal p-3 text-sm font-semibold text-serene-neutral-700"
                            >
                                <CheckCircle2 className="h-4 w-4" />
                                Mark as Completed
                            </DropdownMenuItem>
                        )}

                        {process.env.NODE_ENV === 'development' && (
                            <DropdownMenuItem 
                                className="flex items-center gap-3 cursor-pointer rounded-xl focus:bg-rose-50 focus:text-rose-600 p-3 text-sm font-semibold text-rose-600 border-t border-serene-neutral-50 mt-1"
                            >
                                <Trash2 className="h-4 w-4" />
                                Delete Case Record
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        );
        if (setTopBarActions) setTopBarActions(actions);

        return () => {
            if (setTopBarTitle) setTopBarTitle(null);
            if (setTopBarActions) setTopBarActions(null);
        };
    }, [caseData?.report, caseData?.match_status_type, setTopBarTitle, setTopBarActions, caseId, router]);

    // CHAT WARMUP: Parallel chat loading
    useEffect(() => {
        const warmupChat = async () => {
            if (!userId) return;
            setIsChatLoading(true);
            try {
                // For cases, the ID in URL is the match ID itself
                const chat = await getCaseChat(caseId, userId);
                if (chat) setActiveChat(chat);
            } catch (err) {
                console.error("Chat warmup failed:", err);
            } finally {
                setIsChatLoading(false);
            }
        };
        warmupChat();
    }, [caseId, userId]);

    const handleAcceptCase = async (id: string, appointment?: any) => {
        try {
            setIsUpdatingStatus(true);
            
            // Call the consolidated server action
            const result = await acceptAndScheduleCase(id, appointment);

            if (result.success) {
                toast({ 
                    title: "Case Accepted & Scheduled", 
                    description: "The survivor has been notified and a secure chat is now active." 
                });
                fetchCase();
            }
        } catch (err: any) {
            console.error("Acceptance failed:", err);
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const handleCompleteCase = async (id: string) => {
        try {
            setIsUpdatingStatus(true);
            const { error } = await supabase
                .from("matched_services")
                .update({ 
                    match_status_type: "completed", 
                    completed_at: new Date().toISOString(),
                    updated_at: new Date().toISOString() 
                })
                .eq("id", id);

            if (error) throw error;

            // Sync report status
            const targetReportId = caseData?.report_id || caseData?.report?.report_id;
            if (targetReportId) {
                await supabase
                    .from("reports")
                    .update({ 
                        match_status: "completed",
                        updated_at: new Date().toISOString()
                    })
                    .eq("report_id", targetReportId);
            }

            toast({ title: "Case Completed" });
            fetchCase();
        } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
        } finally {
            setIsUpdatingStatus(false);
        }
    };

    const exitSafely = () => { window.location.href = "https://www.google.com"; };

    if (loading || !userId) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white">
				<div className="flex flex-col items-center gap-8">
					<div className="relative">
						<div className="w-20 h-20 border-[3px] border-serene-neutral-100 border-t-sauti-teal rounded-full animate-[spin_1.5s_linear_infinite]" />
						<Heart className="h-7 w-7 text-sauti-teal absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-pulse" />
					</div>
					<div className="text-center space-y-2 animate-in fade-in slide-in-from-bottom-4 duration-700">
						<p className="text-2xl font-bold text-sauti-dark tracking-tight">Accessing Case Securely</p>
						<p className="text-serene-neutral-400 font-medium">Loading details...</p>
					</div>
				</div>
			</div>
        );
    }

    return (
        <div className={cn(
            "flex flex-col min-h-full bg-slate-50/30",
            "min-h-screen"
        )}>




            {/* Completion Confirmation Dialog */}
            <Dialog open={isCompletionDialogOpen} onOpenChange={setIsCompletionDialogOpen}>
                <DialogContent className="w-[95vw] sm:max-w-md rounded-[2rem] border-0 shadow-2xl bg-white p-6 sm:p-8 animate-in fade-in zoom-in-95 duration-300">
                    <DialogHeader className="space-y-4">
                        <div className="w-16 h-16 bg-emerald-50 rounded-[1.5rem] flex items-center justify-center text-emerald-600 mb-2">
                            <ShieldCheck className="h-8 w-8" />
                        </div>
                        <DialogTitle className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">Close this case?</DialogTitle>
                        <DialogDescription className="text-slate-500 font-medium text-sm sm:text-base">
                            Completing this case will finalize all coordination actions for the survivor.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex flex-row gap-3 pt-6 mt-6 border-t border-slate-50">
                        <Button 
                            variant="outline" 
                            className="flex-1 h-12 rounded-xl border-slate-100 font-bold text-[10px] uppercase tracking-widest text-slate-500"
                            onClick={() => setIsCompletionDialogOpen(false)}
                        >
                            Cancel
                        </Button>
                        <Button 
                            className="flex-1 h-12 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-600/20"
                            onClick={async () => {
                                await handleCompleteCase(caseId);
                                setIsCompletionDialogOpen(false);
                            }}
                        >
                            Complete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <main className="sm:py-2 px-4 xs:px-6 transition-all duration-700 animate-in fade-in slide-in-from-bottom-4 flex-1">
                <CaseDetailView 
                    caseItem={caseData}
                    userId={userId}
                    onAcceptCase={handleAcceptCase}
                    onCompleteCase={handleCompleteCase}
                    isUpdatingStatus={isUpdatingStatus}
                    isFullPage={true}
                    activeChat={activeChat}
                    isChatLoading={isChatLoading}
                />
            </main>
        </div>
    );
}
