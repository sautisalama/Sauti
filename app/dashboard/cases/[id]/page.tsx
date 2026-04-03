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
    Calendar as CalendarIcon
} from "lucide-react";
import { 
    DropdownMenu, 
    DropdownMenuContent, 
    DropdownMenuItem, 
    DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Card } from "@/components/ui/card";
import { SereneBreadcrumb } from "@/components/ui/SereneBreadcrumb";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";

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
                        {caseData.match_status_type !== 'completed' && caseData.match_status_type !== 'pending' && (
                            <DropdownMenuItem 
                                onClick={() => router.push(`/dashboard/cases/${caseId}`)} // Just a placeholder or logic for detail
                                className="flex items-center gap-3 cursor-pointer rounded-xl focus:bg-serene-neutral-50 focus:text-sauti-teal p-3 text-sm font-semibold text-serene-neutral-700"
                            >
                                <CheckCircle2 className="h-4 w-4" />
                                Mark as Completed
                            </DropdownMenuItem>
                        )}
                        {process.env.NODE_ENV === 'development' && (
                            <DropdownMenuItem 
                                className="flex items-center gap-3 cursor-pointer rounded-xl focus:bg-rose-50 focus:text-rose-600 p-3 text-sm font-semibold text-rose-600"
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
			{/* Focused Header Navigation - Mobile Only (Hidden on Desktop) */}
			<nav className="lg:hidden sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-serene-neutral-100/50 transition-all duration-300 min-h-[64px] sm:min-h-[72px] flex items-center shrink-0">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 w-full flex items-center justify-between gap-4 py-2 sm:py-0">
					<div className="flex items-center gap-2 sm:gap-4 flex-1 min-w-0">
						<Link href="/dashboard/cases" className="shrink-0 w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-serene-neutral-50 flex items-center justify-center hover:bg-serene-neutral-100 transition-all text-serene-neutral-600">
							<ChevronLeft className="h-4 w-4 sm:h-5 sm:w-5" />
						</Link>
						<div className="flex-1 min-w-0">
							<div className="hidden sm:flex items-center gap-2 text-sauti-teal font-extrabold uppercase tracking-[0.2em] text-[8px] sm:text-[10px] mb-0.5">
								<ShieldCheck className="h-3.5 w-3.5" />
								<span className="truncate">Professional Support Mode</span>
							</div>
							<h2 className="text-sauti-dark font-bold tracking-tight uppercase text-[10px] sm:text-base whitespace-nowrap overflow-hidden text-ellipsis">
                                Case Journey SS-{caseId.slice(0, 8).toUpperCase()}
                            </h2>
						</div>
					</div>

					<div className="flex items-center gap-2 sm:gap-3 shrink-0">
						<Button onClick={exitSafely} variant="ghost" className="text-serene-neutral-400 hover:text-rose-500 font-bold text-[9px] sm:text-[10px] gap-2 uppercase tracking-widest h-8 sm:h-10 px-1 sm:px-2 group">
							<LogOut className="h-3.5 w-3.5 sm:h-4 sm:w-4 group-hover:scale-110 transition-transform" /> 
							<span className="hidden sm:inline text-serene-neutral-500">Quick Exit</span>
						</Button>
					</div>
				</div>
			</nav>


            <main className="max-w-7xl mx-auto py-2 sm:py-6 px-4 xs:px-6 transition-all duration-700 animate-in fade-in slide-in-from-bottom-4 flex-1">
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
