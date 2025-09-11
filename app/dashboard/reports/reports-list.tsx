"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Tables } from "@/types/db-schema";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface ReportWithRelations extends Tables<"reports"> {
  matched_services?: Array<{
    id: string;
    match_status_type: any;
    support_services: { id: string; name: string };
    appointments?: Array<{
      id: string;
      appointment_id: string;
      appointment_date: string;
      status: string;
      professional?: { first_name?: string; last_name?: string };
    }>;
  }>;
}

export default function ReportsList({ userId }: { userId: string }) {
  const [reports, setReports] = useState<ReportWithRelations[]>([]);
  const [q, setQ] = useState("");
  const supabase = createClient();

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase
        .from("reports")
        .select(`
          *,
          matched_services (
            id,
            match_status_type,
            support_services (
              id,
              name
            ),
            appointments (
              id,
              appointment_id,
              appointment_date,
              status,
              professional:profiles!appointments_professional_id_fkey (
                first_name,
                last_name
              )
            )
          )
        `)
        .eq("user_id", userId)
        .order("submission_timestamp", { ascending: false });
      if (!error) setReports((data as any) || []);
    };
    load();
  }, [supabase, userId]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return reports;
    return reports.filter((r) =>
      (r.type_of_incident || "").toLowerCase().includes(term) ||
      (r.incident_description || "").toLowerCase().includes(term) ||
      (r.urgency || "").toLowerCase().includes(term)
    );
  }, [reports, q]);

  const formatDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Input
          placeholder="Search reports (incident, description, urgency)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
      </div>

      <div className="text-sm text-muted-foreground">{filtered.length} report{filtered.length === 1 ? "" : "s"} found</div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No reports to display.</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((report) => {
            const mostRecentMatch = report.matched_services?.[0];
            const matchLabel = mostRecentMatch
              ? mostRecentMatch.support_services?.name || mostRecentMatch.match_status_type
              : "No match yet";
            const appointment = mostRecentMatch?.appointments?.[0];
            const bg = report.urgency === "high" ? "#FFF5F5" : report.urgency === "medium" ? "#FFF8F0" : "#F0F9FF";
            return (
              <Card key={report.report_id} className="overflow-hidden" style={{ backgroundColor: bg }}>
                <CardContent className="p-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 rounded-full bg-[#1A3434] text-white flex items-center justify-center text-sm">
                          {(report.type_of_incident || "?").charAt(0).toUpperCase()}
                        </div>
                        <h3 className="font-medium truncate">{report.type_of_incident || "Unknown Incident"}</h3>
                      </div>
                      {report.incident_description && (
                        <p className="text-sm text-neutral-600 mt-1 line-clamp-2">
                          {report.incident_description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                        <span>{formatDate(report.submission_timestamp)}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
                        <span className="px-2 py-0.5 rounded-full bg-white/70 border text-neutral-700">{report.urgency || "low"}</span>
                        <span className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
                        <span className="px-2 py-0.5 rounded-full bg-white/70 border text-neutral-700 truncate">{matchLabel}</span>
                      </div>
                      
                      {/* Appointment Information */}
                      {appointment && (
                        <div className="mt-3 p-3 bg-white/70 rounded-lg border border-white/50">
                          <div className="flex items-center justify-between">
                            <div className="min-w-0 flex-1">
                              <h4 className="text-sm font-medium text-[#1A3434] mb-1">Scheduled Appointment</h4>
                              <div className="flex items-center gap-2 text-xs text-neutral-600">
                                <span>{new Date(appointment.appointment_date).toLocaleDateString()}</span>
                                <span>•</span>
                                <span>{new Date(appointment.appointment_date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                {appointment.professional && (
                                  <>
                                    <span>•</span>
                                    <span>{appointment.professional.first_name} {appointment.professional.last_name}</span>
                                  </>
                                )}
                              </div>
                              <div className="mt-1">
                                <span className={`px-2 py-0.5 rounded-full text-xs ${
                                  appointment.status === 'confirmed' ? 'bg-blue-100 text-blue-700' :
                                  appointment.status === 'completed' ? 'bg-green-100 text-green-700' :
                                  'bg-gray-100 text-gray-700'
                                }`}>
                                  {appointment.status.charAt(0).toUpperCase() + appointment.status.slice(1)}
                                </span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {appointment.status === 'confirmed' && (
                                <button className="px-3 py-1 bg-[#1A3434] text-white text-xs rounded-md hover:bg-[#2A4444] transition-colors">
                                  Join Meeting
                                </button>
                              )}
                              <button className="p-1 text-neutral-400 hover:text-neutral-600 transition-colors">
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                </svg>
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

