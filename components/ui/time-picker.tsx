"use client";

import { useState } from "react";
import { Select } from "@/components/ui/select";

interface TimePickerDemoProps {
  selected?: string;
  onTimeChange: (time: string) => void;
}

export function TimePickerDemo({ selected, onTimeChange }: TimePickerDemoProps) {
  const hours = Array.from({ length: 24 }, (_, i) => 
    i.toString().padStart(2, '0')
  );
  const minutes = ['00', '15', '30', '45'];

  const [selectedHour, setSelectedHour] = useState(selected?.split(':')[0] || '09');
  const [selectedMinute, setSelectedMinute] = useState(selected?.split(':')[1] || '00');

  const handleTimeChange = (hour: string, minute: string) => {
    const time = `${hour}:${minute}`;
    onTimeChange(time);
  };

  return (
    <div className="flex gap-2 p-4">
      <Select
        value={selectedHour}
        onValueChange={(hour) => {
          setSelectedHour(hour);
          handleTimeChange(hour, selectedMinute);
        }}
      >
        {hours.map((hour) => (
          <option key={hour} value={hour}>
            {hour}
          </option>
        ))}
      </Select>
      <Select
        value={selectedMinute}
        onValueChange={(minute) => {
          setSelectedMinute(minute);
          handleTimeChange(selectedHour, minute);
        }}
      >
        {minutes.map((minute) => (
          <option key={minute} value={minute}>
            {minute}
          </option>
        ))}
      </Select>
    </div>
  );
} 