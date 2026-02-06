// ... imports ...
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
	Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";

// ... Keep CaseCardData interface as is ...
export interface CaseCardData {
	id: string;
	match_date?: string | null;
	match_status_type?: string | null;
	match_status?: string | null; // fallback
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

function formatDate(d?: string | null) {
	if (!d) return "";
	try {
		const date = new Date(d);
		return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
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
	const hasAppointment = !!appointment?.appointment_date;
	const matchStatus = data.match_status_type || data.match_status || "pending";
	const isCompleted = "completed" === matchStatus?.toLowerCase();
	const hasUnreadMessages = (data.unread_messages || 0) > 0;
	
	const urgency = (data.report?.urgency || "low").toLowerCase();
	const urgencyColors = {
		high: "bg-red-50 text-red-700 border-red-200",
		medium: "bg-amber-50 text-amber-700 border-amber-200",
		low: "bg-blue-50 text-blue-700 border-blue-200"
	};


	return (
		<div
			role={onClick ? "button" : undefined}
			onClick={onClick}
			className={cn(
				"group relative w-full p-5 bg-white rounded-2xl border transition-all duration-300",
				"hover:shadow-lg hover:-translate-y-0.5 cursor-pointer overflow-hidden",
				active 
					? "border-blue-400 ring-4 ring-blue-50 shadow-md z-10" 
					: "border-gray-100 hover:border-blue-200 hover:shadow-blue-50/50",
				className
			)}
		>
			<div className="flex items-start justify-between gap-4 mb-4">
				<div className="flex items-center gap-4 min-w-0">
					<div className={cn(
						"h-12 w-12 rounded-2xl flex items-center justify-center shrink-0 shadow-sm border border-white transition-colors duration-300",
						urgency === 'high' ? "bg-red-50 text-red-600 group-hover:bg-red-100" : 
						urgency === 'medium' ? "bg-amber-50 text-amber-600 group-hover:bg-amber-100" : "bg-blue-50 text-blue-600 group-hover:bg-blue-100"
					)}>
						<Shield className="h-6 w-6" />
					</div>
					<div className="min-w-0 py-0.5">
						<div className="flex items-center gap-2 mb-1">
							<h3 className="font-bold text-gray-900 truncate text-base group-hover:text-blue-700 transition-colors">
								{data.report?.type_of_incident || "Case File"}
							</h3>
							{hasUnreadMessages && (
								<Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 border-0 h-5 px-1.5 text-[10px] font-bold">
									New
								</Badge>
							)}
						</div>
						<p className="text-xs text-gray-500 font-medium truncate flex items-center gap-1.5">
							<User className="h-3 w-3 text-gray-400" />
							{data.support_service?.name || "Unassigned"}
						</p>
					</div>
				</div>
				
				<Badge variant="outline" className={cn("capitalize font-bold border-0 px-2.5 py-1 rounded-lg text-[10px] tracking-wide", urgencyColors[urgency as keyof typeof urgencyColors])}>
					{urgency}
				</Badge>
			</div>

			<div className="pl-[64px]">
				<p className="text-sm text-gray-600 line-clamp-2 mb-4 leading-relaxed font-medium">
					{data.report?.incident_description || "No description available."}
				</p>

				<div className="flex items-center justify-between pt-2 border-t border-gray-50">
					<div className="flex items-center gap-2">
						<div className={cn(
							"px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider rounded-md border flex items-center gap-1.5",
							isCompleted ? "bg-green-50 text-green-700 border-green-200" : "bg-gray-50 text-gray-600 border-gray-200"
						)}>
							<div className={cn("w-1.5 h-1.5 rounded-full", isCompleted ? "bg-green-500" : "bg-gray-400")} />
							{matchStatus}
						</div>
						{hasAppointment && (
							<span className="text-[10px] font-bold text-blue-600 flex items-center gap-1.5 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-100">
								<CalendarDays className="h-3 w-3" />
								{formatDate(appointment.appointment_date)}
							</span>
						)}
					</div>
					
					{actions || (
						<div className="w-8 h-8 rounded-full flex items-center justify-center text-gray-300 group-hover:text-blue-600 group-hover:bg-blue-50 transition-all">
							<ChevronRight className="h-5 w-5" />
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
