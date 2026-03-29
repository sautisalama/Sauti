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
}

/**
 * Flat Analog Clock Face - Pure CSS/SVG for the "Proper Widget" vibe.
 */
/**
 * Highly Polished Analog Clock Widget with Framer Motion
 */
function AnalogClockWidget({ hour, minute }: { hour: number; minute: number }) {
  const hourDeg = (hour % 12) * 30 + (minute / 60) * 30;
  const minuteDeg = minute * 6;

  return (
    <div className="relative w-48 h-48 rounded-3xl bg-white flex items-center justify-center border-4 border-slate-50 shadow-2xl mx-auto group overflow-hidden">
      {/* Dynamic Background Pattern */}
      <div className="absolute inset-0 opacity-[0.03] select-none pointer-events-none">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_#004A99_1px,_transparent_1px)] bg-[size:12px_12px]" />
      </div>

      {/* Markers */}
      {[...Array(12)].map((_, i) => (
        <div key={i} className="absolute inset-4 text-center" style={{ transform: `rotate(${i * 30}deg)` }}>
          <div className={cn(
            "w-0.5 rounded-full mx-auto shadow-sm",
            i % 3 === 0 ? "h-3.5 bg-slate-300" : "h-2 bg-slate-100"
          )} />
          {i % 3 === 0 && (
             <span className="text-[10px] font-black text-slate-200 mt-1 block tracking-tighter" style={{ transform: `rotate(-${i * 30}deg)` }}>
               {i === 0 ? 12 : i}
             </span>
          )}
        </div>
      ))}
      
      {/* Large Glowing Center Piece */}
      <div className="absolute w-44 h-44 rounded-full border border-slate-50/50 flex items-center justify-center">
         <div className="w-[176px] h-[176px] rounded-full border border-slate-100/30" />
      </div>

      {/* Hour Hand */}
      <motion.div
        animate={{ rotate: hourDeg }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="absolute w-2 h-14 bg-slate-800 rounded-full origin-bottom shadow-lg z-10"
        style={{ bottom: "50%", x: "0%", transformOrigin: "bottom" }}
      />
      
      {/* Minute Hand */}
      <motion.div
        animate={{ rotate: minuteDeg }}
        transition={{ type: "spring", stiffness: 200, damping: 25 }}
        className="absolute w-1.5 h-16 bg-blue-500 rounded-full origin-bottom shadow-lg z-20"
        style={{ bottom: "50%", x: "0%", transformOrigin: "bottom" }}
      />
      
      {/* Floating Center Cap */}
      <div className="absolute w-4 h-4 bg-[#004A99] rounded-full z-30 ring-4 ring-white shadow-xl flex items-center justify-center">
         <div className="w-1 h-1 bg-white rounded-full opacity-50" />
      </div>
      
      {/* Decorative Outer Rings */}
      <div className="absolute -top-1 -left-1 -right-1 -bottom-1 border border-slate-50 rounded-3xl pointer-events-none" />
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
      <div className={cn("rounded-[1.5rem] p-4 flex-1 border border-slate-100/50", COLORS.teal, "bg-opacity-40")}>
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
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((day, idx) => (
            <div key={idx} className="text-center text-[8px] font-bold text-[#105D5D]/40 pb-2 uppercase tracking-tight">{day}</div>
          ))}
          {(calendarViewMode === 'week' ? weekDays : monthDays.map(d => d.date)).map((day, idx) => {
            const isSelected = isSameDay(day, selectedDate);
            const isTodayDate = isToday(day);
            const isTargetMonth = calendarViewMode === 'month' ? monthDays[idx]?.isCurrentMonth : true;
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
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  const renderForm = () => {
    return (
      <div className="flex flex-col gap-10 h-full">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 items-stretch flex-1">
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

            <div className={cn("rounded-[1.5rem] p-6 flex-1 flex flex-col items-center justify-center gap-6", COLORS.blue, "bg-opacity-40")}>
              <div className="opacity-60 transition-opacity hover:opacity-100">
                <AnalogClockWidget hour={ampm === "PM" ? parseInt(hour) + 12 : parseInt(hour)} minute={parseInt(minute)} />
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
              className="w-full h-24 rounded-[1.5rem] bg-slate-50 border border-slate-100/50 p-6 text-xs font-medium text-slate-600 focus:outline-none focus:ring-1 focus:ring-teal-400/20 placeholder:text-slate-300 resize-none transition-all shadow-inner"
            />
          </div>
        </div>

        {/* Action Center */}
        <div className="space-y-4">
           {/* Subtle Status Bar */}
           <div className={cn("flex items-center justify-between p-4 rounded-2xl border border-white/50 relative overflow-hidden", COLORS.muted, "bg-opacity-40 shadow-none")}>
              <div className="flex items-center gap-3 relative z-10 text-slate-500 font-medium text-xs">
                 <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-teal-600" />
                    <span>Scheduled for <span className="text-slate-900 font-bold">{format(selectedDateTime, "EEEE do")}</span></span>
                 </div>
                 <div className="w-1 h-1 rounded-full bg-slate-300" />
                 <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-teal-600" />
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
        <div className="px-10 py-8 border-b border-slate-50 shrink-0 text-left">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-xl font-bold text-slate-900 tracking-tight leading-none uppercase">Schedule & Accept</DialogTitle>
                <div className="flex items-center gap-2 mt-1">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.1em]">Coordination Protocol</p>
                  <span className="w-1 h-1 rounded-full bg-slate-200" />
                  <p className="text-[10px] font-bold text-teal-600/60 uppercase tracking-[0.1em]">Verification Level 4</p>
                </div>
              </div>
            </div>
          </DialogHeader>
        </div>
      )}
      <div className={cn("overflow-hidden flex-1", !inline && "px-10 py-8 pt-2")}>
        {renderForm()}
      </div>
    </div>
  );

  if (inline) {
    return content;
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[800px] bg-white rounded-[2rem] p-0 overflow-hidden border-0 shadow-2xl max-h-[92vh] flex flex-col focus:outline-none">
        {content}
      </DialogContent>
    </Dialog>
  );
}
