"use client";

import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Clock, User, MapPin, Calendar as CalendarIcon } from "lucide-react";
import { format, addMinutes, isSameDay, isToday, isTomorrow } from "date-fns";

interface TimeSlot {
  time: string;
  available: boolean;
  reason?: string;
}

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
  availableSlots?: TimeSlot[];
}

export function EnhancedAppointmentScheduler({
  isOpen,
  onClose,
  onSchedule,
  professionalName,
  availableSlots = [],
}: EnhancedAppointmentSchedulerProps) {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>();
  const [appointmentType, setAppointmentType] = useState<string>();
  const [duration, setDuration] = useState<number>(60);
  const [notes, setNotes] = useState<string>("");
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Generate time slots for selected date
  useEffect(() => {
    if (!selectedDate) return;

    // Generate slots from 8 AM to 6 PM
    const slots: TimeSlot[] = [];
    for (let hour = 8; hour < 18; hour++) {
      for (let minutes = 0; minutes < 60; minutes += 30) {
        const time = `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
        
        // Check if slot is available (mock logic - replace with real availability check)
        const available = !isWeekend(selectedDate) && hour >= 9 && hour < 17;
        
        slots.push({
          time,
          available,
          reason: !available ? "Outside working hours" : undefined,
        });
      }
    }
    
    setTimeSlots(slots);
  }, [selectedDate]);

  const isWeekend = (date: Date) => {
    const day = date.getDay();
    return day === 0 || day === 6;
  };

  const appointmentTypes = [
    { id: "consultation", name: "Initial Consultation", duration: 60 },
    { id: "follow-up", name: "Follow-up Session", duration: 45 },
    { id: "therapy", name: "Therapy Session", duration: 90 },
    { id: "assessment", name: "Assessment", duration: 120 },
    { id: "emergency", name: "Emergency Consultation", duration: 30 },
  ];

  const handleSchedule = async () => {
    if (!selectedDate || !selectedTime || !appointmentType) return;

    const [hours, minutes] = selectedTime.split(":").map(Number);
    const appointmentDate = new Date(selectedDate);
    appointmentDate.setHours(hours, minutes, 0, 0);

    setIsLoading(true);
    try {
      await onSchedule({
        date: appointmentDate,
        duration,
        type: appointmentType,
        notes,
      });
      onClose();
      // Reset form
      setSelectedDate(undefined);
      setSelectedTime(undefined);
      setAppointmentType(undefined);
      setNotes("");
    } catch (error) {
      console.error("Error scheduling appointment:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDateDisplay = (date: Date) => {
    if (isToday(date)) return "Today";
    if (isTomorrow(date)) return "Tomorrow";
    return format(date, "EEEE, MMMM d");
  };

  const getEndTime = (startTime: string, durationMinutes: number) => {
    const [hours, minutes] = startTime.split(":").map(Number);
    const start = new Date();
    start.setHours(hours, minutes, 0, 0);
    const end = addMinutes(start, durationMinutes);
    return format(end, "HH:mm");
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarIcon className="h-5 w-5" />
            Schedule Appointment
          </DialogTitle>
          <DialogDescription>
            {professionalName && (
              <span className="flex items-center gap-1 mt-2">
                <User className="h-4 w-4" />
                with {professionalName}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Appointment Type Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Appointment Type</label>
            <Select onValueChange={(value) => {
              setAppointmentType(value);
              const selected = appointmentTypes.find(t => t.id === value);
              if (selected) setDuration(selected.duration);
            }}>
              <SelectTrigger>
                <SelectValue placeholder="Select appointment type" />
              </SelectTrigger>
              <SelectContent>
                {appointmentTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>
                    <div className="flex items-center justify-between w-full">
                      <span>{type.name}</span>
                      <Badge variant="secondary" className="ml-2">
                        {type.duration}min
                      </Badge>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Select Date</label>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              className="rounded-md border"
              disabled={(date) => 
                date < new Date() || 
                isWeekend(date) ||
                date > new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
              }
            />
          </div>

          {/* Time Selection */}
          {selectedDate && (
            <div className="space-y-2">
              <label className="text-sm font-medium">
                Available Times - {formatDateDisplay(selectedDate)}
              </label>
              <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                {timeSlots.map((slot) => (
                  <Button
                    key={slot.time}
                    variant={selectedTime === slot.time ? "default" : "outline"}
                    disabled={!slot.available}
                    onClick={() => setSelectedTime(slot.time)}
                    className="h-auto p-2 text-xs"
                    title={slot.reason}
                  >
                    <div className="text-center">
                      <div className="font-medium">{slot.time}</div>
                      {selectedTime === slot.time && duration && (
                        <div className="text-xs opacity-75">
                          - {getEndTime(slot.time, duration)}
                        </div>
                      )}
                    </div>
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Additional Notes (Optional)</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any specific concerns or information you'd like to share..."
              className="min-h-[80px]"
            />
          </div>

          {/* Summary */}
          {selectedDate && selectedTime && appointmentType && (
            <div className="bg-gray-50 p-4 rounded-lg space-y-2">
              <h4 className="font-medium flex items-center gap-2">
                <CalendarIcon className="h-4 w-4" />
                Appointment Summary
              </h4>
              <div className="text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  <span>
                    {format(selectedDate, "EEEE, MMMM d, yyyy")} at {selectedTime} - {getEndTime(selectedTime, duration)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3" />
                  <span>
                    {appointmentTypes.find(t => t.id === appointmentType)?.name} ({duration} minutes)
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSchedule}
            disabled={!selectedDate || !selectedTime || !appointmentType || isLoading}
          >
            {isLoading ? "Scheduling..." : "Schedule Appointment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
