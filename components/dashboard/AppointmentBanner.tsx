"use client";

import React, { useState } from "react";
import { Calendar, Clock, MapPin, Video, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EnhancedAppointmentScheduler } from "@/app/dashboard/_components/EnhancedAppointmentScheduler";
import { useToast } from "@/hooks/use-toast";
import { confirmAppointment, rescheduleAppointment } from "@/app/dashboard/_views/actions/appointments";

interface Appointment {
    id: string;
    appointment_date: string | null;
    start_time: string | null;
    location_type: "virtual" | "in_person";
    status: "requested" | "confirmed" | "completed" | "reschedule_requested";
    service_name?: string;
    professional_name?: string;
    professional_id?: string;
    match_id?: string;
}

interface AppointmentBannerProps {
    appointments: Appointment[];
    className?: string;
    onUpdate?: () => void;
    isReporter?: boolean; // True if current user is the one responding
}

export function AppointmentBanner({ appointments, className, onUpdate, isReporter = true }: AppointmentBannerProps) {
    const { toast } = useToast();
    const [isSchedulerOpen, setIsSchedulerOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    if (!appointments || appointments.length === 0) return null;

    const appointment = appointments[0];
    const isConfirmed = appointment.status === "confirmed";
    const isRequested = appointment.status === "requested";

    // Only allow reporter to take actions on requested appointments
    const showActions = isReporter && isRequested;

    const formatDate = (d: string | null) => {
        if (!d) return "TBD";
        try {
            return new Date(d).toLocaleDateString("en-US", { 
                weekday: 'short', 
                month: 'short', 
                day: 'numeric',
                year: 'numeric'
            });
        } catch (e) {
            return "TBD";
        }
    };

    const formatTime = (t: string | null) => {
        if (!t) return "TBD";
        // Handle HH:MM:SS or full ISO
        if (t.includes(':')) {
            const parts = t.split(':');
            return `${parts[0]}:${parts[1]}`;
        }
        return "TBD";
    };

    const handleAccept = async () => {
        setIsUpdating(true);
        try {
            await confirmAppointment(appointment.id);
            toast({
                title: "Support Session Confirmed",
                description: "The professional has been notified and the event is added to your calendars.",
            });
            if (onUpdate) onUpdate();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to confirm appointment. Please try again.",
            });
        } finally {
            setIsUpdating(false);
        }
    };

    const handleReschedule = async (data: { date: Date; duration: number; type: string; notes?: string }) => {
        setIsUpdating(true);
        try {
            // Logic to reschedule with "finality" as requested
            await rescheduleAppointment(
                appointment.id, 
                data.date.toISOString(), 
                data.notes || "Rescheduled by reporter",
                "confirmed" // Set to confirmed for finality
            );
            
            toast({
                title: "Session Rescheduled",
                description: "The new time has been finalized for the professional.",
            });
            setIsSchedulerOpen(false);
            if (onUpdate) onUpdate();
        } catch (error) {
            toast({
                variant: "destructive",
                title: "Error",
                description: "Failed to reschedule. Please try again.",
            });
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className={cn("animate-in fade-in slide-in-from-top-4 duration-700 mb-6", className)}>
            <Card className={cn(
                "border-0 overflow-hidden rounded-3xl transition-all duration-500",
                "bg-[#FFF9EB] border border-[#FDE68A]/30 shadow-sm shadow-amber-900/5"
            )}>
                <CardContent className="p-0 relative">
                    <div className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-5 relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-white/60 rounded-xl flex items-center justify-center text-[#1E293B] shrink-0 shadow-sm border border-white/40">
                                {appointment.location_type === 'virtual' ? <Video className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
                            </div>
                            
                            <div className="space-y-0.5">
                                <p className="text-[9px] font-bold text-[#64748B] uppercase tracking-[0.2em] leading-none mb-0.5">
                                    {appointment.service_name || "Consultation Session"}
                                </p>
                                <h4 className="text-base sm:text-lg font-black text-[#0F172A] tracking-tight">
                                    {formatDate(appointment.appointment_date)}
                                </h4>
                                <p className="text-xs font-bold text-[#64748B]/60 flex items-center gap-1.5">
                                    <Clock className="h-3.5 w-3.5" />
                                    {formatTime(appointment.start_time) || "12:30 PM"}
                                </p>
                            </div>
                        </div>

                        {showActions ? (
                            <div className="flex items-center gap-3 w-full md:w-auto">
                                <Button 
                                    onClick={() => setIsSchedulerOpen(true)}
                                    variant="ghost"
                                    className="h-9 px-4 rounded-xl font-bold text-[10px] uppercase tracking-widest text-[#64748B] hover:bg-white/40 transition-all gap-1.5"
                                >
                                    <RefreshCw className="h-3.5 w-3.5" />
                                    Reschedule
                                </Button>
                                <Button 
                                    onClick={handleAccept}
                                    disabled={isUpdating}
                                    className="h-9 px-6 rounded-xl font-black text-[10px] uppercase tracking-[0.1em] bg-[#E1580E] hover:bg-[#D14D0D] text-white shadow-md shadow-orange-950/5 transition-all active:scale-95"
                                >
                                    {isUpdating ? "..." : "Accept Time"}
                                </Button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 px-3 py-1.5 bg-white/40 rounded-xl border border-white/60">
                                <Badge className={cn(
                                    "text-[8px] uppercase font-black tracking-widest px-1.5 py-0 rounded-md border-0 shadow-none",
                                    isConfirmed ? "bg-emerald-500 text-white" : "bg-amber-500 text-white"
                                )}>
                                    Scheduled
                                </Badge>
                                <span className="text-[10px] font-bold text-[#64748B]">
                                    {isConfirmed ? "Confirmed Session" : "Awaiting Confirmation"}
                                </span>
                            </div>
                        )}
                    </div>
                </CardContent>
            </Card>

            {/* Reschedule Modal */}
            {appointment.professional_id && (
                <EnhancedAppointmentScheduler 
                    isOpen={isSchedulerOpen}
                    onClose={() => setIsSchedulerOpen(false)}
                    professionalId={appointment.professional_id}
                    professionalName={appointment.professional_name || "the professional"}
                    serviceName={appointment.service_name}
                    onSchedule={handleReschedule}
                    viewMode="respond"
                    initialAppointment={{
                        date: appointment.appointment_date ? new Date(appointment.appointment_date) : new Date(),
                        duration: 30,
                        type: appointment.location_type || 'consultation'
                    }}
                />
            )}
        </div>
    );
}
