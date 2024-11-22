import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { MATCH_STATUS_OPTIONS } from "@/lib/constants";
import { Badge } from "@/components/ui/badge";

interface CaseCardProps {
	reportId: string;
	timestamp: string | null;
	typeOfIncident: string;
	description: string;
	requiredServices: string[];
	onDelete: (reportId: string) => void;
	formatServiceName?: (service: string) => string;
	onAcceptMatch?: (matchId: string) => void;
	matchedService?: {
		id: string;
		match_status_type: string;
		support_service?: {
			name: string;
			service_types: string;
		};
		appointment?: {
			date: string;
			status: string;
		};
	};
	matchStatus?: string;
}

export default function CaseCard({
	reportId,
	timestamp,
	typeOfIncident,
	description,
	requiredServices,
	onDelete,
	onAcceptMatch,
	matchedService,
	formatServiceName = (service) =>
		service
			.split("_")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" "),
}: CaseCardProps) {
	const getStatusColor = (status: string) => {
		switch (status) {
			case "pending":
				return "bg-yellow-100 text-yellow-800 hover:bg-yellow-100";
			case "accepted":
				return "bg-green-100 text-green-800 hover:bg-green-100";
			case "declined":
				return "bg-red-100 text-red-800 hover:bg-red-100";
			case "completed":
				return "bg-blue-100 text-blue-800 hover:bg-blue-100";
			case "cancelled":
				return "bg-gray-100 text-gray-800 hover:bg-gray-100";
			default:
				return "bg-gray-100 text-gray-800 hover:bg-gray-100";
		}
	};

	return (
		<div className="bg-card p-4 rounded-lg border shadow-sm">
			<div className="flex justify-between items-start">
				<div>
					<div className="flex items-center gap-2">
						<h3 className="font-semibold">Case #{reportId.slice(0, 8)}</h3>
					</div>
					<p className="text-sm text-muted-foreground">
						{timestamp && new Date(timestamp).toLocaleDateString()}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
						{typeOfIncident}
					</span>
					{matchedService?.match_status_type && (
						<Badge
							className={`text-xs ${getStatusColor(matchedService.match_status_type)}`}
						>
							{matchedService.match_status_type.charAt(0).toUpperCase() +
								matchedService.match_status_type.slice(1)}
						</Badge>
					)}
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
						onClick={() => onDelete(reportId)}
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>
			</div>
			<p className="mt-2 text-sm line-clamp-2">{description}</p>
			{requiredServices && (
				<div className="mt-2 flex flex-wrap gap-1">
					{Array.isArray(requiredServices) &&
						requiredServices.map((service: string, index: number) => (
							<span
								key={index}
								className="px-2 py-1 text-xs rounded-full bg-secondary text-secondary-foreground"
							>
								{formatServiceName(service)}
							</span>
						))}
				</div>
			)}

			{matchedService &&
				matchedService.match_status_type === "pending" &&
				onAcceptMatch && (
					<div className="mt-4">
						<Button
							variant="default"
							onClick={() => onAcceptMatch(matchedService.id)}
							className="w-full"
						>
							Accept Match & Set Appointment
						</Button>
					</div>
				)}

			{matchedService?.match_status_type === "accepted" && (
				<div className="mt-4 p-3 bg-secondary/20 rounded-md space-y-2">
					<div className="flex items-center justify-between">
						<p className="text-sm font-medium">
							Accepted by: {matchedService.support_service?.name}
						</p>
						<span className="text-xs text-muted-foreground">
							{matchedService.support_service?.service_types}
						</span>
					</div>
					{matchedService.appointment && (
						<div className="text-sm">
							<p>
								Appointment:{" "}
								{new Date(matchedService.appointment.date).toLocaleDateString()} at{" "}
								{new Date(matchedService.appointment.date).toLocaleTimeString()}
							</p>
							<p className="text-xs text-muted-foreground">
								Status: {matchedService.appointment.status.toUpperCase()}
							</p>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
