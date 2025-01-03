"use client"

import { useState } from "react"
import { Calendar } from "@/components/ui/calendar"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface AppointmentSchedulerProps {
  isOpen: boolean
  onClose: () => void
  onSchedule: (date: Date) => Promise<void>
}

export function AppointmentScheduler({ 
  isOpen, 
  onClose, 
  onSchedule 
}: AppointmentSchedulerProps) {
  const [date, setDate] = useState<Date>()
  const [time, setTime] = useState<string>()

  // Generate time slots from 9 AM to 5 PM
  const timeSlots = Array.from({ length: 17 }, (_, i) => {
    const hour = Math.floor(i / 2) + 9
    const minute = i % 2 === 0 ? "00" : "30"
    return `${hour.toString().padStart(2, "0")}:${minute}`
  })

  const handleSchedule = async () => {
    if (!date || !time) return

    const [hours, minutes] = time.split(":")
    const appointmentDate = new Date(date)
    appointmentDate.setHours(parseInt(hours), parseInt(minutes))

    await onSchedule(appointmentDate)
    onClose()
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Schedule Appointment</DialogTitle>
          <DialogDescription>
            Select a date and time for the appointment
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <Calendar
            mode="single"
            selected={date}
            onSelect={setDate}
            className="rounded-md border"
            disabled={(date) => date < new Date() || date.getDay() === 0 || date.getDay() === 6}
          />
          <Select onValueChange={setTime}>
            <SelectTrigger>
              <SelectValue placeholder="Select time" />
            </SelectTrigger>
            <SelectContent>
              {timeSlots.map((slot) => (
                <SelectItem key={slot} value={slot}>
                  {slot}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex justify-end gap-4">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSchedule}
            disabled={!date || !time}
          >
            Schedule
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
} 