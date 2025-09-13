"use client";

import {
	CalendarDays,
	ChevronRight,
	Clock,
	User,
	CheckCircle2,
	AlertCircle,
	XCircle,
	FileText,
	Phone,
	Mail,
	MessageCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

// Minimal case shape for the card
export interface CaseCardData {
	id: string;
	match_date?: string | null;
	match_status_type?: string | null;
	match_score?: number | null;
	notes?: string | null;
	completed_at?: string | null;
	unread_messages?: number;
	report?: {
		report_id: string;
		type_of_incident?: string | null;
		incident_description?: string | null;
		submission_timestamp?: string | null;
		urgency?: string | null;
		is_onBehalf?: boolean | null;
		media?: { url?: string; type?: string; size?: number } | null;
	} | null;
	support_service?: {
		id: string;
		name?: string | null;
		phone_number?: string | null;
		email?: string | null;
	} | null;
	appointments?: Array<{
		id: string;
		appointment_id: string;
		appointment_date: string;
		status: string;
		professional?: {
			first_name?: string | null;
			last_name?: string | null;
		} | null;
	}>;
}

interface CaseCardProps {
	data: CaseCardData;
	onClick?: () => void;
	active?: boolean;
	actions?: React.ReactNode;
	className?: string;
	isLoadingMessages?: boolean;
}

function urgencyAccent(urgency?: string | null) {
	switch ((urgency || "").toLowerCase()) {
		case "high":
			return "bg-red-500";
		case "medium":
			return "bg-amber-500";
		default:
			return "bg-sky-500";
	}
}

function urgencyChip(urgency?: string | null) {
	switch ((urgency || "").toLowerCase()) {
		case "high":
			return "bg-red-50 text-red-700 border-red-200";
		case "medium":
			return "bg-amber-50 text-amber-700 border-amber-200";
		default:
			return "bg-blue-50 text-blue-700 border-blue-200";
	}
}

function getStatusIcon(status?: string) {
	switch (status?.toLowerCase()) {
		case "confirmed":
		case "completed":
			return <CheckCircle2 className="h-3 w-3 text-green-600" />;
		case "pending":
			return <Clock className="h-3 w-3 text-amber-600" />;
		case "cancelled":
			return <XCircle className="h-3 w-3 text-red-600" />;
		default:
			return <AlertCircle className="h-3 w-3 text-gray-600" />;
	}
}

function getMatchStatusColor(matchStatus?: string | null) {
	switch (matchStatus?.toLowerCase()) {
		case "matched":
		case "confirmed":
		case "accepted":
			return "bg-green-50 text-green-700 border-green-200";
		case "completed":
			return "bg-emerald-50 text-emerald-700 border-emerald-200";
		case "pending":
			return "bg-amber-50 text-amber-700 border-amber-200";
		case "rejected":
		case "declined":
			return "bg-red-50 text-red-700 border-red-200";
		case "cancelled":
			return "bg-gray-50 text-gray-700 border-gray-200";
		default:
			return "bg-gray-50 text-gray-700 border-gray-200";
	}
}

function formatDate(d?: string | null) {
	if (!d) return "";
	try {
		const date = new Date(d);
		const now = new Date();
		const diffTime = Math.abs(now.getTime() - date.getTime());
		const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
		const diffHours = Math.ceil(diffTime / (1000 * 60 * 60));
		const diffMinutes = Math.ceil(diffTime / (1000 * 60));

		// Show relative time with actual time
		let relativeTime = "";
		if (diffMinutes < 60) {
			relativeTime = diffMinutes <= 1 ? "Just now" : `${diffMinutes}m ago`;
		} else if (diffHours < 24) {
			relativeTime = `${diffHours}h ago`;
		} else if (diffDays === 1) {
			relativeTime = "Yesterday";
		} else if (diffDays < 7) {
			relativeTime = `${diffDays}d ago`;
		} else if (diffDays < 30) {
			relativeTime = `${Math.ceil(diffDays / 7)}w ago`;
		} else {
			relativeTime = `${Math.ceil(diffDays / 30)}mo ago`;
		}

		// Format actual time
		const actualTime = date.toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
		const actualDate = date.toLocaleDateString([], {
			month: "short",
			day: "numeric",
		});

		return `${relativeTime} • ${actualDate} ${actualTime}`;
	} catch {
		return String(d);
	}
}

function formatTime(d?: string | null) {
	if (!d) return "";
	try {
		return new Date(d).toLocaleTimeString([], {
			hour: "2-digit",
			minute: "2-digit",
		});
	} catch {
		return "";
	}
}

export function CaseCard({
	data,
	onClick,
	active,
	actions,
	className,
	isLoadingMessages = false,
}: CaseCardProps) {
	const appointment = data.appointments?.[0];
	const professional = appointment?.professional;
	const hasMedia = !!data.report?.media?.url;
	const hasAppointment = !!appointment?.appointment_date;
	const hasMatch = !!data.match_status_type;
	const isCompleted = data.match_status_type === "completed";
	const hasUnreadMessages = (data.unread_messages || 0) > 0;

	const avatarChar = useMemo(
		() => (data.report?.type_of_incident || "?").charAt(0).toUpperCase(),
		[data.report?.type_of_incident]
	);

	const urgencyLevel = (data.report?.urgency || "low").toLowerCase();
	const isHighUrgency = urgencyLevel === "high";
	const isMediumUrgency = urgencyLevel === "medium";

	return (
		<div
			role={onClick ? "button" : undefined}
			tabIndex={onClick ? 0 : -1}
			onClick={onClick}
			className={cn(
				"group relative w-full rounded-lg border bg-white transition-all duration-200",
				"hover:shadow-md hover:shadow-black/5 hover:-translate-y-0.5",
				"focus:outline-none focus:ring-2 focus:ring-[#1A3434]/20",
				active && "ring-2 ring-[#1A3434] shadow-md shadow-[#1A3434]/10",
				isHighUrgency && "border-red-200 hover:border-red-300",
				isMediumUrgency && "border-amber-200 hover:border-amber-300",
				!isHighUrgency &&
					!isMediumUrgency &&
					"border-gray-200 hover:border-gray-300",
				className
			)}
		>
			{/* Left color accent */}
			<div
				className={cn(
					"absolute left-0 top-0 h-full w-1 rounded-l-lg",
					urgencyAccent(data.report?.urgency)
				)}
			/>

			<div className="p-3">
				{/* Header */}
				<div className="flex items-start justify-between gap-2 mb-2">
					<div className="flex items-start gap-2 min-w-0 flex-1">
						{/* Avatar with status indicator */}
						<div className="relative">
							<div
								className={cn(
									"h-8 w-8 rounded-lg flex items-center justify-center text-white font-semibold text-xs",
									isHighUrgency && "bg-red-100 text-red-700",
									isMediumUrgency && "bg-amber-100 text-amber-700",
									!isHighUrgency && !isMediumUrgency && "bg-blue-100 text-blue-700"
								)}
							>
								{avatarChar}
							</div>
							{/* Status indicator dot */}
							<div
								className={cn(
									"absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full border border-white flex items-center justify-center",
									isCompleted && "bg-green-500",
									hasAppointment && !isCompleted && "bg-blue-500",
									hasMatch && !hasAppointment && !isCompleted && "bg-amber-500",
									!hasMatch && "bg-gray-400"
								)}
							>
								{isCompleted && <CheckCircle2 className="h-2 w-2 text-white" />}
								{hasAppointment && !isCompleted && (
									<CalendarDays className="h-2 w-2 text-white" />
								)}
								{hasMatch && !hasAppointment && !isCompleted && (
									<Clock className="h-2 w-2 text-white" />
								)}
								{!hasMatch && <AlertCircle className="h-2 w-2 text-white" />}
							</div>
						</div>

						{/* Main content */}
						<div className="min-w-0 flex-1">
							{/* On behalf indicator */}
							{data.report?.is_onBehalf && (
								<div className="mb-2">
									<span className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium bg-purple-50 text-purple-700 border border-purple-200">
										<User className="h-3 w-3" />
										On behalf of someone
									</span>
								</div>
							)}
							<div className="flex items-start justify-between gap-2 mb-1">
								<div className="flex items-center gap-2 min-w-0 flex-1">
									<h3 className="font-medium text-gray-900 text-sm leading-tight">
										{data.report?.type_of_incident || "Unknown Incident"}
									</h3>
									<span className="text-xs text-gray-500 font-mono whitespace-nowrap">
										{formatDate(data.match_date || undefined)}
									</span>
								</div>
								<div className="flex items-center gap-1">
									{actions}
									{onClick && (
										<ChevronRight className="h-3 w-3 text-gray-400 group-hover:text-gray-600 transition-colors" />
									)}
								</div>
							</div>

							{/* Professional info */}
							{professional && (
								<p className="text-xs text-gray-600 mb-1">
									Handled by: {professional.first_name} {professional.last_name}
								</p>
							)}

							{/* Description preview */}
							{data.report?.incident_description && (
								<p className="text-xs text-gray-600 leading-relaxed line-clamp-2 mb-2">
									{data.report.incident_description}
								</p>
							)}

							{/* Bottom row with status and service info */}
							<div className="flex items-center justify-between gap-2">
								<div className="flex items-center gap-2 min-w-0 flex-1">
									{/* Urgency chip */}
									<span
										className={`px-2 py-0.5 rounded-md text-xs font-medium border ${urgencyChip(
											data.report?.urgency
										)}`}
									>
										{data.report?.urgency || "low"}
									</span>

									{/* Match status */}
									<span
										className={`px-2 py-0.5 rounded-md text-xs font-medium border ${getMatchStatusColor(
											data.match_status_type
										)}`}
									>
										{data.match_status_type || "pending"}
									</span>

									{/* Completion status */}
									{isCompleted && (
										<span className="px-2 py-0.5 rounded-md text-xs font-medium border bg-green-50 text-green-700 border-green-200">
											Completed
										</span>
									)}

									{/* Service name */}
									{data.support_service?.name && (
										<span className="text-xs text-gray-500 truncate">
											{data.support_service.name}
										</span>
									)}
								</div>

								<div className="flex items-center gap-1">
									{/* Unread messages indicator */}
									{isLoadingMessages ? (
										<div className="flex items-center gap-1 text-xs text-gray-500">
											<Clock className="h-3 w-3 animate-spin" />
											<span className="font-medium">Loading...</span>
										</div>
									) : hasUnreadMessages ? (
										<div className="flex items-center gap-1 text-xs text-blue-600">
											<MessageCircle className="h-3 w-3" />
											<span className="font-medium">{data.unread_messages}</span>
										</div>
									) : null}

									{/* Media indicator */}
									{hasMedia && (
										<div className="flex items-center gap-1 text-xs text-gray-500">
											<FileText className="h-3 w-3" />
										</div>
									)}
								</div>
							</div>

							{/* Appointment info */}
							{appointment && (
								<div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
									<CalendarDays className="h-3 w-3" />
									<span>Appointment: {formatDate(appointment.appointment_date)}</span>
									<div className="flex items-center gap-1">
										{getStatusIcon(appointment.status)}
										<span className="capitalize">{appointment.status}</span>
									</div>
								</div>
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
}
