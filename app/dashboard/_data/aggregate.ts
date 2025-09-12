"use server";

import { createClient, getUser } from "@/utils/supabase/server";
import { Tables } from "@/types/db-schema";
import { fetchUserReports } from "@/app/dashboard/_views/actions/reports";
import { AppointmentWithDetails, MatchedServiceWithRelations, ReportWithRelations } from "@/app/dashboard/_types";

export type AggregatedDashboardData = {
  userId: string;
  profile: Tables<"profiles">;
  userType: Tables<"profiles">["user_type"] | null;
  reports: ReportWithRelations[];
  matchedServices: MatchedServiceWithRelations[];
  supportServices: Tables<"support_services">[];
  appointments: AppointmentWithDetails[];
  casesCount: number;
  unreadChatCount: number; // to be filled client-side quickly
  preloaded: boolean;
};

export async function fetchDashboardData(): Promise<AggregatedDashboardData | null> {
  const profile = await getUser();
  if (!profile) return null;

  const supabase = await createClient();

  const userId = profile.id;
  const userType = profile.user_type ?? null;

  const isPro = userType === "professional" || userType === "ngo";

  const supportServicesPromise = isPro
    ? supabase
        .from("support_services")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .then(({ data }) => (data as Tables<"support_services">[]) || [])
    : Promise.resolve([] as Tables<"support_services">[]);

  const reportsPromise = fetchUserReports(userId).catch(() => [] as ReportWithRelations[]);

  const matchedServicesPromise = (async (): Promise<MatchedServiceWithRelations[]> => {
    if (!isPro) return [] as MatchedServiceWithRelations[];
    const { data: services } = await supabase.from("support_services").select("id").eq("user_id", userId);
    const ids = (services || []).map((s: any) => s.id);
    if (ids.length === 0) return [] as MatchedServiceWithRelations[];
    const { data } = await supabase
      .from("matched_services")
      .select(`
        *,
        report:reports(*),
        support_service:support_services(*)
      `)
      .in("service_id", ids)
      .order("match_date", { ascending: false });
    return (data as any) || [];
  })();

  const appointmentsPromise = (async (): Promise<AppointmentWithDetails[]> => {
    let query = supabase.from("appointments").select(
      `
      *,
      matched_service:matched_services (
        *,
        support_service:support_services (*),
        report:reports (*)
      ),
      professional:profiles!appointments_professional_id_fkey (*),
      survivor:profiles!appointments_survivor_id_fkey (*)
    `
    );
    if (isPro) {
      // Professionals: include both roles (they may create with themselves)
      query = query.or(`professional_id.eq.${userId},survivor_id.eq.${userId}`);
    } else {
      query = query.eq("survivor_id", userId);
    }
    const { data } = await query;
    return (data as any) || [];
  })();

  const casesCountPromise = (async (): Promise<number> => {
    if (!isPro) return 0;
    const { data: services } = await supabase.from("support_services").select("id").eq("user_id", userId);
    const ids = (services || []).map((s: any) => s.id);
    if (ids.length === 0) return 0;
    const { count } = await supabase
      .from("matched_services")
      .select("id", { count: "exact", head: true })
      .in("service_id", ids);
    return count || 0;
  })();

  const [supportServices, reports, matchedServices, appointments, casesCount] = await Promise.all([
    supportServicesPromise,
    reportsPromise,
    matchedServicesPromise,
    appointmentsPromise,
    casesCountPromise,
  ]);

  return {
    userId,
    profile,
    userType,
    reports: (reports as any) || [],
    matchedServices: (matchedServices as any) || [],
    supportServices: supportServices || [],
    appointments: (appointments as any) || [],
    casesCount: casesCount || 0,
    unreadChatCount: 0, // computed on client quickly
    preloaded: true,
  };
}
