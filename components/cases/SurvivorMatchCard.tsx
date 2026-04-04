'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  CheckCircle2,
  Clock,
  Calendar,
  MessageSquare,
  RefreshCw,
  Shield,
  Star,
  Building2,
  Phone,
  Mail,
  ChevronRight,
  Loader2
} from 'lucide-react';
import { MatchStatusType, TimeSlot } from '@/types/chat';
import { confirmMatch, requestReschedule } from '@/app/actions/matching';
import { format } from 'date-fns';
import { useRouter } from 'next/navigation';
import {ScheduleMeetingModal} from '@/components/cases/ScheduleMeetingModal';

interface SurvivorMatchCardProps {
  match: {
    id: string;
    match_status_type?: MatchStatusType;
    match_score?: number;
    match_date?: string;
    proposed_meeting_times?: TimeSlot[];
    chat_id?: string;
    support_services?: {
      id: string;
      name: string;
      service_types: string;
      user_id?: string;
      email?: string;
      phone_number?: string;
    };
    professional?: {
      id: string;
      first_name?: string;
      last_name?: string;
      avatar_url?: string;
      professional_title?: string;
    };
  };
  onUpdate?: () => void;
}

export function SurvivorMatchCard({ match, onUpdate }: SurvivorMatchCardProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [selectedTime, setSelectedTime] = useState<TimeSlot | null>(null);
  const [showReschedule, setShowReschedule] = useState(false);

  const statusConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    proposed: {
      label: 'Awaiting Professional',
      color: 'bg-amber-100 text-amber-700 border-amber-200',
      icon: <Clock className="h-3.5 w-3.5" />
    },
    pending_survivor: {
      label: 'Action Required',
      color: 'bg-blue-100 text-blue-700 border-blue-200',
      icon: <CheckCircle2 className="h-3.5 w-3.5" />
    },
    accepted: {
      label: 'Confirmed',
      color: 'bg-green-100 text-green-700 border-green-200',
      icon: <CheckCircle2 className="h-3.5 w-3.5" />
    },
    reschedule_requested: {
      label: 'Reschedule Pending',
      color: 'bg-purple-100 text-purple-700 border-purple-200',
      icon: <RefreshCw className="h-3.5 w-3.5" />
    },
    declined: {
      label: 'Declined',
      color: 'bg-red-100 text-red-700 border-red-200',
      icon: <Clock className="h-3.5 w-3.5" />
    }
  };

  const status = statusConfig[match.match_status_type || 'pending'] || statusConfig.proposed;

  const handleConfirm = async () => {
    if (!selectedTime) return;
    setLoading(true);
    try {
      const result = await confirmMatch(match.id, selectedTime);
      if (result.chatId) {
        router.push(`/dashboard/chat/${result.chatId}`);
      }
      onUpdate?.();
    } catch (error) {
      console.error('Failed to confirm match:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReschedule = async (times: TimeSlot[], reason?: string) => {
    setLoading(true);
    try {
      await requestReschedule(match.id, times, reason);
      setShowReschedule(false);
      onUpdate?.();
    } catch (error) {
      console.error('Failed to request reschedule:', error);
    } finally {
      setLoading(false);
    }
  };

  const professionalName = match.professional 
    ? `${match.professional.first_name || ''} ${match.professional.last_name || ''}`.trim()
    : match.support_services?.name || 'Support Service';

  return (
    <>
      <Card className="overflow-hidden rounded-2xl border-serene-neutral-100/50 bg-white shadow-sm hover:shadow-md transition-all">
        {/* Status Bar */}
        <div className={`h-1.5 ${match.match_status_type === 'accepted' ? 'bg-serene-green-500' : match.match_status_type === 'pending_survivor' ? 'bg-serene-blue-500' : 'bg-serene-neutral-200'}`} />
        
        <CardContent className="p-5">
          {/* Header */}
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12 ring-2 ring-serene-neutral-100 shadow-sm">
                <AvatarImage src={match.professional?.avatar_url} />
                <AvatarFallback className="bg-serene-blue-50 text-serene-blue-600 font-bold">
                  {professionalName.charAt(0).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-bold text-serene-neutral-900">{professionalName}</h3>
                <p className="text-sm text-serene-neutral-500">
                  {match.professional?.professional_title || match.support_services?.service_types?.replace(/_/g, ' ')}
                </p>
              </div>
            </div>
            <Badge className={`${status.color} border flex items-center gap-1.5`}>
              {status.icon}
              {status.label}
            </Badge>
          </div>

          {/* Service Info */}
          <div className="flex items-center gap-2 mb-4 text-sm text-serene-neutral-600">
            <Building2 className="h-4 w-4 text-serene-neutral-400" />
            <span>{match.support_services?.name}</span>
            <span className="text-serene-neutral-300">•</span>
            <Star className="h-4 w-4 text-amber-500" />
            <span>{match.match_score || 95}% match</span>
          </div>

          {/* Proposed Times (when pending_survivor) */}
          {match.match_status_type === 'pending_survivor' && match.proposed_meeting_times && match.proposed_meeting_times.length > 0 && (
            <div className="bg-serene-blue-50/50 rounded-2xl p-4 mb-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-serene-blue-700">
                <Calendar className="h-4 w-4" />
                Select a meeting time
              </div>
              <div className="grid gap-2">
                {match.proposed_meeting_times.map((slot, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedTime(slot)}
                    className={`
                      flex items-center justify-between p-3 rounded-xl transition-all text-left
                      ${selectedTime?.slot_start === slot.slot_start
                        ? 'bg-serene-blue-600 text-white shadow-md'
                        : 'bg-white border border-serene-neutral-200 hover:border-serene-blue-300 text-serene-neutral-700'
                      }
                    `}
                  >
                    <div className="flex items-center gap-3">
                      <Clock className={`h-4 w-4 ${selectedTime?.slot_start === slot.slot_start ? 'text-blue-200' : 'text-serene-neutral-400'}`} />
                      <div>
                        <div className="font-medium">
                          {format(new Date(slot.slot_start), 'EEEE, MMMM d')}
                        </div>
                        <div className={`text-sm ${selectedTime?.slot_start === slot.slot_start ? 'text-blue-200' : 'text-serene-neutral-500'}`}>
                          {format(new Date(slot.slot_start), 'h:mm a')} - {format(new Date(slot.slot_end), 'h:mm a')}
                        </div>
                      </div>
                    </div>
                    {selectedTime?.slot_start === slot.slot_start && (
                      <CheckCircle2 className="h-5 w-5" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3">
            {match.match_status_type === 'pending_survivor' && (
              <>
                <Button
                  variant="outline"
                  className="flex-1 h-11 rounded-xl border-serene-neutral-200 hover:bg-serene-neutral-50"
                  onClick={() => setShowReschedule(true)}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Request Reschedule
                </Button>
                <Button
                  className="flex-1 h-11 rounded-xl bg-serene-blue-600 hover:bg-serene-blue-700 text-white shadow-sm"
                  onClick={handleConfirm}
                  disabled={!selectedTime || loading}
                >
                  {loading ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                  )}
                  Confirm Meeting
                </Button>
              </>
            )}

            {match.match_status_type === 'accepted' && match.chat_id && (
              <Button
                className="flex-1 h-11 rounded-xl bg-serene-blue-600 hover:bg-serene-blue-700 text-white"
                onClick={() => router.push(`/dashboard/chat/${match.chat_id}`)}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Open Chat
                <ChevronRight className="h-4 w-4 ml-auto" />
              </Button>
            )}

            {match.match_status_type === 'proposed' && (
              <div className="flex-1 text-center py-3 text-sm text-serene-neutral-500">
                Waiting for the professional to respond...
              </div>
            )}

            {match.match_status_type === 'reschedule_requested' && (
              <div className="flex-1 text-center py-3 text-sm text-serene-neutral-500">
                Waiting for the professional to propose new times...
              </div>
            )}
          </div>

          {/* Contact Info (when accepted) */}
          {match.match_status_type === 'accepted' && (
            <div className="flex gap-3 mt-4 pt-4 border-t border-serene-neutral-100">
              {match.support_services?.email && (
                <a 
                  href={`mailto:${match.support_services.email}`}
                  className="flex items-center gap-2 text-sm text-serene-neutral-600 hover:text-serene-blue-600 transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  Email
                </a>
              )}
              {match.support_services?.phone_number && (
                <a 
                  href={`tel:${match.support_services.phone_number}`}
                  className="flex items-center gap-2 text-sm text-serene-neutral-600 hover:text-serene-blue-600 transition-colors"
                >
                  <Phone className="h-4 w-4" />
                  Call
                </a>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <ScheduleMeetingModal
        isOpen={showReschedule}
        onClose={() => setShowReschedule(false)}
        onSubmit={handleRequestReschedule}
        professionalId={match.support_services?.user_id}
        title="Request Different Times"
        description="Select alternative times that work better for you."
      />
    </>
  );
}
