"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Calendar, Clock } from "lucide-react";

interface Appointment {
  id: string;
  doctorName: string; 
  doctorImage: string;
  time: string;
  type: string;
  duration: string;
  status: "upcoming" | "joined" | "available";
}

const appointments: Appointment[] = [
  {
    id: "1",
    doctorName: "Dr Emilia Winson",
    doctorImage: "/doctors/dr-emilia.jpg",
    time: "8:00 AM - 9:00 AM",
    type: "Group Check",
    duration: "30 Mins",
    status: "upcoming"
  },
  {
    id: "2",
    doctorName: "Sauti Salama",
    doctorImage: "/avatars/sauti.jpg",
    time: "8:00 AM - 9:00 AM",
    type: "Event Name",
    duration: "30 Mins",
    status: "available"
  },
  {
    id: "3",
    doctorName: "Adv Maina Njugu",
    doctorImage: "/avatars/maina.jpg",
    time: "8:00 AM - 9:00 AM",
    type: "Case Proceedings",
    duration: "30 Mins",
    status: "joined"
  }
];

export function UpcomingAppointments() {
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold text-[#1A3434]">Upcoming Appointments</h2>
      
      {/* Featured Appointment Card */}
      <div className="relative">
        <div className="relative h-48 w-full overflow-hidden rounded-lg">
          <Image
            src="/appointments/featured.jpg"
            alt="Hospital" 
            fill
            className="object-cover"
          />
        </div>
        
        <div className="mt-4">
          <h3 className="font-medium">Hospital</h3>
          <p className="text-sm text-gray-500">Location,Country</p>
        </div>

        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/doctors/dr-emilia.jpg"
              alt="Dr Emilia Winson"
              width={40}
              height={40}
              className="rounded-full"
            />
            <div>
              <h4 className="font-medium">Dr Emilia Winson</h4>
              <p className="text-sm text-gray-500">Lorem ipsum dolors sit</p>
            </div>
          </div>
          <Button className="bg-[#00A5A5] hover:bg-[#008585]">
            Video Call
          </Button>
        </div>

        <div className="mt-4 flex gap-4">
          <div className="flex-1 rounded-lg bg-[#1A3434] p-4 text-white">
            <div className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              <span>Date</span>
            </div>
          </div>
          <div className="flex-1 rounded-lg bg-[#1A3434] p-4 text-white">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              <span>Time</span>
            </div>
          </div>
        </div>
      </div>

      {/* Appointment List */}
      <div className="space-y-3">
        {appointments.map((appointment) => (
          <div
            key={appointment.id}
            className={`flex items-center justify-between rounded-lg p-4 ${
              appointment.id === "1" ? "bg-[#FFF8F0]" :
              appointment.id === "2" ? "bg-[#F0F9FF]" :
              "bg-[#FFF5F5]"
            }`}
          >
            <div className="flex items-center gap-3">
              <Image
                src={appointment.doctorImage}
                alt={appointment.doctorName}
                width={40}
                height={40}
                className="rounded-full"
              />
              <div>
                <h4 className="font-medium">{appointment.doctorName}</h4>
                <p className="text-sm text-gray-500">{appointment.time}</p>
              </div>
            </div>

            <div className="flex items-center gap-6">
              <div>
                <p className="font-medium">{appointment.type}</p>
                <p className="text-sm text-gray-500">{appointment.duration}</p>
              </div>
              <Button 
                className={
                  appointment.status === "joined" 
                    ? "bg-[#00A5A5] hover:bg-[#008585]"
                    : "bg-[#00A5A5] hover:bg-[#008585]"
                }
              >
                {appointment.status === "upcoming" ? "Join Now" :
                 appointment.status === "available" ? "Join" :
                 "Joined"}
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
} 