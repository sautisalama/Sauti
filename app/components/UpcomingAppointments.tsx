"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { useState } from "react";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { format } from "date-fns";
import { TimePickerDemo } from "@/components/ui/time-picker";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";

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
		status: "upcoming",
	},
	{
		id: "2",
		doctorName: "Sauti Salama",
		doctorImage: "/doctors/sauti.jpeg",
		time: "8:00 AM - 9:00 AM",
		type: "Event Name",
		duration: "30 Mins",
		status: "available",
	},
	{
		id: "3",
		doctorName: "Adv Maina Njugu",
		doctorImage: "/doctors/maina.jpeg",
		time: "8:00 AM - 9:00 AM",
		type: "Case Proceedings",
		duration: "30 Mins",
		status: "joined",
	},
];

export function UpcomingAppointments() {
	const [date, setDate] = useState<Date>();
	const [time, setTime] = useState<string>();

	return (
		<div className="space-y-6">
			<h2 className="text-xl font-semibold text-[#1A3434]">
				Upcoming Appointments
			</h2>

			{/* Featured Appointment Section */}
			<div className="grid grid-cols-[1fr_auto] gap-4">
				{/* Doctor Info Card */}
				<div className="space-y-4">
					<div className="flex items-center gap-3">
						<Avatar className="h-12 w-12">
							<AvatarImage src="/dashboard/featured.png" alt="Dr Emilia Winson" />
							<AvatarFallback>EW</AvatarFallback>
						</Avatar>
						<div className="flex items-center justify-between flex-1">
							<div>
								<h4 className="font-medium text-[#1A3434]">Dr Emilia Winson</h4>
								<p className="text-sm text-gray-600">Your mental health coach</p>
							</div>
							<Button
								className="rounded-full bg-[#00A5A5] px-6 hover:bg-[#008585]"
								asChild
							>
								<Link href="/chat">Chat</Link>
							</Button>
						</div>
					</div>

					{/* Hospital Info */}
					<div className="space-y-1">
						<h3 className="text-lg font-semibold">Good Life Center</h3>
						<p className="text-gray-600">Nairobi,Kenya</p>
					</div>

					{/* Schedule Card */}
					<div className="rounded-2xl bg-[#1A3434] p-4">
						<div className="flex justify-between text-white">
							<div className="flex items-center gap-2">
								<CalendarIcon className="h-5 w-5" />
								<span>Thursday, March 28, 2025</span>
							</div>

							<div className="flex items-center gap-2">
								<Clock className="h-5 w-5" />
								<span>10:00 AM</span>
							</div>
						</div>
						{/* <div className="flex justify-between text-white">
							<Popover>
								<PopoverTrigger asChild>
									<div className="flex items-center gap-2 cursor-pointer hover:opacity-80">
										<CalendarIcon className="h-5 w-5" />
										<span>{date ? format(date, "PPP") : "Pick a date"}</span>
									</div>
								</PopoverTrigger>
								<PopoverContent className="w-auto p-0 bg-white">
									<CalendarComponent
										mode="single"
										selected={date}
										onSelect={setDate}
										initialFocus
									/>
								</PopoverContent>
							</Popover>

							<Popover>
								<PopoverTrigger asChild>
									<div className="flex items-center gap-2 cursor-pointer hover:opacity-80">
										<Clock className="h-5 w-5" />
										<span>{time || "Pick a time"}</span>
									</div>
								</PopoverTrigger>
								<PopoverContent className="w-auto p-0 bg-white">
									<TimePickerDemo selected={time} onTimeChange={setTime} />
								</PopoverContent>
							</Popover>
						</div> */}
					</div>
				</div>

				{/* Featured Image */}
				<div className="relative h-48 w-80 overflow-hidden rounded-2xl">
					<Image
						src="/dashboard/featured.png"
						alt="Hospital"
						fill
						className="object-cover"
					/>
				</div>
			</div>

			{/* Appointment List */}
			<div className="space-y-3">
				{appointments.map((appointment) => (
					<div
						key={appointment.id}
						className={`flex items-center justify-between rounded-lg p-4 ${
							appointment.id === "1"
								? "bg-[#FFF8F0]"
								: appointment.id === "2"
								? "bg-[#F0F9FF]"
								: "bg-[#FFF5F5]"
						}`}
					>
						<div className="flex items-center gap-3">
							<Avatar className="h-10 w-10">
								<AvatarImage
									src={appointment.doctorImage}
									alt={appointment.doctorName}
								/>
								<AvatarFallback>
									{appointment.doctorName
										.split(" ")
										.map((n) => n[0])
										.join("")}
								</AvatarFallback>
							</Avatar>
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
								{appointment.status === "upcoming"
									? "Join Now"
									: appointment.status === "available"
									? "Join"
									: "Joined"}
							</Button>
						</div>
					</div>
				))}
			</div>
		</div>
	);
}
