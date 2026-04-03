"use client";

import { useMemo, useEffect, useCallback } from "react";
import { createClient } from "@/utils/supabase/client";
import { useDashboardData } from "@/components/providers/DashboardDataProvider";
import { ReportWithRelations, MatchedServiceWithRelations, AppointmentWithDetails } from "./_types";
import { useToast } from "@/hooks/use-toast";

export function useDashboard() {
  const dash = useDashboardData();
  const { toast } = useToast();

  if (!dash) {
    throw new Error("useDashboard must be used within a DashboardDataProvider");
  }

  const { data, updatePartial, isReportDialogOpen, setIsReportDialogOpen } = dash;
  const userId = data?.userId;

  // Real-time subscriptions
  useEffect(() => {
    if (!userId) return;

    const supabase = createClient();
    
    // 1. Listen for changes to reports I created (as survivor)
    const reportsChannel = supabase
      .channel(`realtime_reports_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'reports', filter: `user_id=eq.${userId}` },
        async (payload) => {
          const targetId = payload.new ? (payload.new as any).report_id : (payload.old as any).report_id;
          if (!targetId) return;

          if (payload.eventType === 'DELETE') {
            updatePartial({
              reports: data?.reports.filter(r => r.report_id !== targetId) || []
            });
            return;
          }

          // Fetch fresh data with relations
          const { data: updatedReport } = await supabase
            .from('reports')
            .select(`
              *,
              matched_services (
                *,
                service_details:support_services!matched_services_service_id_fkey (
                  *
                ),
                appointments (
                  *
                )
              )
            `)
            .eq('report_id', targetId)
            .maybeSingle();

          if (updatedReport) {
            updatePartial({
              reports: data?.reports.map(r => r.report_id === targetId ? (updatedReport as any) : r) || []
            });
            
            // If it's a new report, prepend it
            if (!data?.reports.some(r => r.report_id === targetId)) {
                updatePartial({
                    reports: [updatedReport as any, ...(data?.reports || [])]
                });
            }
          }
        }
      )
      .subscribe();

    // 2. Listen for changes to matched_services where I am the professional
    const matchesChannel = supabase
      .channel(`realtime_matches_${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matched_services' }, // Cannot easily filter by professional_id in standard payload if it's nested, but we can check the payload
        async (payload: any) => {
          // Since we can't filter complexly in subscription, we fetch if relevant
          // A better way is to listen for ANY change to matched_services and then refresh if it impacts our provider services
          // For now, let's keep it simple: refresh matches on any change if the user is a professional
          if (data?.userType === 'professional') {
             // In a real app, we'd be more selective. Here we'll refresh matches.
             // We'll rely on the view to trigger specific fetches if needed, 
             // but let's provide a refreshMatches utility.
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(reportsChannel);
      supabase.removeChannel(matchesChannel);
    };
  }, [userId, data?.reports, data?.userType, updatePartial]);

  // Derived Stats
  const stats = useMemo(() => {
    const reports = (data?.reports || []).filter(r => {
      const admin = (r.administrative as Record<string, any>) || {};
      return !admin.is_archived;
    });
    const matches = data?.matchedServices || [];
    const appointments = data?.appointments || [];

    return {
      activeReportsCount: reports.length,
      matchedReportsCount: reports.filter(r => (r.matched_services?.length || 0) > 0).length,
      activeCasesCount: matches.filter(m => (m.match_status_type || "").toLowerCase() !== 'completed').length,
      pendingCasesCount: matches.filter(m => (m.match_status_type || "").toLowerCase() === 'pending').length,
      upcomingAppointmentsCount: appointments.filter(a => a.appointment_date && new Date(a.appointment_date) > new Date()).length,
      totalServicesCount: data?.supportServices?.length || 0,
      unreadChatCount: data?.unreadChatCount || 0
    };
  }, [data]);

  // Common Utilities
  const getTimeOfDay = useCallback((): "morning" | "afternoon" | "evening" => {
    const hour = new Date().getHours();
    if (hour < 12) return "morning";
    if (hour < 18) return "afternoon";
    return "evening";
  }, []);

  return {
    userId,
    profile: data?.profile,
    userType: data?.userType,
    reports: data?.reports || [],
    matchedServices: data?.matchedServices || [],
    supportServices: data?.supportServices || [],
    appointments: data?.appointments || [],
    stats,
    isReportDialogOpen,
    setIsReportDialogOpen,
    isAdminMode: data?.isAdminMode || false,
    getTimeOfDay,
    updatePartial
  };
}
