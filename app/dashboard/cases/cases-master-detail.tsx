"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/utils/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Calendar as UIDateCalendar } from "@/components/ui/calendar";
import { CalendarDays, ChevronLeft, ChevronRight, Clock, FileText, Shield } from "lucide-react";
import CaseNotesEditor from "./case-notes-editor";

interface MatchedServiceItem {
  id: string;
  match_date: string | null;
  match_status_type: string | null;
  match_score: number | null;
  report: any;
  support_service: any;
  notes?: string | null;
  appointments?: Array<{ id: string; appointment_id: string; appointment_date: string; status: string; }>
}

export default function CasesMasterDetail({ userId }: { userId: string }) {
  const supabase = useMemo(() => createClient(), []);
  const [cases, setCases] = useState<MatchedServiceItem[]>([]);
  const [q, setQ] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<"list" | "calendar">("list");

  // Load matched services and appointments in parallel
  useEffect(() => {
    const load = async () => {
      // Get the user's services
      const { data: services } = await supabase
        .from("support_services")
        .select("id")
        .eq("user_id", userId);
      const ids = (services || []).map((s) => s.id);
      if (ids.length === 0) { setCases([]); return; }

      const [{ data: matches }, { data: appts }] = await Promise.all([
        supabase
          .from("matched_services")
          .select(`*, report:reports(*), support_service:support_services(*)`)
          .in("service_id", ids)
          .order("match_date", { ascending: false }),
        supabase
          .from("appointments")
          .select("*, matched_services")
          .in("matched_services", ids.length ? (await supabase.from("matched_services").select("id").in("service_id", ids)).data?.map((m:any)=>m.id) || [] : [])
      ]);

      const apptByMatchId = new Map<string, any[]>();
      (appts || []).forEach((a: any) => {
        const k = a.matched_services as string;
        const arr = apptByMatchId.get(k) || [];
        arr.push(a);
        apptByMatchId.set(k, arr);
      });

const normalized: MatchedServiceItem[] = (matches || []).map((m: any) => ({
        ...m,
        notes: m.notes || null,
        appointments: apptByMatchId.get(m.id) || [],
      }));

      setCases(normalized);
    };
    load();
  }, [userId]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return cases;
    return cases.filter((c) =>
      (c.report?.type_of_incident || "").toLowerCase().includes(term) ||
      (c.report?.incident_description || "").toLowerCase().includes(term) ||
      (c.match_status_type || "").toLowerCase().includes(term)
    );
  }, [cases, q]);

  const selected = useMemo(() => filtered.find((c) => c.id === selectedId) || null, [filtered, selectedId]);

  const appointmentDates = useMemo(() => {
    const set = new Set<string>();
    for (const c of cases) {
      for (const a of (c.appointments || [])) {
        if (a.appointment_date) set.add(new Date(a.appointment_date).toDateString());
      }
    }
    return set;
  }, [cases]);

  const isDateBooked = (date: Date) => appointmentDates.has(date.toDateString());

  const urgencyColor = (u?: string | null) => u === "high" ? "bg-red-100 text-red-700" : u === "medium" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700";

  return (
    <div className={`grid grid-cols-1 lg:grid-cols-12 gap-4 ${selected ? 'overflow-x-hidden' : ''}`}>
      {/* Mobile toggle */}
      <div className="lg:hidden -mt-1 mb-1">
        <div className="inline-flex rounded-lg border bg-white p-1">
          <button onClick={() => setMobileView("list")} className={`px-3 py-1.5 text-xs font-medium rounded-md ${mobileView === 'list' ? 'bg-[#1A3434] text-white' : 'text-neutral-700'}`}>Cases</button>
          <button onClick={() => setMobileView("calendar")} className={`px-3 py-1.5 text-xs font-medium rounded-md ${mobileView === 'calendar' ? 'bg-[#1A3434] text-white' : 'text-neutral-700'}`}>Calendar</button>
        </div>
      </div>

      {/* Master list */}
      <div className={`lg:col-span-7 xl:col-span-7 ${mobileView !== 'list' ? 'hidden lg:block' : ''}`}>
        <div className="mb-3 flex items-center gap-2">
          <Input placeholder="Search cases (incident, description, status)" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="space-y-2">
          {filtered.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">No cases to display.</div>
          )}
          {filtered.map((c) => {
            const appt = c.appointments?.[0];
            const isActive = selected?.id === c.id;
            return (
              <button key={c.id} onClick={() => setSelectedId(c.id)} className={`w-full text-left rounded-lg border p-3 bg-white hover:shadow transition-shadow ${isActive ? 'ring-2 ring-[#1A3434]' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="h-8 w-8 rounded-full bg-[#1A3434] text-white flex items-center justify-center text-sm shrink-0">
                    {(c.report?.type_of_incident || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium truncate">{c.report?.type_of_incident || 'Unknown Incident'}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-xs ${urgencyColor(c.report?.urgency)}`}>{c.report?.urgency || 'low'}</span>
                    </div>
                    {c.report?.incident_description && (
                      <p className="text-xs text-neutral-600 mt-1 line-clamp-2">{c.report.incident_description}</p>
                    )}
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
                      <span>{c.match_date ? new Date(c.match_date).toLocaleDateString() : 'Matched recently'}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
                      <span className="px-2 py-0.5 rounded-full bg-neutral-100 border text-neutral-700 truncate">{c.support_service?.name || 'Service'}</span>
                      {appt && (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-neutral-300" />
                          <span className="flex items-center gap-1"><CalendarDays className="h-3 w-3" /> {new Date(appt.appointment_date).toLocaleDateString()}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <ChevronRight className={`h-4 w-4 text-neutral-400 shrink-0 ${isActive ? 'opacity-0' : ''}`} />
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Calendar column */}
      <div className={`lg:col-span-5 xl:col-span-5 ${mobileView !== 'calendar' ? 'hidden lg:block' : ''}`}>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-medium text-neutral-700">Appointments Calendar</h3>
            {selectedId && (
              <Button variant="ghost" size="sm" onClick={() => setSelectedId(null)} className="h-7 text-xs">Clear selection</Button>
            )}
          </div>
          <UIDateCalendar
            mode="single"
            showOutsideDays
            className="p-0"
            classNames={{
              caption: "flex items-center justify-between px-1 py-2",
              nav: "flex items-center gap-2",
              nav_button_previous: "relative left-0",
              nav_button_next: "relative right-0",
            }}
            modifiers={{ booked: (date) => isDateBooked(date) }}
            modifiersStyles={{ booked: { backgroundColor: '#E0F2FE', color: '#0369A1', borderRadius: 6 } }}
            onSelect={(date) => {
              if (!date) return;
              const dayKey = date.toDateString();
              const firstWithAppt = filtered.find((c) => (c.appointments || []).some((a) => new Date(a.appointment_date).toDateString() === dayKey));
              if (firstWithAppt) setSelectedId(firstWithAppt.id);
            }}
          />
          <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
            <span className="inline-block w-3 h-3 rounded bg-sky-100 border border-sky-300" /> Booked day
          </div>
        </Card>
      </div>

      {/* Detail side panel */}
      <div className={`fixed inset-0 sm:inset-y-0 sm:right-0 sm:left-auto w-full sm:w-[540px] lg:w-[720px] bg-white shadow-2xl border-l z-40 transform transition-transform duration-300 ease-out ${selected ? 'translate-y-0 sm:translate-x-0' : 'translate-y-full sm:translate-x-full'}`} aria-hidden={!selected}>
        {selected && (
          <div className="h-full flex flex-col">
            <div className="p-4 border-b flex items-start justify-between gap-3 sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <button onClick={() => setSelectedId(null)} className="sm:hidden -ml-1 p-1 rounded hover:bg-neutral-100">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <div>
                  <h2 className="text-base sm:text-lg font-semibold text-[#1A3434]">{selected.report?.type_of_incident || 'Unknown Incident'}</h2>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${urgencyColor(selected.report?.urgency)}`}>{selected.report?.urgency || 'low'}</span>
                </div>
                <div className="mt-1 text-xs text-neutral-600 flex items-center gap-2">
                  <Shield className="h-3 w-3" /> Case ID: {selected.id}
                  <span>•</span>
                  <Clock className="h-3 w-3" /> {selected.match_date ? new Date(selected.match_date).toLocaleString() : 'Recently'}
                </div>
              </div>
              <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setSelectedId(null)}>
                <FileText className="h-5 w-5" />
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 p-4 pb-24 sm:pb-6 overflow-y-auto">
              <div className="lg:col-span-3 space-y-4">
                {selected.report?.incident_description && (
                  <div className="p-4 rounded-lg bg-neutral-50 border">
                    <h3 className="text-sm font-medium text-neutral-700 mb-1">Incident Description</h3>
                    <p className="text-sm text-neutral-800 whitespace-pre-wrap">{selected.report.incident_description}</p>
                  </div>
                )}

                <CaseNotesEditor matchId={selected.id} initialHtml={selected.notes || ''} onSaved={(html) => {
                  setCases(prev => prev.map(c => c.id === selected.id ? ({ ...c, notes: html }) : c));
                }} />
              </div>

              <div className="lg:col-span-2 space-y-4">
                <div className="p-4 rounded-lg bg-neutral-50 border">
                  <h3 className="text-sm font-medium text-neutral-700 mb-1">Matched Service</h3>
                  <p className="text-sm text-neutral-800">{selected.support_service?.name || 'Service'}</p>
                  <p className="text-xs text-neutral-500">Status: {String(selected.match_status_type || 'pending')}</p>
                </div>
                {selected.appointments?.[0] && (
                  <div className="p-4 rounded-lg bg-neutral-50 border">
                    <h3 className="text-sm font-medium text-neutral-700 mb-1">Appointment</h3>
                    <div className="text-sm text-neutral-800 flex items-center gap-2">
                      <CalendarDays className="h-4 w-4" /> {new Date(selected.appointments[0].appointment_date).toLocaleString()}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

