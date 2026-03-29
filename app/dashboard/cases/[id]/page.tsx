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
import { Chat } from "@/types/chat";
import { Card } from "@/components/ui/card";

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
                
                // Fetch chat if survivor/user_id exists
                const survId = (data.survivor_id || data.report?.user_id) as string;
                if (survId) {
                    setIsChatLoading(true);
                    getCaseChat(data.id, survId)
                        .then(chat => setActiveChat(chat))
                        .catch(err => console.error("Chat load failed", err))
                        .finally(() => setIsChatLoading(false));
                }
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

    const handleAcceptCase = async (id: string) => {
        try {
            setIsUpdatingStatus(true);
            const { error } = await supabase
                .from("matched_services")
                .update({ match_status_type: "accepted", updated_at: new Date().toISOString() })
                .eq("id", id);

            if (error) throw error;
            
            // Sync report status - use multiple possible ID locations to be robust
            const targetReportId = caseData?.report_id || caseData?.report?.report_id;
            if (targetReportId) {
                await supabase
                    .from("reports")
                    .update({ 
                        match_status: "accepted",
                        updated_at: new Date().toISOString()
                    })
                    .eq("report_id", targetReportId);
            }

            toast({ title: "Case Accepted" });
            fetchCase();
        } catch (err: any) {
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
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
				<div className="flex flex-col items-center gap-6">
					<div className="relative">
						<div className="w-16 h-16 border-4 border-teal-100 border-t-teal-600 rounded-full animate-spin" />
						<Heart className="h-6 w-6 text-teal-600 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
					</div>
					<div className="text-center">
						<p className="text-xl font-bold text-slate-900">Accessing Case Securely</p>
						<p className="text-slate-400 font-medium">Loading details...</p>
					</div>
				</div>
			</div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50/50 pb-32 lg:pb-12 text-slate-900 selection:bg-teal-100">
            {/* Focused Header Navigation */}
			<nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-100 transition-all duration-300">
				<div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between gap-6">
					<div className="flex items-center gap-4">
						<Link href="/dashboard/cases" className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center hover:bg-slate-100 transition-all text-slate-600">
							<ChevronLeft className="h-5 w-5" />
						</Link>
						<div className="hidden sm:block">
							<div className="flex items-center gap-2 text-teal-600 font-extrabold uppercase tracking-[0.2em] text-[10px] mb-0.5">
								<ShieldCheck className="h-3.5 w-3.5" />
								Professional Support Mode
							</div>
							<h2 className="text-slate-900 font-bold tracking-tight">Case Journey SS-{caseId.slice(0, 8).toUpperCase()}</h2>
						</div>
					</div>

					<div className="flex items-center gap-3">
						<Button onClick={exitSafely} variant="ghost" className="text-slate-400 hover:text-rose-500 font-bold text-xs gap-2">
							<LogOut className="h-4 w-4" /> Quick Exit
						</Button>
					</div>
				</div>
			</nav>

            <main className="max-w-7xl mx-auto py-12">
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
