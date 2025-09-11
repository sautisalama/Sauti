"use client";

import { useState, useEffect } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Clock, User, Phone, Mail, Calendar as CalendarIcon, CheckCircle } from "lucide-react";
import { format, addMinutes, isToday, isTomorrow } from "date-fns";

interface TimeSlot {
  time: string;
  available: boolean;
  reason?: string;
}

interface EnhancedPublicSchedulerProps {
  professionalId: string;
  professionalName: string;
  calLink?: string;
}

export function EnhancedPublicScheduler({
  professionalId,
  professionalName,
  calLink,
}: EnhancedPublicSchedulerProps) {
  const [selectedDate, setSelectedDate] = useState<Date>();
  const [selectedTime, setSelectedTime] = useState<string>();
  const [appointmentType, setAppointmentType] = useState<string>();
  const [duration, setDuration] = useState<number>(60);
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  
  // Client information
  const [clientInfo, setClientInfo] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    notes: '',
    emergencyContact: '',
  });

  // Generate time slots for selected date
  useEffect(() => {
    if (!selectedDate) return;

    const slots: TimeSlot[] = [];
    for (let hour = 9; hour < 17; hour++) {
      for (let minutes = 0; minutes < 60; minutes += 30) {
        const time = `${hour.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
        
        // Mock availability check - replace with real API call
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
    { id: "initial_consultation", name: "Initial Consultation", duration: 60, description: "First time meeting to assess needs" },
    { id: "support_session", name: "Support Session", duration: 45, description: "Ongoing support and counseling" },
    { id: "crisis_intervention", name: "Crisis Intervention", duration: 90, description: "Immediate crisis support" },
    { id: "group_session", name: "Group Session", duration: 120, description: "Group therapy or support session" },
    { id: "follow_up", name: "Follow-up", duration: 30, description: "Brief check-in session" },
  ];

  const handleSchedule = async () => {
    if (!selectedDate || !selectedTime || !appointmentType || !clientInfo.firstName || !clientInfo.email) {
      return;
    }

    setIsLoading(true);
    
    try {
      const [hours, minutes] = selectedTime.split(":").map(Number);
      const appointmentDate = new Date(selectedDate);
      appointmentDate.setHours(hours, minutes, 0, 0);

      const response = await fetch('/api/appointments/public', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          professionalId,
          date: appointmentDate.toISOString(),
          type: appointmentType,
          duration,
          clientInfo,
        }),
      });

      if (response.ok) {
        setIsComplete(true);
      } else {
        throw new Error('Failed to schedule appointment');
      }
    } catch (error) {
      console.error('Error scheduling appointment:', error);
      alert('Failed to schedule appointment. Please try again.');
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

  const isFormValid = () => {
    return selectedDate && 
           selectedTime && 
           appointmentType && 
           clientInfo.firstName.trim() && 
           clientInfo.email.trim();
  };

  if (isComplete) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-8 h-8 text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Appointment Requested!</h3>
          <p className="text-gray-600 mb-6">
            Your appointment request has been sent to {professionalName}. 
            They will contact you within 24 hours to confirm the details.
          </p>
          <div className="bg-gray-50 rounded-lg p-4 mb-6 text-left">
            <h4 className="font-medium mb-2">Appointment Details:</h4>
            <p className="text-sm text-gray-600">
              📅 {selectedDate && format(selectedDate, "EEEE, MMMM d, yyyy")} at {selectedTime}
            </p>
            <p className="text-sm text-gray-600">
              ⏱️ {appointmentTypes.find(t => t.id === appointmentType)?.name} ({duration} minutes)
            </p>
            <p className="text-sm text-gray-600">
              👥 With {professionalName}
            </p>
          </div>
          <div className="text-sm text-gray-500">
            <p>A confirmation email has been sent to {clientInfo.email}</p>
            <p className="mt-2">
              Need to make changes? Please contact {professionalName} directly.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* Left Column - Appointment Details */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Schedule Your Appointment
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Appointment Type */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Session Type</label>
              <Select onValueChange={(value) => {
                setAppointmentType(value);
                const selected = appointmentTypes.find(t => t.id === value);
                if (selected) setDuration(selected.duration);
              }}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose the type of session you need" />
                </SelectTrigger>
                <SelectContent>
                  {appointmentTypes.map((type) => (
                    <SelectItem key={type.id} value={type.id}>
                      <div className="flex items-center justify-between w-full">
                        <div className="text-left">
                          <div className="font-medium">{type.name}</div>
                          <div className="text-xs text-gray-500">{type.description}</div>
                        </div>
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
                  date > new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
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
          </CardContent>
        </Card>
      </div>

      {/* Right Column - Client Information */}
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Your Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">First Name *</label>
                <Input
                  value={clientInfo.firstName}
                  onChange={(e) => setClientInfo(prev => ({...prev, firstName: e.target.value}))}
                  placeholder="Your first name"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Last Name</label>
                <Input
                  value={clientInfo.lastName}
                  onChange={(e) => setClientInfo(prev => ({...prev, lastName: e.target.value}))}
                  placeholder="Your last name"
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-medium">Email Address *</label>
              <Input
                type="email"
                value={clientInfo.email}
                onChange={(e) => setClientInfo(prev => ({...prev, email: e.target.value}))}
                placeholder="your.email@example.com"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Phone Number</label>
              <Input
                type="tel"
                value={clientInfo.phone}
                onChange={(e) => setClientInfo(prev => ({...prev, phone: e.target.value}))}
                placeholder="Your phone number"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Emergency Contact</label>
              <Input
                value={clientInfo.emergencyContact}
                onChange={(e) => setClientInfo(prev => ({...prev, emergencyContact: e.target.value}))}
                placeholder="Name and phone of emergency contact"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Additional Notes</label>
              <Textarea
                value={clientInfo.notes}
                onChange={(e) => setClientInfo(prev => ({...prev, notes: e.target.value}))}
                placeholder="Any additional information you'd like to share..."
                className="min-h-[80px]"
              />
            </div>
          </CardContent>
        </Card>

        {/* Summary and Book Button */}
        {selectedDate && selectedTime && appointmentType && (
          <Card>
            <CardContent className="p-6">
              <h4 className="font-medium flex items-center gap-2 mb-4">
                <CalendarIcon className="h-4 w-4" />
                Appointment Summary
              </h4>
              <div className="space-y-2 text-sm mb-6">
                <div className="flex items-center gap-2">
                  <Clock className="h-3 w-3" />
                  <span>
                    {format(selectedDate, "EEEE, MMMM d, yyyy")} at {selectedTime} - {getEndTime(selectedTime, duration)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <User className="h-3 w-3" />
                  <span>
                    {appointmentTypes.find(t => t.id === appointmentType)?.name} ({duration} minutes)
                  </span>
                </div>
              </div>
              
              <Button
                onClick={handleSchedule}
                disabled={!isFormValid() || isLoading}
                className="w-full"
                size="lg"
              >
                {isLoading ? "Requesting Appointment..." : "Request Appointment"}
              </Button>
              
              <p className="text-xs text-gray-500 mt-3 text-center">
                By booking, you agree to our terms of service and privacy policy.
                This is a request - the professional will confirm your appointment.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
