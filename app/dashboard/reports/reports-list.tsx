"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Tables } from "@/types/db-schema";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ReportCard, type ReportCardData } from "@/components/reports/ReportCard";

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
  const [page, setPage] = useState(1);
  const pageSize = 10;
  const supabase = useMemo(() => createClient(), []);

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
  }, [userId]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return reports;
    return reports.filter((r) =>
      (r.type_of_incident || "").toLowerCase().includes(term) ||
      (r.incident_description || "").toLowerCase().includes(term) ||
      (r.urgency || "").toLowerCase().includes(term)
    );
  }, [reports, q]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page]);

  const formatDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString() : "");

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-2">
        <Input
          placeholder="Search reports (incident, description, urgency)"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setPage(1);
          }}
        />
        {/* Quick filters could go here (chips by urgency, matched, with-audio, etc.) */}
      </div>

      <div className="text-sm text-muted-foreground">
        {filtered.length} report{filtered.length === 1 ? "" : "s"} found
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">No reports to display.</div>
      ) : (
        <div className="space-y-3">
          {pageItems.map((report) => (
            <ReportCard key={report.report_id} data={report as unknown as ReportCardData} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {filtered.length > pageSize && (
        <div className="flex items-center justify-between pt-2">
          <button
            className="px-3 py-1.5 text-sm rounded-md border bg-white disabled:opacity-50"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <div className="text-xs text-muted-foreground">
            Page {page} of {totalPages}
          </div>
          <button
            className="px-3 py-1.5 text-sm rounded-md border bg-white disabled:opacity-50"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

