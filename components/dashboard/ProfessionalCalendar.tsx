'use client';

import { useState, useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight, Clock, User, Video, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, isToday, addDays } from 'date-fns';

interface Appointment {
  appointment_id: string;
  appointment_date: string;
  status: string;
  appointment_type?: string;
  duration_minutes?: number;
  notes?: string;
  survivor?: {
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
  matched_service?: {
    support_service?: {
      name: string;
      service_types: string;
    };
  };
}

interface ProfessionalCalendarProps {
  appointments: Appointment[];
  onAppointmentClick?: (appointment: Appointment) => void;
  onDateClick?: (date: Date) => void;
}

export function ProfessionalCalendar({ 
  appointments, 
  onAppointmentClick,
  onDateClick 
}: ProfessionalCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<'month' | 'day'>('month');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Get appointments for a specific date
  const getAppointmentsForDate = (date: Date) => {
    return appointments.filter(apt => {
      const aptDate = new Date(apt.appointment_date);
      return isSameDay(aptDate, date);
    }).sort((a, b) => 
      new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime()
    );
  };

  // Calendar grid for month view
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentDate]);

  // Week days for day view
  const weekDays = useMemo(() => {
    const start = startOfWeek(selectedDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [selectedDate]);

  // Navigate month
  const goToPreviousMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const goToNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  // Navigate day
  const goToPreviousDay = () => setSelectedDate(addDays(selectedDate, -1));
  const goToNextDay = () => setSelectedDate(addDays(selectedDate, 1));

  // Status color mapping
  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'confirmed': return 'bg-emerald-500';
      case 'pending': return 'bg-amber-500';
      case 'requested': return 'bg-blue-500';
      default: return 'bg-gray-400';
    }
  };

  const selectedDateAppointments = getAppointmentsForDate(selectedDate);

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-serene-neutral-100 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-serene-neutral-100 bg-gradient-to-r from-serene-blue-50 to-white">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-serene-blue-100 rounded-xl">
            <Calendar className="h-5 w-5 text-serene-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-serene-neutral-900">Schedule</h2>
            <p className="text-xs text-serene-neutral-500">
              {viewMode === 'month' 
                ? format(currentDate, 'MMMM yyyy') 
                : format(selectedDate, 'EEEE, MMMM d, yyyy')
              }
            </p>
          </div>
        </div>
        
        {/* View Toggle */}
        <div className="flex items-center gap-2">
          <div className="flex bg-serene-neutral-100 rounded-lg p-1">
            <button
              onClick={() => setViewMode('month')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                viewMode === 'month' 
                  ? 'bg-white text-serene-blue-600 shadow-sm' 
                  : 'text-serene-neutral-500 hover:text-serene-neutral-700'
              }`}
            >
              Month
            </button>
            <button
              onClick={() => setViewMode('day')}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                viewMode === 'day' 
                  ? 'bg-white text-serene-blue-600 shadow-sm' 
                  : 'text-serene-neutral-500 hover:text-serene-neutral-700'
              }`}
            >
              Day
            </button>
          </div>
          
          {/* Navigation */}
          <div className="flex items-center gap-1 ml-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-lg"
              onClick={viewMode === 'month' ? goToPreviousMonth : goToPreviousDay}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm" 
              className="h-8 text-xs font-medium"
              onClick={() => {
                setCurrentDate(new Date());
                setSelectedDate(new Date());
              }}
            >
              Today
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="h-8 w-8 rounded-lg"
              onClick={viewMode === 'month' ? goToNextMonth : goToNextDay}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Month View */}
      {viewMode === 'month' && (
        <div className="p-4">
          {/* Day Headers */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div 
                key={day} 
                className="text-center text-xs font-medium text-serene-neutral-400 py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map(day => {
              const dayAppointments = getAppointmentsForDate(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              const isSelected = isSameDay(day, selectedDate);
              const isTodayDate = isToday(day);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => {
                    setSelectedDate(day);
                    if (dayAppointments.length > 0 || onDateClick) {
                      setViewMode('day');
                      onDateClick?.(day);
                    }
                  }}
                  className={`
                    relative p-2 h-20 rounded-xl text-left transition-all group
                    ${isCurrentMonth ? 'bg-white hover:bg-serene-blue-50' : 'bg-serene-neutral-50/50 text-serene-neutral-300'}
                    ${isSelected ? 'ring-2 ring-serene-blue-500 bg-serene-blue-50' : ''}
                    ${isTodayDate ? 'ring-2 ring-serene-blue-300' : ''}
                  `}
                >
                  <span className={`
                    text-sm font-medium
                    ${isTodayDate ? 'text-serene-blue-600 font-bold' : ''}
                    ${isSelected && !isTodayDate ? 'text-serene-blue-700' : ''}
                  `}>
                    {format(day, 'd')}
                  </span>
                  
                  {/* Appointment Indicators */}
                  {dayAppointments.length > 0 && (
                    <div className="absolute bottom-2 left-2 right-2 space-y-0.5">
                      {dayAppointments.slice(0, 2).map((apt, idx) => (
                        <div 
                          key={apt.appointment_id}
                          className={`h-1.5 rounded-full ${getStatusColor(apt.status)} opacity-80`}
                        />
                      ))}
                      {dayAppointments.length > 2 && (
                        <span className="text-[10px] text-serene-neutral-500">
                          +{dayAppointments.length - 2} more
                        </span>
                      )}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Day View */}
      {viewMode === 'day' && (
        <div className="flex h-96">
          {/* Week Strip */}
          <div className="hidden md:flex flex-col border-r border-serene-neutral-100 px-2 py-4">
            {weekDays.map(day => (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedDate(day)}
                className={`
                  flex flex-col items-center py-2 px-3 rounded-xl mb-1 transition-all
                  ${isSameDay(day, selectedDate) ? 'bg-serene-blue-500 text-white' : 'hover:bg-serene-neutral-50'}
                  ${isToday(day) && !isSameDay(day, selectedDate) ? 'ring-1 ring-serene-blue-300' : ''}
                `}
              >
                <span className="text-[10px] font-medium opacity-70">{format(day, 'EEE')}</span>
                <span className="text-lg font-bold">{format(day, 'd')}</span>
              </button>
            ))}
          </div>

          {/* Day Schedule */}
          <div className="flex-1 overflow-y-auto p-4">
            {selectedDateAppointments.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Calendar className="h-12 w-12 text-serene-neutral-200 mb-3" />
                <p className="text-serene-neutral-500 font-medium">No appointments</p>
                <p className="text-serene-neutral-400 text-sm">
                  {format(selectedDate, 'MMMM d, yyyy')}
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {selectedDateAppointments.map(apt => (
                  <button
                    key={apt.appointment_id}
                    onClick={() => onAppointmentClick?.(apt)}
                    className="w-full group"
                  >
                    <div className={`
                      flex items-start gap-4 p-4 rounded-xl border transition-all
                      hover:shadow-md hover:border-serene-blue-200 bg-white
                      ${apt.status === 'confirmed' ? 'border-l-4 border-l-emerald-500' : ''}
                      ${apt.status === 'pending' ? 'border-l-4 border-l-amber-500' : ''}
                    `}>
                      {/* Time */}
                      <div className="flex flex-col items-center min-w-[60px]">
                        <span className="text-lg font-bold text-serene-neutral-900">
                          {format(new Date(apt.appointment_date), 'HH:mm')}
                        </span>
                        <span className="text-xs text-serene-neutral-400">
                          {apt.duration_minutes || 30} min
                        </span>
                      </div>

                      {/* Details */}
                      <div className="flex-1 text-left">
                        <p className="font-semibold text-serene-neutral-900 group-hover:text-serene-blue-600 transition-colors">
                          {apt.matched_service?.support_service?.name || 'Appointment'}
                        </p>
                        {apt.survivor && (
                          <div className="flex items-center gap-1.5 mt-1 text-sm text-serene-neutral-500">
                            <User className="h-3.5 w-3.5" />
                            {apt.survivor.first_name} {apt.survivor.last_name}
                          </div>
                        )}
                        {apt.appointment_type && (
                          <div className="flex items-center gap-1.5 mt-1 text-xs text-serene-neutral-400">
                            {apt.appointment_type === 'video' ? (
                              <Video className="h-3 w-3" />
                            ) : (
                              <MapPin className="h-3 w-3" />
                            )}
                            {apt.appointment_type === 'video' ? 'Video Call' : 'In Person'}
                          </div>
                        )}
                      </div>

                      {/* Status Badge */}
                      <span className={`
                        px-2 py-1 rounded-full text-[10px] font-medium uppercase
                        ${apt.status === 'confirmed' ? 'bg-emerald-100 text-emerald-700' : ''}
                        ${apt.status === 'pending' ? 'bg-amber-100 text-amber-700' : ''}
                        ${apt.status === 'requested' ? 'bg-blue-100 text-blue-700' : ''}
                      `}>
                        {apt.status}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Footer Stats */}
      <div className="flex items-center justify-between px-4 py-3 bg-serene-neutral-50/50 border-t border-serene-neutral-100">
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-serene-neutral-600">Confirmed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-serene-neutral-600">Pending</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-blue-500" />
            <span className="text-serene-neutral-600">Requested</span>
          </div>
        </div>
        <span className="text-xs text-serene-neutral-500">
          {appointments.length} total appointments
        </span>
      </div>
    </div>
  );
}
