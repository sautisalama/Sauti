"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { SereneProviderCard, SereneSectionHeader } from "../_components/SurvivorDashboardComponents";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import { Shield, Heart, Search, MessageCircle, Calendar, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/useUser";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useRouter } from "next/navigation";

function getMatchQuality(score: number): { label: string; color: string; bgColor: string } {
  if (score >= 60) return { label: 'Excellent Match', color: 'text-emerald-600', bgColor: 'bg-emerald-50 border-emerald-100' };
  if (score >= 30) return { label: 'Good Match', color: 'text-serene-blue-600', bgColor: 'bg-serene-blue-50 border-serene-blue-100' };
  return { label: 'Potential Match', color: 'text-amber-600', bgColor: 'bg-amber-50 border-amber-100' };
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'accepted':
      return { label: 'Connected', icon: CheckCircle2, color: 'text-emerald-600 bg-emerald-50 border-emerald-100' };
    case 'pending':
    case 'proposed':
      return { label: 'Pending', icon: Clock, color: 'text-amber-600 bg-amber-50 border-amber-100' };
    case 'pending_survivor':
      return { label: 'Your Action', icon: AlertTriangle, color: 'text-serene-blue-600 bg-serene-blue-50 border-serene-blue-100' };
    case 'completion_pending':
      return { label: 'Wrapping Up', icon: Clock, color: 'text-purple-600 bg-purple-50 border-purple-100' };
    case 'reschedule_requested':
      return { label: 'Rescheduling', icon: Calendar, color: 'text-amber-600 bg-amber-50 border-amber-100' };
    default:
      return { label: status?.replace(/_/g, ' ') || 'Active', icon: Shield, color: 'text-serene-neutral-600 bg-serene-neutral-50 border-serene-neutral-100' };
  }
}

export default function MatchesPage() {
  const dash = useDashboardData();
  const user = useUser();
  const router = useRouter();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // Attempt to seed from provider first
    if (dash?.data?.reports) {
      const extractedMatches: any[] = [];
      const reports = dash.data.reports as any[];
      
      reports.forEach(report => {
         if (report.matched_services && report.matched_services.length > 0) {
            report.matched_services.forEach((match: any) => {
               if (match.match_status_type !== 'declined') {
                 extractedMatches.push({
                   ...match,
                   source_report: report.type_of_incident 
                 });
               }
            });
         }
      });
      
      if (extractedMatches.length > 0) {
        setMatches(extractedMatches);
        setLoading(false);
      }
    }

    // Always fetch fresh if not satisfied
    const fetchMatches = async () => {
       if (!user?.id) return;
       const supabase = createClient();
       
       const { data, error } = await supabase
         .from('matched_services')
         .select(`
            *,
            support_service:support_services (
               id,
               name,
               service_types,
               phone_number,
               email,
               website,
               user_id
            ),
            report:reports!inner (
               report_id,
               type_of_incident
            )
         `)
         .order('match_date', { ascending: false });

       if (error) {
         console.error("Error fetching matches", error);
       } else {
         setMatches(data || []);
       }
       setLoading(false);
    };

    fetchMatches();
  }, [user?.id, dash?.data]);

  const filteredMatches = useMemo(() => {
     return matches.filter(m => 
        m.support_service?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.support_service?.service_types?.toLowerCase().includes(searchQuery.toLowerCase())
     );
  }, [matches, searchQuery]);

  // Group matches by status for better UX
  const activeMatches = filteredMatches.filter(m => 
    ['accepted', 'pending', 'proposed', 'pending_survivor', 'reschedule_requested'].includes(m.match_status_type)
  );
  const completionMatches = filteredMatches.filter(m => 
    ['completion_pending', 'completed', 'completed_auto'].includes(m.match_status_type)
  );

  return (
    <div className="min-h-screen bg-serene-neutral-50 pb-24">
       {/* Header */}
       <div className="bg-white/80 backdrop-blur-md sticky top-0 z-20 border-b border-serene-neutral-200/60 px-4 py-4">
          <div className="max-w-xl mx-auto flex items-center justify-between">
             <h1 className="text-xl font-bold text-serene-neutral-900 tracking-tight">Your Matches</h1>
             <div className="relative w-full max-w-[200px] md:max-w-xs ml-4">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-serene-neutral-400" />
                <Input 
                  placeholder="Find a provider..." 
                  className="pl-9 h-9 bg-serene-neutral-50 border-serene-neutral-200 rounded-xl" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
             </div>
          </div>
       </div>

       <div className="max-w-xl mx-auto px-4 pt-6 space-y-8">
          {/* Active Matches Section */}
          <div>
            <SereneSectionHeader 
               title="Connected Services"
               description="Active support professionals matched with your cases."
            />

            {loading ? (
               <div className="space-y-4 mt-4">
                 {[1,2].map(i => <Skeleton key={i} className="h-48 w-full rounded-2xl" />)}
               </div>
            ) : activeMatches.length > 0 ? (
               <div className="grid gap-6 mt-4">
                  {activeMatches.map((match) => {
                     const quality = getMatchQuality(match.match_score || 0);
                     const status = getStatusBadge(match.match_status_type);
                     const StatusIcon = status.icon;
                     
                     return (
                       <div key={match.id}>
                          <div className="flex items-center justify-between mb-2 px-1">
                             <div className="flex items-center gap-2">
                                <Shield className="h-3 w-3 text-serene-neutral-400" />
                                <span className="text-xs font-medium text-serene-neutral-500 uppercase tracking-wide">
                                   Matched for {match.report?.type_of_incident?.replace(/_/g, " ")}
                                </span>
                             </div>
                             <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border ${status.color}`}>
                                <StatusIcon className="h-3 w-3" />
                                {status.label}
                             </div>
                          </div>

                          {/* Match Quality Indicator */}
                          <div className={`px-3 py-1.5 rounded-t-2xl border border-b-0 ${quality.bgColor} flex items-center justify-between`}>
                             <span className={`text-[10px] font-bold ${quality.color}`}>
                                {quality.label}
                             </span>
                             {match.match_reason && (
                                <span className="text-[9px] text-serene-neutral-400 truncate max-w-[200px]">
                                   {match.match_reason.split(',')[0]}
                                </span>
                             )}
                          </div>

                          <SereneProviderCard 
                            provider={{
                               name: match.support_service?.name || "Unknown Provider",
                               role: match.support_service?.service_types?.replace(/_/g, " ") || "Support Service",
                               matchScore: match.match_score || 0,
                               matchStatus: match.match_status_type,
                               rating: 4.8
                            }}
                            onBook={() => router.push(`/dashboard/appointments?providerId=${match.support_service?.id}`)}
                            onChat={() => {
                              if (match.chat_id) {
                                router.push(`/dashboard/chat/${match.chat_id}`);
                              } else {
                                router.push(`/dashboard/chat?userId=${match.support_service?.user_id}`);
                              }
                            }}
                          />
                       </div>
                     );
                  })}
               </div>
            ) : (
               <div className="text-center py-12 px-6 bg-white rounded-2xl border border-dashed border-serene-neutral-200 mt-4">
                  <div className="bg-serene-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                     <Heart className="h-6 w-6 text-serene-blue-400" />
                  </div>
                  <h3 className="text-lg font-bold text-serene-neutral-900 mb-2">No Active Matches</h3>
                  <p className="text-serene-neutral-500 text-sm max-w-xs mx-auto mb-6">
                     When you file a report, our system automatically connects you with the best support services for your needs.
                  </p>
                  <Button className="rounded-xl bg-serene-blue-600 hover:bg-serene-blue-700 text-white font-semibold" asChild>
                     <Link href="/report-abuse">File a Report</Link>
                  </Button>
               </div>
            )}
          </div>

          {/* Completed Matches Section */}
          {completionMatches.length > 0 && (
            <div>
              <SereneSectionHeader 
                 title="Completed Cases"
                 description="Past support connections that have been completed."
              />
              <div className="grid gap-4 mt-4">
                {completionMatches.map((match) => (
                  <div key={match.id} className="bg-white rounded-2xl border border-serene-neutral-100 p-4 opacity-70">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-semibold text-sm text-serene-neutral-700">{match.support_service?.name || "Provider"}</h4>
                        <p className="text-xs text-serene-neutral-400 capitalize">{match.support_service?.service_types?.replace(/_/g, " ")}</p>
                      </div>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100">
                        <CheckCircle2 className="h-3 w-3" />
                        Completed
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
       </div>
    </div>
  );
}
