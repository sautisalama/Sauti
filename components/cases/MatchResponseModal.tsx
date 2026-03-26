'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  CheckCircle2, 
  XCircle, 
  Calendar, 
  Clock,
  AlertTriangle,
  Shield,
  User,
  Loader2
} from 'lucide-react';
import { acceptMatchRequest, rejectMatchRequest } from '@/app/actions/matching';
import { TimeSlot } from '@/types/chat';
import { format, addDays, setHours, setMinutes } from 'date-fns';

interface MatchResponseModalProps {
  isOpen: boolean;
  onClose: () => void;
  match: {
    id: string;
    match_score?: number;
    match_date?: string;
    support_service?: string;
    report?: {
      type_of_incident?: string;
      urgency?: string;
      first_name?: string;
    };
    survivor?: {
      first_name?: string;
      is_anonymous?: boolean;
      anon_username?: string;
    };
  };
  onSuccess?: () => void;
}

export function MatchResponseModal({ isOpen, onClose, match, onSuccess }: MatchResponseModalProps) {
  const [step, setStep] = useState<'decision' | 'accept' | 'decline'>('decision');
  const [loading, setLoading] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [selectedTimes, setSelectedTimes] = useState<TimeSlot[]>([]);

  // Generate suggested time slots for next 5 days
  const generateTimeSlots = () => {
    const slots: { date: Date; slots: TimeSlot[] }[] = [];
    for (let i = 1; i <= 5; i++) {
      const date = addDays(new Date(), i);
      const daySlots: TimeSlot[] = [];
      // Morning, afternoon, evening slots
      [9, 11, 14, 16].forEach(hour => {
        const start = setMinutes(setHours(date, hour), 0);
        const end = setMinutes(setHours(date, hour + 1), 0);
        daySlots.push({
          slot_start: start.toISOString(),
          slot_end: end.toISOString()
        });
      });
      slots.push({ date, slots: daySlots });
    }
    return slots;
  };

  const timeSlotOptions = generateTimeSlots();

  const toggleTimeSlot = (slot: TimeSlot) => {
    setSelectedTimes(prev => {
      const exists = prev.find(s => s.slot_start === slot.slot_start);
      if (exists) {
        return prev.filter(s => s.slot_start !== slot.slot_start);
      }
      if (prev.length >= 3) {
        return prev; // Max 3 slots
      }
      return [...prev, slot];
    });
  };

  const handleAccept = async () => {
    if (selectedTimes.length === 0) return;
    setLoading(true);
    try {
      await acceptMatchRequest(match.id, selectedTimes);
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to accept match:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDecline = async () => {
    setLoading(true);
    try {
      await rejectMatchRequest(match.id, declineReason);
      onSuccess?.();
      onClose();
    } catch (error) {
      console.error('Failed to decline match:', error);
    } finally {
      setLoading(false);
    }
  };

  const survivorName = match.survivor?.is_anonymous 
    ? (match.survivor?.anon_username || 'Anonymous')
    : match.survivor?.first_name || match.report?.first_name || 'Anonymous';

  const urgencyColor = {
    high: 'bg-red-100 text-red-700 border-red-200',
    medium: 'bg-amber-100 text-amber-700 border-amber-200',
    low: 'bg-green-100 text-green-700 border-green-200'
  }[match.report?.urgency || 'low'];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg rounded-xl bg-white shadow-2xl border-none p-0 overflow-hidden">
        {step === 'decision' && (
          <>
            {/* Header with gradient */}
            <div className="bg-gradient-to-br from-serene-blue-50 to-serene-blue-100/50 p-6 pb-4">
              <DialogHeader className="space-y-3">
                <div className="flex items-center justify-between">
                  <Badge className={`${urgencyColor} border font-medium`}>
                    {match.report?.urgency?.toUpperCase() || 'NORMAL'} Priority
                  </Badge>
                  <Badge variant="outline" className="bg-white/80">
                    Match Score: {match.match_score || 95}%
                  </Badge>
                </div>
                <DialogTitle className="text-xl font-bold text-serene-neutral-900">
                  New Case Match Request
                </DialogTitle>
                <DialogDescription className="text-serene-neutral-600">
                  You've been matched with a survivor seeking support.
                </DialogDescription>
              </DialogHeader>
            </div>

            {/* Content */}
            <div className="p-6 space-y-5">
              {/* Survivor Info Card */}
              <div className="flex items-center gap-4 p-4 bg-serene-neutral-50 rounded-2xl">
                <Avatar className="h-14 w-14 ring-2 ring-white shadow-sm">
                  <AvatarFallback className="bg-serene-blue-100 text-serene-blue-600 text-lg font-bold">
                    {survivorName.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-serene-neutral-900">{survivorName}</span>
                    {match.survivor?.is_anonymous && (
                      <Shield className="h-4 w-4 text-serene-blue-500" />
                    )}
                  </div>
                  <p className="text-sm text-serene-neutral-500">
                    Incident: {match.report?.type_of_incident?.replace(/_/g, ' ') || 'Not specified'}
                  </p>
                </div>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-3 p-3 bg-amber-50 rounded-xl border border-amber-100">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-amber-800">
                  If you decline, this case will be rematched with another professional. 
                  Please only accept if you can commit to supporting this survivor.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 h-12 rounded-xl border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 hover:border-red-300 transition-all"
                  onClick={() => setStep('decline')}
                >
                  <XCircle className="h-5 w-5 mr-2" />
                  Decline
                </Button>
                <Button
                  className="flex-1 h-12 rounded-xl bg-serene-blue-600 hover:bg-serene-blue-700 text-white shadow-lg shadow-serene-blue-200 transition-all"
                  onClick={() => setStep('accept')}
                >
                  <CheckCircle2 className="h-5 w-5 mr-2" />
                  Accept Case
                </Button>
              </div>
            </div>
          </>
        )}

        {step === 'accept' && (
          <>
            <div className="bg-gradient-to-br from-serene-green-50 to-serene-green-100/50 p-6 pb-4">
              <DialogHeader className="space-y-2">
                <DialogTitle className="text-xl font-bold text-serene-neutral-900 flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-serene-green-500" />
                  Propose Meeting Times
                </DialogTitle>
                <DialogDescription className="text-serene-neutral-600">
                  Select up to 3 available time slots for the survivor to choose from.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto">
              {timeSlotOptions.map(({ date, slots }) => (
                <div key={date.toISOString()} className="space-y-2">
                  <h4 className="text-sm font-semibold text-serene-neutral-700">
                    {format(date, 'EEEE, MMMM d')}
                  </h4>
                  <div className="grid grid-cols-2 gap-2">
                    {slots.map(slot => {
                      const isSelected = selectedTimes.some(s => s.slot_start === slot.slot_start);
                      return (
                        <button
                          key={slot.slot_start}
                          onClick={() => toggleTimeSlot(slot)}
                          className={`
                            p-3 rounded-xl text-sm font-medium transition-all
                            flex items-center justify-center gap-2
                            ${isSelected 
                              ? 'bg-serene-blue-600 text-white shadow-md' 
                              : 'bg-serene-neutral-50 text-serene-neutral-700 hover:bg-serene-neutral-100 border border-serene-neutral-200'
                            }
                          `}
                        >
                          <Clock className="h-4 w-4" />
                          {format(new Date(slot.slot_start), 'h:mm a')}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="p-6 pt-3 border-t border-serene-neutral-100 flex gap-3">
              <Button
                variant="ghost"
                className="flex-1 h-11 rounded-xl"
                onClick={() => setStep('decision')}
              >
                Back
              </Button>
              <Button
                className="flex-1 h-11 rounded-xl bg-serene-green-500 hover:bg-serene-green-600 text-white"
                onClick={handleAccept}
                disabled={selectedTimes.length === 0 || loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Confirm ({selectedTimes.length}/3 selected)
              </Button>
            </div>
          </>
        )}

        {step === 'decline' && (
          <>
            <div className="bg-gradient-to-br from-red-50 to-red-100/50 p-6 pb-4">
              <DialogHeader className="space-y-2">
                <div className="h-12 w-12 rounded-2xl bg-red-100 flex items-center justify-center text-red-600 mb-2">
                  <XCircle className="h-6 w-6" />
                </div>
                <DialogTitle className="text-xl font-bold text-serene-neutral-900">
                  Decline This Match?
                </DialogTitle>
                <DialogDescription className="text-serene-neutral-600">
                  Please provide a reason so we can improve our matching.
                </DialogDescription>
              </DialogHeader>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium text-serene-neutral-700">
                  Reason for declining (optional)
                </Label>
                <Textarea
                  placeholder="e.g., Currently at full capacity, Outside my specialization..."
                  value={declineReason}
                  onChange={(e) => setDeclineReason(e.target.value)}
                  className="min-h-[100px] rounded-xl border-serene-neutral-200 focus:border-serene-blue-300 focus:ring-serene-blue-100 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="ghost"
                  className="flex-1 h-11 rounded-xl"
                  onClick={() => setStep('decision')}
                >
                  Back
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1 h-11 rounded-xl bg-red-600 hover:bg-red-700"
                  onClick={handleDecline}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  Confirm Decline
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
