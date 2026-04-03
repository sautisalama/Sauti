"use client";

import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { AddToCalendarModal } from "./AddToCalendarModal";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Clock, 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  CheckCircle2, 
} from "lucide-react";
import { 
  format, 
  isSameDay, 
  isToday, 
  startOfWeek, 
  addDays, 
  startOfMonth, 
  endOfMonth, 
  endOfWeek,
  setHours,
  setMinutes
} from "date-fns";
import { fetchUserAppointments } from "../_views/actions/appointments";
import { AppointmentWithDetails } from "../_types";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getAvailableSlotsForDate, getAvailabilityCalendar } from "@/app/actions/availability";
import { TimeSlot } from "@/types/chat";

/**
 * Design Tokens based on the shared system image.
 */
const COLORS = {
  teal: "bg-[#E2F0EF]",
  tealText: "text-[#105D5D]",
  blue: "bg-[#E2F1FF]",
  blueText: "text-[#004A99]",
  amber: "bg-[#FFF8E2]",
  amberText: "text-[#856404]",
  red: "bg-[#FFF2F2]",
  redText: "text-[#990000]",
  background: "bg-[#FFFFFF]",
  muted: "bg-[#F8FAFC]",
};

interface EnhancedAppointmentSchedulerProps {
  isOpen: boolean;
  onClose: () => void;
  onSchedule: (appointment: {
    date: Date;
    duration: number;
    type: string;
    notes?: string;
  }) => Promise<void>;
  professionalName?: string;
  userId?: string;
  serviceName?: string;
  defaultAvailability?: string;
  viewMode?: 'propose' | 'respond';
  initialAppointment?: {
    date: Date;
    duration: number;
    type: string;
  };
  inline?: boolean;
  professionalId?: string;
}

/**
 * Flat Analog Clock Face - Pure CSS/SVG for the "Proper Widget" vibe.
 */
/**
 * Highly Polished Analog Clock Widget with Framer Motion
 */
/**
 * Serene Analog Clock Widget - Ultra minimalist for a calm, professional atmosphere.
 * Designed to be fully responsive and visually light.
 */
function SereneClockWidget({ hour, minute }: { hour: number; minute: number }) {
  const hourDeg = (hour % 12) * 30 + (minute / 60) * 30;
  const minuteDeg = minute * 6;

  return (
    <div className="relative w-32 h-32 xs:w-40 xs:h-40 sm:w-56 sm:h-56 rounded-full bg-white flex items-center justify-center border-[0.5px] border-slate-100 shadow-[0_8px_30px_rgb(0,0,0,0.04)] mx-auto group ring-[12px] ring-slate-50/30">
      {/* Dynamic Background Pattern - Very subtle */}
      <div className="absolute inset-0 opacity-[0.02] select-none pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_#105D5D_0.5px,_transparent_0.5px)] bg-[size:16px_16px]" />
      </div>

      {/* Simplified Markers - Minimalist dots */}
      {[...Array(12)].map((_, i) => (
        <div key={i} className="absolute inset-3 text-center" style={{ transform: `rotate(${i * 30}deg)` }}>
          <div className={cn(
            "w-0.5 rounded-full mx-auto",
            i % 3 === 0 ? "h-1.5 bg-slate-200" : "h-0.5 bg-slate-100"
          )} />
        </div>
      ))}
      
      {/* Hour Hand - Soft, elegant */}
      <motion.div
        animate={{ rotate: hourDeg }}
        transition={{ type: "spring", stiffness: 120, damping: 20 }}
        className="absolute w-1 h-[28%] bg-slate-400 rounded-full origin-bottom z-10"
        style={{ bottom: "50%", x: "0%", transformOrigin: "bottom" }}
      />
      
      {/* Minute Hand - Teal accent, very thin */}
      <motion.div
        animate={{ rotate: minuteDeg }}
        transition={{ type: "spring", stiffness: 100, damping: 25 }}
        className="absolute w-0.5 h-[38%] bg-teal-500 rounded-full origin-bottom z-20"
        style={{ bottom: "50%", x: "0%", transformOrigin: "bottom" }}
      />
      
      {/* Minimal Center Cap */}
      <div className="absolute w-2 h-2 bg-white rounded-full z-30 ring-2 ring-slate-100 shadow-sm" />
      
      {/* Floating Ambient Glow */}
      <div className="absolute inset-0 rounded-full bg-gradient-to-tr from-teal-50/10 to-transparent pointer-events-none" />
    </div>
  );
}

export function EnhancedAppointmentScheduler({
  isOpen,
  onClose,
  onSchedule,
  professionalName,
  userId,
  serviceName,
  viewMode = 'propose',
  initialAppointment,
  inline = false,
  professionalId,
}: EnhancedAppointmentSchedulerProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(initialAppointment?.date || new Date());
  
  const now = new Date();
  const defaultHour = initialAppointment?.date ? initialAppointment.date.getHours() : now.getHours();
  const defaultMinute = initialAppointment?.date ? initialAppointment.date.getMinutes() : Math.ceil(now.getMinutes() / 5) * 5;

  const [hour, setHour] = useState<string>((defaultHour % 12 || 12).toString().padStart(2, "0"));
  const [minute, setMinute] = useState<string>(Math.min(defaultMinute, 55).toString().padStart(2, "0"));
  const [ampm, setAmpm] = useState<string>(defaultHour >= 12 ? "PM" : "AM");

  const [isLoading, setIsLoading] = useState(false);
  const [existingAppointments, setExistingAppointments] = useState<AppointmentWithDetails[]>([]);
  const [calendarViewMode, setCalendarViewMode] = useState<'week' | 'month'>('week');
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [lastScheduledAppointment, setLastScheduledAppointment] = useState<{
    date: Date;
    duration: number;
    type: string;
    notes?: string;
  } | null>(null);
  const [notes, setNotes] = useState("");
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [availableDates, setAvailableDates] = useState<{ date: string; hasSlots: boolean }[]>([]);
  const [isLoadingSlots, setIsLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);

  const selectedDateTime = useMemo(() => {
    let h = parseInt(hour);
    if (ampm === "PM" && h < 12) h += 12;
    if (ampm === "AM" && h === 12) h = 0;
    return setMinutes(setHours(selectedDate, h), parseInt(minute));
  }, [selectedDate, hour, minute, ampm]);

  useEffect(() => {
    if (!userId || !isOpen) return;
    const loadExisting = async () => {
      try {
        const data = await fetchUserAppointments(userId, 'professional');
        setExistingAppointments(data || []);
      } catch (err) {
        console.error("Failed to load appointments", err);
      }
    };
    loadExisting();
  }, [userId, isOpen]);
  
  // Fetch availability calendar
  useEffect(() => {
    if (!professionalId || !isOpen) return;
    
    const loadAvailabilityCalendar = async () => {
      try {
        const start = startOfMonth(selectedDate);
        const end = endOfMonth(selectedDate);
        const calendar = await getAvailabilityCalendar(professionalId, start, end);
        setAvailableDates(calendar);
      } catch (err) {
        console.error("Failed to load availability calendar", err);
      }
    };
    
    loadAvailabilityCalendar();
  }, [professionalId, selectedDate.getMonth(), isOpen]);

  // Fetch slots for selected date
  useEffect(() => {
    if (!professionalId || !isOpen) return;
    
    const loadSlots = async () => {
      setIsLoadingSlots(true);
      try {
        const slots = await getAvailableSlotsForDate(professionalId, selectedDate);
        setAvailableSlots(slots);
        
        // Auto-select initial slot if matches
        if (initialAppointment?.date) {
            const initialIso = initialAppointment.date.toISOString();
            const matchingSlot = slots.find(s => s.slot_start === initialIso);
            if (matchingSlot) setSelectedSlot(matchingSlot);
        }
      } catch (err) {
        console.error("Failed to load slots", err);
      } finally {
        setIsLoadingSlots(false);
      }
    };
    
    loadSlots();
  }, [professionalId, selectedDate, isOpen]);

  useEffect(() => {
    if (selectedSlot) {
        const date = new Date(selectedSlot.slot_start);
        setHour((date.getHours() % 12 || 12).toString().padStart(2, "0"));
        setMinute(date.getMinutes().toString().padStart(2, "0"));
        setAmpm(date.getHours() >= 12 ? "PM" : "AM");
    }
  }, [selectedSlot]);

  const handleSchedule = async (isMeetNow: boolean = false) => {
    const apptDate = isMeetNow ? new Date() : selectedDateTime;
    setIsLoading(true);
    try {
      const apptData = { 
        date: apptDate, 
        duration: 30, 
        type: isMeetNow ? 'meet-now' : 'consultation',
        notes: notes.trim()
      };
      await onSchedule(apptData);
      setLastScheduledAppointment(apptData);
      onClose();
      if (userId) setShowCalendarModal(true);
    } catch (error) {
      console.error("Error scheduling appointment:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const renderCalendar = () => {
    const weekDays = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(selectedDate), i));
    const monthDays: { date: Date; isCurrentMonth: boolean }[] = [];
    const start = startOfWeek(startOfMonth(selectedDate));
    const end = endOfWeek(endOfMonth(selectedDate));
    let curr = start;
    while (curr <= end) {
      monthDays.push({ date: new Date(curr), isCurrentMonth: curr.getMonth() === selectedDate.getMonth() });
      curr = addDays(curr, 1);
    }

    return (
      <div className={cn("rounded-[1.5rem] p-3 sm:p-4 flex-1 border border-slate-100/30", COLORS.teal, "bg-opacity-30 backdrop-blur-sm shadow-inner")}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex bg-white/40 rounded-lg p-0.5 border border-white/40">
            <button onClick={() => setCalendarViewMode('week')} className={cn("px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all", calendarViewMode === 'week' ? "bg-white text-[#105D5D] shadow-sm" : "opacity-50")}>Week</button>
            <button onClick={() => setCalendarViewMode('month')} className={cn("px-2.5 py-1.5 text-[9px] font-bold uppercase tracking-wider rounded-md transition-all", calendarViewMode === 'month' ? "bg-white text-[#105D5D] shadow-sm" : "opacity-50")}>Month</button>
          </div>
          <div className="flex items-center gap-1.5">
             <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg bg-white/50 text-[#105D5D]" onClick={() => { const d = new Date(selectedDate); calendarViewMode === 'week' ? d.setDate(d.getDate() - 7) : d.setMonth(d.getMonth() - 1); setSelectedDate(d); }}><ChevronLeft className="h-3.5 w-3.5" /></Button>
             <p className="text-[9px] font-black text-[#105D5D] uppercase tracking-widest w-20 text-center">{format(selectedDate, 'MM yyyy')}</p>
             <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg bg-white/50 text-[#105D5D]" onClick={() => { const d = new Date(selectedDate); calendarViewMode === 'week' ? d.setDate(d.getDate() + 7) : d.setMonth(d.getMonth() + 1); setSelectedDate(d); }}><ChevronRight className="h-3.5 w-3.5" /></Button>
          </div>
        </div>
        <div className="grid grid-cols-7 gap-1">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day, i) => (
            <div key={`${day}-${i}`} className="text-center text-[8px] font-bold text-[#105D5D]/40 pb-2 uppercase tracking-tight">{day}</div>
          ))}
          {(calendarViewMode === 'week' ? weekDays : monthDays.map(d => d.date)).map((day, idx) => {
            const isSelected = isSameDay(day, selectedDate);
            const isTodayDate = isToday(day);
            const isTargetMonth = calendarViewMode === 'month' ? monthDays[idx]?.isCurrentMonth : true;
            const hasAvailability = availableDates.find(d => d.date === format(day, 'yyyy-MM-dd'))?.hasSlots;
            
            return (
              <button key={idx} disabled={!isTargetMonth} onClick={() => setSelectedDate(day)}
                className={cn("relative aspect-square rounded-[1.2rem] flex flex-col items-center justify-center transition-all",
                  !isTargetMonth && "opacity-5 pointer-events-none",
                  isSelected ? "bg-[#105D5D] text-white shadow-sm z-10" :
                  isTodayDate ? "bg-white/60 text-[#105D5D] font-black border border-white/40" :
                  "hover:bg-white/40 text-[#105D5D] font-medium"
                )}>
                <span className="text-sm">{day.getDate()}</span>
                {existingAppointments.some(appt => appt.appointment_date && isSameDay(new Date(appt.appointment_date), day)) && <div className={cn("absolute bottom-2 h-1 w-1 rounded-full", isSelected ? "bg-white" : "bg-[#105D5D]")} />}
                {professionalId && hasAvailability && !isSelected && <div className="absolute top-2 right-2 h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderForm = () => {
    return (
      <div className="flex flex-col gap-6 h-full">
        <div className="overflow-y-auto pr-1 flex-1 space-y-8 scrollbar-hide py-2">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
            {/* Date Selection */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 px-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-none">Pick Date</label>
              </div>
              {renderCalendar()}
            </div>

            {/* Time Picker */}
            <div className="flex flex-col gap-3">
              <div className="flex items-center gap-2 px-1">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-none">Set Time</label>
              </div>

              <div className={cn("rounded-[1.5rem] p-3 sm:p-6 flex-1 flex flex-col items-center justify-center gap-4 sm:gap-6", COLORS.blue, "bg-opacity-30 backdrop-blur-sm shadow-inner")}>
              {professionalId ? (
                <div className="w-full space-y-4">
                  <p className="text-[10px] font-black text-[#004A99] uppercase tracking-widest text-center mb-2">Available Slots</p>
                  {isLoadingSlots ? (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#004A99]/20 border-t-[#004A99]" />
                        <p className="text-[10px] font-bold text-[#004A99]/40 uppercase tracking-widest">Checking Availability...</p>
                    </div>
                  ) : availableSlots.length > 0 ? (
                    <div className="grid grid-cols-2 gap-2 max-h-[180px] overflow-y-auto pr-2 scrollbar-hide">
                      {availableSlots.map((slot, i) => {
                        const slotDate = new Date(slot.slot_start);
                        const isSelected = selectedSlot?.slot_start === slot.slot_start;
                        return (
                          <button
                            key={i}
                            onClick={() => setSelectedSlot(slot)}
                            className={cn(
                                "py-3 px-4 rounded-xl text-xs font-bold transition-all border",
                                isSelected 
                                    ? "bg-[#004A99] text-white border-[#004A99] shadow-md scale-[1.02]" 
                                    : "bg-white/60 text-[#004A99] border-white/40 hover:bg-white/90"
                            )}
                          >
                            {format(slotDate, 'h:mm a')}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-12 bg-white/40 rounded-2xl border border-dashed border-white/60">
                        <Clock className="h-6 w-6 text-[#004A99]/20 mx-auto mb-2" />
                        <p className="text-[10px] font-bold text-[#004A99]/60 uppercase tracking-widest">No slots available</p>
                        <p className="text-[9px] font-medium text-[#004A99]/40 mt-1 uppercase">Try another date</p>
                    </div>
                  )}
                </div>
              ) : (
                <>
                  <div className="hidden sm:block transition-all duration-700 hover:scale-[1.02]">
                    <SereneClockWidget hour={ampm === "PM" ? parseInt(hour) + 12 : parseInt(hour)} minute={parseInt(minute)} />
                  </div>
                  
                  <div className="flex items-center gap-2 justify-center w-full max-w-[240px]">
                    <div className="flex flex-col gap-1.5 flex-1">
                      <Select value={hour} onValueChange={setHour}>
                        <SelectTrigger className="h-9 rounded-xl border-white/50 bg-white/80 font-bold text-xs text-[#004A99] shadow-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-100 bg-white shadow-xl">
                          {[...Array(12)].map((_, i) => (
                            <SelectItem key={i} value={(i + 1).toString().padStart(2, "0")} className="font-bold">
                              {(i + 1).toString().padStart(2, "0")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="text-xs font-black text-[#004A99]/20 self-center">:</div>

                    <div className="flex flex-col gap-1.5 flex-1">
                      <Select value={minute} onValueChange={setMinute}>
                        <SelectTrigger className="h-9 rounded-xl border-white/50 bg-white/80 font-bold text-xs text-[#004A99] shadow-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-100 bg-white shadow-xl">
                          {[...Array(12)].map((_, i) => (
                            <SelectItem key={i} value={(i * 5).toString().padStart(2, "0")} className="font-bold">
                              {(i * 5).toString().padStart(2, "0")}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="flex flex-col gap-1.5 flex-1">
                      <Select value={ampm} onValueChange={setAmpm}>
                        <SelectTrigger className="h-9 rounded-xl border-0 bg-[#004A99] text-white font-bold text-xs shadow-none">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl border-slate-100 bg-white shadow-xl">
                          <SelectItem value="AM" className="font-bold">AM</SelectItem>
                          <SelectItem value="PM" className="font-bold">PM</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Private Recovery Notes */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 px-1">
            <label className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] leading-none">
              {viewMode === 'respond' ? "Confidential Session Notes" : "Confidential First Greeting"}
            </label>
            <Badge variant="outline" className="text-[8px] font-bold px-1.5 h-4 border-slate-100 text-slate-400 uppercase tracking-widest leading-none bg-slate-50/50">
              {viewMode === 'respond' ? "Session Prep" : "Sent as First Chat"}
            </Badge>
          </div>
          <div className="relative">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={viewMode === 'respond' 
                ? "Private details or preparation notes for your specialist..." 
                : "Enter an initial message for the survivor. This will be sent as your first chat with them..."
              }
              className="w-full h-20 sm:h-24 rounded-[1.2rem] sm:rounded-[1.5rem] bg-slate-50 border border-slate-100/50 p-3 sm:p-6 text-xs font-medium text-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-400/20 placeholder:text-slate-300 resize-none transition-all shadow-inner"
            />
          </div>
        </div>
      </div>

        {/* Action Center - Sticky on mobile if needed, but here we just ensure it's below the scroll area */}
        <div className="space-y-4 pt-4 border-t border-slate-50 shrink-0">
           {/* Subtle Status Bar */}
           <div className={cn("flex items-center justify-between p-4 sm:p-5 rounded-[1.5rem] border border-white/50 relative overflow-hidden", COLORS.muted, "bg-opacity-50 shadow-sm")}>
              <div className="flex flex-col sm:flex-row sm:items-center gap-3 relative z-10 text-slate-500 font-medium text-[11px]">
                 <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-teal-500" />
                    <span>Scheduled for <span className="text-slate-900 font-bold">{format(selectedDateTime, "EEEE do")}</span></span>
                 </div>
                 <div className="hidden sm:block w-1 h-1 rounded-full bg-slate-200" />
                 <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-teal-500" />
                    <span>at <span className="text-slate-900 font-bold">{format(selectedDateTime, "h:mm a")}</span></span>
                 </div>
              </div>
           </div>

           <div className="flex gap-4">
              <Button 
                onClick={() => handleSchedule(true)} 
                disabled={isLoading} 
                variant="ghost"
                className="flex-1 h-12 bg-white hover:bg-slate-50 text-slate-600 border border-slate-100 rounded-2xl font-bold text-[11px] uppercase tracking-widest shadow-none"
              >
                Meet Now
              </Button>
              <Button 
                onClick={() => handleSchedule(false)} 
                disabled={isLoading}
                className="flex-[2] h-12 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-bold text-[11px] uppercase tracking-[0.2em] shadow-none transition-all active:scale-[0.98]"
              >
                {isLoading ? "Scheduling..." : (viewMode === 'respond' ? 'Accept Session' : 'Schedule & Accept')}
              </Button>
           </div>
        </div>
      </div>
    );
  };

  const content = (
    <div className="flex flex-col h-full overflow-hidden">
      {!inline && (
        <div className="px-4 sm:px-10 py-4 sm:py-8 border-b border-slate-50 shrink-0 text-left">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-none uppercase">Coordination Session</DialogTitle>
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 mt-2">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">Coordination Protocol</p>
                  <span className="hidden sm:block w-1 h-1 rounded-full bg-slate-200" />
                  <p className="text-[10px] font-bold text-teal-500/60 uppercase tracking-[0.1em]">Verification Level 4</p>
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>
      )}
      <div className={cn("overflow-hidden flex-1", !inline && "px-4 sm:px-10 py-2 sm:py-8 pt-1 sm:pt-2")}>
        {renderForm()}
      </div>
    </div>
  );

  if (inline) {
    return content;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] sm:max-w-[750px] bg-white rounded-2xl sm:rounded-[2.5rem] p-0 overflow-hidden border-0 shadow-2xl max-h-[95vh] flex flex-col focus:outline-none scrollbar-hide">
        {content}
      </DialogContent>
    </Dialog>
  );
}
