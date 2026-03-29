'use client';

import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar } from '@/components/ui/calendar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Clock, 
  Calendar as CalendarIcon,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { TimeSlot } from '@/types/chat';
import { format, addDays, setHours, setMinutes, isSameDay } from 'date-fns';
import { getAvailabilityBlocks } from '@/app/actions/availability';
import { createClient } from '@/utils/supabase/client';

interface ScheduleMeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (times: TimeSlot[], reason?: string) => Promise<void>;
  professionalId?: string;
  title?: string;
  description?: string;
  maxSelections?: number;
}

export function ScheduleMeetingModal({
  isOpen,
  onClose,
  onSubmit,
  professionalId,
  title = 'Schedule Meeting',
  description = 'Select your preferred meeting times.',
  maxSelections = 3
}: ScheduleMeetingModalProps) {
  const [selectedDate, setSelectedDate] = useState<Date>(addDays(new Date(), 1));
  const [selectedTimes, setSelectedTimes] = useState<TimeSlot[]>([]);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingSlots, setFetchingSlots] = useState(false);
  const [availableSlots, setAvailableSlots] = useState<TimeSlot[]>([]);
  const [blockedSlots, setBlockedSlots] = useState<{ start: Date; end: Date }[]>([]);
  
  const supabase = createClient();

  // Generate time slots for a given date, respecting blocked times
  const generateTimeSlotsForDate = (date: Date) => {
    const slots: TimeSlot[] = [];
    const workingHours = [9, 10, 11, 12, 14, 15, 16, 17]; // 9am-12pm, 2pm-6pm
    
    workingHours.forEach(hour => {
      const start = setMinutes(setHours(date, hour), 0);
      const end = setMinutes(setHours(date, hour + 1), 0);
      
      // Check if this slot overlaps with any blocked time
      const isBlocked = blockedSlots.some(block => 
        (start >= block.start && start < block.end) ||
        (end > block.start && end <= block.end) ||
        (start <= block.start && end >= block.end)
      );
      
      if (!isBlocked && start > new Date()) {
        slots.push({
          slot_start: start.toISOString(),
          slot_end: end.toISOString()
        });
      }
    });
    
    return slots;
  };

  // Fetch blocked times for professional
  useEffect(() => {
    const fetchBlockedTimes = async () => {
      if (!professionalId || !isOpen) return;
      
      setFetchingSlots(true);
      try {
        // Fetch availability blocks
        const startOfRange = new Date();
        const endOfRange = addDays(new Date(), 30);
        
        const blocks = await getAvailabilityBlocks(professionalId, startOfRange, endOfRange);
        
        if (blocks) {
          setBlockedSlots(blocks.map(b => ({
            start: new Date(b.start_time),
            end: new Date(b.end_time)
          })));
        }

        // Also fetch existing appointments
        const { data: appointments } = await supabase
          .from('appointments')
          .select('appointment_date, duration_minutes')
          .eq('professional_id', professionalId)
          .gte('appointment_date', startOfRange.toISOString())
          .lte('appointment_date', endOfRange.toISOString())
          .in('status', ['pending', 'confirmed']);

        if (appointments) {
          const apptBlocks = appointments
            .filter(apt => apt.appointment_date !== null)
            .map(apt => {
              const startDate = new Date(apt.appointment_date as string);
              return {
                start: startDate,
                end: new Date(startDate.getTime() + (apt.duration_minutes || 60) * 60000)
              };
            });
          setBlockedSlots(prev => [...prev, ...apptBlocks]);
        }
      } catch (error) {
        console.error('Failed to fetch blocked times:', error);
      } finally {
        setFetchingSlots(false);
      }
    };

    fetchBlockedTimes();
  }, [professionalId, isOpen]);

  // Update available slots when date changes
  useEffect(() => {
    if (selectedDate) {
      const slots = generateTimeSlotsForDate(selectedDate);
      setAvailableSlots(slots);
    }
  }, [selectedDate, blockedSlots]);

  const toggleTimeSlot = (slot: TimeSlot) => {
    setSelectedTimes(prev => {
      const exists = prev.find(s => s.slot_start === slot.slot_start);
      if (exists) {
        return prev.filter(s => s.slot_start !== slot.slot_start);
      }
      if (prev.length >= maxSelections) {
        return prev;
      }
      return [...prev, slot];
    });
  };

  const handleSubmit = async () => {
    if (selectedTimes.length === 0) return;
    setLoading(true);
    try {
      await onSubmit(selectedTimes, reason || undefined);
      setSelectedTimes([]);
      setReason('');
      onClose();
    } catch (error) {
      console.error('Failed to submit:', error);
    } finally {
      setLoading(false);
    }
  };

  // Check if a date has any available slots
  const dateHasAvailability = (date: Date) => {
    const slots = generateTimeSlotsForDate(date);
    return slots.length > 0;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl rounded-xl bg-white shadow-2xl border-none p-0 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-serene-blue-50 to-serene-blue-100/50 p-6 pb-4">
          <DialogHeader className="space-y-2">
            <div className="h-10 w-10 rounded-xl bg-serene-blue-100 flex items-center justify-center text-serene-blue-600 mb-2">
              <CalendarIcon className="h-5 w-5" />
            </div>
            <DialogTitle className="text-xl font-bold text-serene-neutral-900">
              {title}
            </DialogTitle>
            <DialogDescription className="text-serene-neutral-600">
              {description}
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Content */}
        <div className="flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-serene-neutral-100">
          {/* Calendar */}
          <div className="p-4 flex-shrink-0">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={(date) => date && setSelectedDate(date)}
              disabled={(date) => 
                date < new Date() || 
                date > addDays(new Date(), 30) ||
                !dateHasAvailability(date)
              }
              className="rounded-xl border border-serene-neutral-200"
              modifiers={{
                hasSlots: (date) => dateHasAvailability(date) && date > new Date()
              }}
              modifiersClassNames={{
                hasSlots: 'bg-serene-green-50 text-serene-green-700 font-medium'
              }}
            />
            <p className="text-xs text-serene-neutral-500 mt-2 text-center">
              Green dates have available slots
            </p>
          </div>

          {/* Time Slots */}
          <div className="flex-1 p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="font-semibold text-serene-neutral-900">
                {format(selectedDate, 'EEEE, MMMM d')}
              </h4>
              {selectedTimes.length > 0 && (
                <span className="text-sm text-serene-blue-600 font-medium">
                  {selectedTimes.length}/{maxSelections} selected
                </span>
              )}
            </div>

            {fetchingSlots ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-serene-blue-500" />
              </div>
            ) : availableSlots.length > 0 ? (
              <ScrollArea className="h-[250px] pr-4">
                <div className="grid grid-cols-2 gap-2">
                  {availableSlots.map(slot => {
                    const isSelected = selectedTimes.some(s => s.slot_start === slot.slot_start);
                    return (
                      <button
                        key={slot.slot_start}
                        onClick={() => toggleTimeSlot(slot)}
                        disabled={!isSelected && selectedTimes.length >= maxSelections}
                        className={`
                          p-3 rounded-xl text-sm font-medium transition-all
                          flex items-center justify-center gap-2
                          ${isSelected 
                            ? 'bg-serene-blue-600 text-white shadow-md' 
                            : selectedTimes.length >= maxSelections
                              ? 'bg-serene-neutral-100 text-serene-neutral-400 cursor-not-allowed'
                              : 'bg-serene-neutral-50 text-serene-neutral-700 hover:bg-serene-neutral-100 border border-serene-neutral-200 hover:border-serene-blue-200'
                          }
                        `}
                      >
                        <Clock className="h-4 w-4" />
                        {format(new Date(slot.slot_start), 'h:mm a')}
                        {isSelected && <CheckCircle2 className="h-4 w-4 ml-auto" />}
                      </button>
                    );
                  })}
                </div>
              </ScrollArea>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <AlertCircle className="h-10 w-10 text-serene-neutral-300 mb-3" />
                <p className="text-serene-neutral-600 font-medium">No available slots</p>
                <p className="text-sm text-serene-neutral-500">
                  Try selecting a different date
                </p>
              </div>
            )}

            {/* Reason Input */}
            <div className="space-y-2 pt-2">
              <Label className="text-sm font-medium text-serene-neutral-700">
                Additional notes (optional)
              </Label>
              <Textarea
                placeholder="Any preferences or special requirements..."
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="min-h-[60px] rounded-xl border-serene-neutral-200 focus:border-serene-blue-300 focus:ring-serene-blue-100 resize-none text-sm"
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-serene-neutral-100 flex gap-3 bg-serene-neutral-50/50">
          <Button
            variant="ghost"
            className="flex-1 h-11 rounded-xl"
            onClick={onClose}
          >
            Cancel
          </Button>
          <Button
            className="flex-1 h-11 rounded-xl bg-serene-blue-600 hover:bg-serene-blue-700 text-white shadow-sm"
            onClick={handleSubmit}
            disabled={selectedTimes.length === 0 || loading}
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle2 className="h-4 w-4 mr-2" />
            )}
            Confirm Selection
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
