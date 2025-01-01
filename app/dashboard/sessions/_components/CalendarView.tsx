"use client";

import { Calendar } from "@/components/ui/calendar";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Database } from "@/types/db-schema";
import { format } from "date-fns";

type AppointmentWithProfessional = Database["public"]["Tables"]["appointments"]["Row"] & {
  professional_profiles: {
    id: string;
    bio: string;
    profession: string;
    profiles: {
      first_name: string | null;
      last_name: string | null;
    } | null;
  } | null;
};

interface CalendarViewProps {
  appointments: AppointmentWithProfessional[];
}

export default function CalendarView({ appointments }: CalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // Convert appointments to a format suitable for the calendar
  const appointmentDates = appointments.reduce((acc, appointment) => {
    const date = new Date(appointment.date);
    const dateStr = format(date, "yyyy-MM-dd");
    if (!acc[dateStr]) {
      acc[dateStr] = [];
    }
    acc[dateStr].push(appointment);
    return acc;
  }, {} as Record<string, AppointmentWithProfessional[]>);

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <Calendar
        mode="single"
        selected={selectedDate}
        onSelect={setSelectedDate}
        className="rounded-md border"
        modifiers={{
          hasAppointment: (date) => {
            const dateStr = format(date, "yyyy-MM-dd");
            return !!appointmentDates[dateStr];
          },
        }}
        modifiersStyles={{
          hasAppointment: {
            fontWeight: "bold",
            backgroundColor: "rgb(0 165 165 / 0.1)",
          },
        }}
      />

      {selectedDate && (
        <div className="mt-6">
          <h3 className="font-semibold mb-4">
            Appointments for {format(selectedDate, "MMMM d, yyyy")}
          </h3>
          <div className="space-y-3">
            {appointmentDates[format(selectedDate, "yyyy-MM-dd")]?.map((appointment) => (
              <div
                key={appointment.id}
                className="flex items-center justify-between p-3 rounded-lg border"
              >
                <div>
                  <p className="font-medium">
                    {appointment.professional_profiles?.profiles?.first_name}{" "}
                    {appointment.professional_profiles?.profiles?.last_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {appointment.professional_profiles?.profession}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(new Date(appointment.date), "h:mm a")}
                  </p>
                </div>
                <Badge variant={appointment.status === "confirmed" ? "default" : "secondary"}>
                  {appointment.status}
                </Badge>
              </div>
            ))}
            {!appointmentDates[format(selectedDate, "yyyy-MM-dd")] && (
              <p className="text-muted-foreground text-sm">No appointments scheduled</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
} 