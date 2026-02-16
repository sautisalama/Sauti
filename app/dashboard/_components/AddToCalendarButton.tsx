"use client";
import { cn } from "@/lib/utils";

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { CalendarPlus, Calendar, Download, ExternalLink } from 'lucide-react';
import { generateCalendarUrls, generateICSFile, CalendarEvent } from '@/lib/google-calendar';
import { AppointmentWithDetails } from '../_types';
import { useToast } from '@/hooks/use-toast';


interface AddToCalendarButtonProps {
  appointment: AppointmentWithDetails;
  size?: 'sm' | 'default' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
  className?: string;
}

export function AddToCalendarButton({ 
  appointment, 
  size = 'sm', 
  variant = 'outline',
  className
}: AddToCalendarButtonProps) {

  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const { toast } = useToast();

  const appointmentDate = new Date(appointment.appointment_date);
  const endDate = new Date(appointmentDate.getTime() + (60 * 60 * 1000)); // 1 hour duration

  const calendarEvent: CalendarEvent = {
    title: `Appointment - ${appointment.matched_service?.service_details?.name || 'Healthcare Appointment'}`,
    start: appointmentDate,
    end: endDate,
    description: `
Appointment Details:
${appointment.matched_service?.report?.incident_description || 'Healthcare appointment'}

Professional: ${appointment.professional?.first_name} ${appointment.professional?.last_name}
Survivor: ${appointment.survivor?.first_name} ${appointment.survivor?.last_name}

Status: ${appointment.status}

Platform: Sauti - Supporting survivors with professional care
    `.trim(),
    location: 'Virtual Meeting - Sauti Platform',
    attendees: [
      appointment.professional?.email,
      appointment.survivor?.email,
    ].filter(Boolean) as string[],
  };

  const calendarUrls = generateCalendarUrls(calendarEvent);

  const handleDownloadICS = () => {
    try {
      const icsContent = generateICSFile(calendarEvent);
      const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `appointment-${appointment.appointment_id}.ics`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);

      toast({
        title: 'Calendar file downloaded',
        description: 'The appointment has been downloaded as an ICS file.',
      });
    } catch (error) {
      toast({
        title: 'Download failed',
        description: 'Failed to download calendar file. Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleCreateGoogleEvent = async () => {
    setIsCreatingEvent(true);
    try {
      const response = await fetch('/api/calendar/create-event', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          appointmentId: appointment.appointment_id,
          event: calendarEvent,
        }),
      });

      if (response.ok) {
        toast({
          title: 'Calendar event created',
          description: 'The appointment has been added to your Google Calendar.',
        });
      } else {
        const error = await response.json();
        if (error.error === 'Google Calendar not connected') {
          // Redirect to Google Calendar auth
          window.location.href = '/api/auth/google-calendar';
        } else {
          throw new Error(error.error);
        }
      }
    } catch (error) {
      toast({
        title: 'Failed to create event',
        description: 'Could not add to Google Calendar. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsCreatingEvent(false);
    }
  };

  const handleCalendarUrlOpen = (url: string, provider: string) => {
    window.open(url, '_blank');
    toast({
      title: 'Calendar opened',
      description: `Opening ${provider} calendar in a new tab.`,
    });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant={variant} size={size} className={cn("gap-2", className)}>
          <CalendarPlus className="h-4 w-4" />
          Add to Calendar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem 
          onClick={handleCreateGoogleEvent}
          disabled={isCreatingEvent}
          className="flex items-center gap-2"
        >
          <Calendar className="h-4 w-4 text-blue-600" />
          {isCreatingEvent ? 'Adding to Google...' : 'Google Calendar'}
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={() => handleCalendarUrlOpen(calendarUrls.outlook, 'Outlook')}
          className="flex items-center gap-2"
        >
          <ExternalLink className="h-4 w-4 text-blue-500" />
          Outlook
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => handleCalendarUrlOpen(calendarUrls.office365, 'Office 365')}
          className="flex items-center gap-2"
        >
          <ExternalLink className="h-4 w-4 text-orange-500" />
          Office 365
        </DropdownMenuItem>
        
        <DropdownMenuItem 
          onClick={() => handleCalendarUrlOpen(calendarUrls.yahoo, 'Yahoo')}
          className="flex items-center gap-2"
        >
          <ExternalLink className="h-4 w-4 text-purple-500" />
          Yahoo Calendar
        </DropdownMenuItem>
        
        <DropdownMenuSeparator />
        
        <DropdownMenuItem 
          onClick={handleDownloadICS}
          className="flex items-center gap-2"
        >
          <Download className="h-4 w-4 text-gray-600" />
          Download ICS File
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
