"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/utils/supabase/client";
import { getUser } from "@/utils/supabase/server";
import { SereneProviderCard, SereneSectionHeader } from "../_components/SurvivorDashboardComponents";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import { Shield, Heart, Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/useUser";
import { Skeleton } from "@/components/ui/skeleton";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function MatchesPage() {
  const dash = useDashboardData();
  const user = useUser();
  const router = useRouter();
  const [matches, setMatches] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    // Attempt to seed from provider first, though specific matches data might need deep fetch
    if (dash?.data?.reports) {
      // Extract matches from reports
      const extractedMatches: any[] = [];
      const reports = dash.data.reports as any[];
      
      reports.forEach(report => {
         if (report.matched_services && report.matched_services.length > 0) {
            report.matched_services.forEach((match: any) => {
               // Only show active/pending matches, not declined ones unless history requested
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

    // Always fetch fresh if not satisfied or to verify
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

       <div className="max-w-xl mx-auto px-4 pt-6 space-y-6">
          <SereneSectionHeader 
             title="Connected Services"
             description="Professionals and organizations matched with your cases."
          />

          {loading ? (
             <div className="space-y-4">
               {[1,2].map(i => <Skeleton key={i} className="h-48 w-full rounded-3xl" />)}
             </div>
          ) : filteredMatches.length > 0 ? (
             <div className="grid gap-6">
                {filteredMatches.map((match) => (
                   <div key={match.id}>
                      <div className="flex items-center gap-2 mb-2 px-1">
                         <Shield className="h-3 w-3 text-serene-neutral-400" />
                         <span className="text-xs font-medium text-serene-neutral-500 uppercase tracking-wide">
                            Matched for {match.report?.type_of_incident?.replace(/_/g, " ")}
                         </span>
                      </div>
                      <SereneProviderCard 
                        provider={{
                           name: match.support_service?.name || "Unknown Provider",
                           role: match.support_service?.service_types?.replace(/_/g, " ") || "Support Service",
                           matchScore: match.match_score || 95,
                           matchStatus: match.match_status_type,
                           rating: 4.8 // Placeholder, requires review system
                        }}
                        onBook={() => router.push(`/dashboard/appointments?providerId=${match.support_service?.id}`)}
                        onChat={() => router.push(`/dashboard/chat?userId=${match.support_service?.user_id}`)}
                      />
                   </div>
                ))}
             </div>
          ) : (
             <div className="text-center py-12 px-6 bg-white rounded-3xl border border-dashed border-serene-neutral-200">
                <div className="bg-serene-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                   <Heart className="h-6 w-6 text-serene-blue-400" />
                </div>
                <h3 className="text-lg font-bold text-serene-neutral-900 mb-2">No Matches Yet</h3>
                <p className="text-serene-neutral-500 text-sm max-w-xs mx-auto mb-6">
                   When you file a report, our system automatically connects you with the best support services for your needs.
                </p>
                <Button className="rounded-xl bg-serene-blue-600 hover:bg-serene-blue-700 text-white font-semibold" asChild>
                   <Link href="/report-abuse">File a Report</Link>
                </Button>
             </div>
          )}
       </div>
    </div>
  );
}
