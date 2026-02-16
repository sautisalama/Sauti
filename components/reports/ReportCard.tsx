"use client";

import {
	CalendarDays,
	ChevronRight,
	Mic,
	Clock,
	User,
	Shield,
	CheckCircle2,
	AlertCircle,
	XCircle,
	MoreHorizontal,
	FileText,
	Phone,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo } from "react";

// Minimal report shape for the card. Nested types are intentionally loose to support
// both master-detail and list usages without over-constraining.
export interface ReportCardData {
	report_id: string;
	type_of_incident?: string | null;
	incident_description?: string | null;
	submission_timestamp?: string | null;
	urgency?: string | null;
	is_onBehalf?: boolean | null;
	media?: { url?: string; type?: string; size?: number } | null;
	matched_services?: Array<{
		match_status_type?: string;
		service_details?: { name?: string | null } | null;
		appointments?: Array<{
			appointment_date: string;
			status: string;
			professional?: {
				first_name?: string | null;
				last_name?: string | null;
			} | null;
		}>;
	}>;
}

interface ReportCardProps {
	data: ReportCardData;
	onClick?: () => void;
	active?: boolean;
	actions?: React.ReactNode; // Optional trailing actions (e.g., kebab menu)
	className?: string;
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

function getMatchStatusColor(matchStatus?: string) {
	switch (matchStatus?.toLowerCase()) {
		case "matched":
		case "confirmed":
			return "bg-green-50 text-green-700 border-green-200";
		case "pending":
			return "bg-amber-50 text-amber-700 border-amber-200";
		case "rejected":
			return "bg-red-50 text-red-700 border-red-200";
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

export function ReportCard({
	data,
	onClick,
	active,
	actions,
	className,
}: ReportCardProps) {
	const mostRecentMatch = data.matched_services?.[0];
	const matchLabel =
		mostRecentMatch?.service_details?.name || mostRecentMatch?.match_status_type;
	const appointment = mostRecentMatch?.appointments?.[0];
	const professional = appointment?.professional;
	const hasMedia = !!data.media?.url;
	const hasAppointment = !!appointment?.appointment_date;
	const hasMatch = !!mostRecentMatch;

	const avatarChar = useMemo(
		() => (data.type_of_incident || "?").charAt(0).toUpperCase(),
		[data.type_of_incident]
	);

	const urgencyLevel = (data.urgency || "low").toLowerCase();
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
				active && "ring-1 ring-blue-300 shadow-sm shadow-blue-100/50 bg-blue-50/30",
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
					urgencyAccent(data.urgency)
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
									hasAppointment && "bg-green-500",
									hasMatch && !hasAppointment && "bg-amber-500",
									!hasMatch && "bg-gray-400"
								)}
							>
								{hasAppointment && <CheckCircle2 className="h-2 w-2 text-white" />}
								{hasMatch && !hasAppointment && (
									<Clock className="h-2 w-2 text-white" />
								)}
								{!hasMatch && <AlertCircle className="h-2 w-2 text-white" />}
							</div>
						</div>

						{/* Main content */}
						<div className="min-w-0 flex-1">
							{/* On behalf indicator */}
							{data.is_onBehalf && (
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
										{data.type_of_incident || "Unknown Incident"}
									</h3>
									<span className="text-xs text-gray-500 font-mono whitespace-nowrap">
										{formatDate(data.submission_timestamp)}
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

							{/* Description */}
							{data.incident_description && (
								<p className="text-xs text-gray-600 line-clamp-1 leading-relaxed mb-2">
									{data.incident_description}
								</p>
							)}

							{/* Tags and metadata */}
							<div className="flex flex-wrap items-center gap-1.5">
								{/* Urgency badge */}
								<span
									className={cn(
										"inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium",
										urgencyChip(data.urgency)
									)}
								>
									<div
										className={cn(
											"w-1 h-1 rounded-full",
											isHighUrgency && "bg-red-500",
											isMediumUrgency && "bg-amber-500",
											!isHighUrgency && !isMediumUrgency && "bg-blue-500"
										)}
									/>
									{data.urgency || "low"}
								</span>

								{/* Media indicator */}
								{hasMedia && (
									<span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-purple-50 text-purple-700">
										<Mic className="h-2.5 w-2.5" />
										Voice
									</span>
								)}

								{/* Match status */}
								{hasMatch && (
									<span
										className={cn(
											"inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium",
											getMatchStatusColor(mostRecentMatch?.match_status_type)
										)}
									>
										<User className="h-2.5 w-2.5" />
										{matchLabel}
									</span>
								)}
							</div>
						</div>
					</div>
				</div>

				{/* Footer with appointment info */}
				{hasAppointment && (
					<div className="flex items-center justify-end pt-2 border-t border-gray-100">
						<div className="flex items-center gap-1 text-xs text-gray-600">
							<CalendarDays className="h-3 w-3" />
							<span className="font-medium">
								{formatDate(appointment.appointment_date)}
							</span>
							<div className="flex items-center gap-1">
								{getStatusIcon(appointment.status)}
								<span className="capitalize text-xs">{appointment.status}</span>
							</div>
						</div>
					</div>
				)}
			</div>
		</div>
	);
}
