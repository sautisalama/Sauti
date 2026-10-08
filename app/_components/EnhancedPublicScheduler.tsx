"use client";

import { useEffect, useMemo, useState } from "react";
import { addDays, format, isToday, isTomorrow, startOfDay } from "date-fns";
import { CalendarDays, CheckCircle2, Clock, Loader2, ShieldCheck, User } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface Slot { start: string; end: string; label: string }

interface EnhancedPublicSchedulerProps {
  professionalId: string;
  professionalName: string;
  calLink?: string;
}

const SESSION_TYPES = [
  { id: "initial_consultation", name: "Initial consultation", duration: 60, description: "A first conversation to understand what you need" },
  { id: "support_session", name: "Support session", duration: 45, description: "Ongoing support and counselling" },
  { id: "crisis_intervention", name: "Urgent support", duration: 90, description: "Help with an immediate difficulty" },
  { id: "follow_up", name: "Follow-up", duration: 30, description: "A short check-in" },
] as const;

const dateKey = (d: Date) => format(d, "yyyy-MM-dd");

function Field({ label, htmlFor, required, hint, children }: { label: string; htmlFor: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="block text-sm font-medium text-serene-neutral-800">
        {label}
        {required && <span className="text-sauti-red"> *</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-serene-neutral-500">{hint}</p>}
    </div>
  );
}

export function EnhancedPublicScheduler({ professionalId, professionalName }: EnhancedPublicSchedulerProps) {
  const [sessionType, setSessionType] = useState<(typeof SESSION_TYPES)[number]["id"]>("initial_consultation");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>();
  const [slots, setSlots] = useState<Slot[]>([]);
  const [tzLabel, setTzLabel] = useState("East Africa Time");
  const [outOfOffice, setOutOfOffice] = useState(false);
  const [slotsState, setSlotsState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [selectedSlot, setSelectedSlot] = useState<Slot | undefined>();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [client, setClient] = useState({ firstName: "", lastName: "", email: "", phone: "", emergencyContact: "", notes: "" });

  const session = SESSION_TYPES.find((t) => t.id === sessionType)!;
  const today = useMemo(() => startOfDay(new Date()), []);

  // Real availability for the chosen day and session length.
  useEffect(() => {
    if (!selectedDate) return;
    let cancelled = false;
    setSlotsState("loading");
    setSelectedSlot(undefined);
    fetch(`/api/appointments/slots?professionalId=${encodeURIComponent(professionalId)}&date=${dateKey(selectedDate)}&duration=${session.duration}`)
      .then(async (r) => {
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "Could not load times");
        return j;
      })
      .then((j) => {
        if (cancelled) return;
        setSlots(j.slots ?? []);
        setOutOfOffice(!!j.outOfOffice);
        if (j.timezone) setTzLabel(j.timezone);
        setSlotsState("ready");
      })
      .catch(() => !cancelled && setSlotsState("error"));
    return () => { cancelled = true; };
  }, [selectedDate, session.duration, professionalId]);

  const valid = !!selectedSlot && client.firstName.trim().length > 0 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(client.email.trim());

  async function submit() {
    if (!selectedSlot || !valid) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/appointments/public", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ professionalId, date: selectedSlot.start, type: sessionType, duration: session.duration, clientInfo: client }),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || "We could not send your request. Please try again.");
        if (res.status === 409) setSlotsState("idle"), setSelectedDate((d) => (d ? new Date(d) : d)); // refresh the times
        return;
      }
      setDone(true);
    } catch {
      setError("We could not reach the server. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const dayLabel = (d: Date) => (isToday(d) ? "Today" : isTomorrow(d) ? "Tomorrow" : format(d, "EEEE, d MMMM"));
  const card = "rounded-2xl border border-serene-neutral-100 bg-white p-5 shadow-sm sm:p-6";

  if (done && selectedSlot && selectedDate) {
    return (
      <div className={cn(card, "mx-auto max-w-xl text-center")} role="status">
        <div className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-serene-green-50">
          <CheckCircle2 className="size-7 text-serene-green-600" />
        </div>
        <h2 className="text-xl font-semibold text-serene-neutral-900">Request sent</h2>
        <p className="mt-2 text-sm text-serene-neutral-600">
          {professionalName} will confirm your appointment. Until they do, it is a request, not a booking.
        </p>
        <dl className="mt-5 space-y-2 rounded-xl bg-serene-neutral-50 p-4 text-left text-sm">
          <div className="flex justify-between gap-4"><dt className="text-serene-neutral-500">When</dt><dd className="text-right font-medium text-serene-neutral-900">{format(selectedDate, "EEEE, d MMMM yyyy")} at {selectedSlot.label}</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-serene-neutral-500">Session</dt><dd className="text-right font-medium text-serene-neutral-900">{session.name} ({session.duration} minutes)</dd></div>
          <div className="flex justify-between gap-4"><dt className="text-serene-neutral-500">With</dt><dd className="text-right font-medium text-serene-neutral-900">{professionalName}</dd></div>
        </dl>
        <p className="mt-4 text-xs text-serene-neutral-500">We have emailed {client.email} to say we received your request.</p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
      {/* Choose a time */}
      <section className={card} aria-labelledby="when-title">
        <h2 id="when-title" className="flex items-center gap-2 text-base font-semibold text-serene-neutral-900">
          <CalendarDays className="size-5 text-sauti-teal" /> Choose a time
        </h2>

        <div className="mt-5 space-y-5">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium text-serene-neutral-800">What kind of session?</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {SESSION_TYPES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSessionType(t.id)}
                  aria-pressed={sessionType === t.id}
                  className={cn(
                    "rounded-xl border p-3 text-left transition-[background-color,border-color,transform] duration-150 ease-out active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sauti-teal/40",
                    sessionType === t.id ? "border-sauti-teal bg-sauti-teal/5" : "border-serene-neutral-100 bg-white hover:bg-serene-neutral-50"
                  )}
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-serene-neutral-900">{t.name}</span>
                    <span className="rounded-md bg-serene-neutral-100 px-1.5 py-0.5 text-[11px] font-medium text-serene-neutral-600">{t.duration} min</span>
                  </span>
                  <span className="mt-0.5 block text-xs text-serene-neutral-500">{t.description}</span>
                </button>
              ))}
            </div>
          </fieldset>

          <div className="space-y-2">
            <span className="block text-sm font-medium text-serene-neutral-800">Pick a day</span>
            <div className="flex justify-center rounded-xl bg-serene-neutral-50 p-3">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={setSelectedDate}
                startMonth={today}
                disabled={[{ before: addDays(today, 0) }, { after: addDays(today, 90) }, { dayOfWeek: [0, 6] }]}
              />
            </div>
          </div>

          {selectedDate && (
            <div className="space-y-2" aria-live="polite">
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-medium text-serene-neutral-800">{dayLabel(selectedDate)}</span>
                <span className="text-xs text-serene-neutral-500">{tzLabel}</span>
              </div>
              {slotsState === "loading" && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-serene-neutral-100" />)}
                </div>
              )}
              {slotsState === "error" && <p className="rounded-xl bg-sauti-red-light p-3 text-sm text-sauti-red" role="alert">We could not load the available times. Please try another day or refresh.</p>}
              {slotsState === "ready" && outOfOffice && <p className="rounded-xl bg-sauti-yellow-light p-3 text-sm text-serene-neutral-700">{professionalName} is out of office right now. Please check back later.</p>}
              {slotsState === "ready" && !outOfOffice && slots.length === 0 && (
                <p className="rounded-xl bg-serene-neutral-50 p-3 text-sm text-serene-neutral-600">No free times on this day for a {session.duration}-minute session. Please try another day.</p>
              )}
              {slotsState === "ready" && slots.length > 0 && (
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Available times">
                  {slots.map((s) => (
                    <button
                      key={s.start}
                      type="button"
                      role="radio"
                      aria-checked={selectedSlot?.start === s.start}
                      onClick={() => setSelectedSlot(s)}
                      className={cn(
                        "h-10 rounded-lg border text-sm font-medium transition-[background-color,border-color,color,transform] duration-150 ease-out active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sauti-teal/40",
                        selectedSlot?.start === s.start ? "border-sauti-teal bg-sauti-teal text-white" : "border-serene-neutral-100 bg-white text-serene-neutral-800 hover:bg-serene-neutral-50"
                      )}
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      {/* Details */}
      <div className="space-y-5 lg:space-y-6">
        <section className={card} aria-labelledby="you-title">
          <h2 id="you-title" className="flex items-center gap-2 text-base font-semibold text-serene-neutral-900">
            <User className="size-5 text-sauti-teal" /> Your details
          </h2>
          <form className="mt-5 space-y-4" onSubmit={(e) => { e.preventDefault(); submit(); }} autoComplete="on">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="First name" htmlFor="firstName" required>
                <Input id="firstName" name="firstName" autoComplete="given-name" value={client.firstName} onChange={(e) => setClient((c) => ({ ...c, firstName: e.target.value }))} placeholder="Your first name" />
              </Field>
              <Field label="Last name" htmlFor="lastName">
                <Input id="lastName" name="lastName" autoComplete="family-name" value={client.lastName} onChange={(e) => setClient((c) => ({ ...c, lastName: e.target.value }))} placeholder="Your last name" />
              </Field>
            </div>
            <Field label="Email" htmlFor="email" required hint="We use this to confirm your appointment. We never share it.">
              <Input id="email" name="email" type="email" inputMode="email" autoComplete="email" value={client.email} onChange={(e) => setClient((c) => ({ ...c, email: e.target.value }))} placeholder="you@example.com" />
            </Field>
            <Field label="Phone" htmlFor="phone">
              <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" value={client.phone} onChange={(e) => setClient((c) => ({ ...c, phone: e.target.value }))} placeholder="Optional" />
            </Field>
            <Field label="Someone we can contact in an emergency" htmlFor="emergencyContact">
              <Input id="emergencyContact" name="emergencyContact" autoComplete="off" value={client.emergencyContact} onChange={(e) => setClient((c) => ({ ...c, emergencyContact: e.target.value }))} placeholder="Name and phone (optional)" />
            </Field>
            <Field label="Anything you would like us to know" htmlFor="notes">
              <Textarea id="notes" name="notes" value={client.notes} onChange={(e) => setClient((c) => ({ ...c, notes: e.target.value }))} placeholder="Optional" className="min-h-[88px]" />
            </Field>
          </form>
        </section>

        <section className={card} aria-labelledby="summary-title">
          <h2 id="summary-title" className="flex items-center gap-2 text-base font-semibold text-serene-neutral-900">
            <Clock className="size-5 text-sauti-teal" /> Summary
          </h2>
          {selectedDate && selectedSlot ? (
            <p className="mt-3 text-sm text-serene-neutral-700">
              <span className="font-medium text-serene-neutral-900">{session.name}</span> ({session.duration} minutes) on{" "}
              <span className="font-medium text-serene-neutral-900">{format(selectedDate, "EEEE, d MMMM")} at {selectedSlot.label}</span> ({tzLabel}) with {professionalName}.
            </p>
          ) : (
            <p className="mt-3 text-sm text-serene-neutral-500">Choose a day and a time to continue.</p>
          )}
          {error && <p className="mt-3 rounded-xl bg-sauti-red-light p-3 text-sm text-sauti-red" role="alert">{error}</p>}
          <Button onClick={submit} disabled={!valid || submitting} size="lg" className="mt-5 h-12 w-full rounded-xl bg-sauti-teal text-white transition-[transform,background-color] duration-150 ease-out hover:bg-sauti-dark active:scale-[0.98]">
            {submitting ? <><Loader2 className="mr-2 size-4 animate-spin" /> Sending…</> : "Request appointment"}
          </Button>
          <p className="mt-3 flex items-start gap-2 text-xs text-serene-neutral-500">
            <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-sauti-teal" />
            This is a request. {professionalName} confirms it, and nothing is booked until then. Your details are used only for this appointment.
          </p>
        </section>
      </div>
    </div>
  );
}
