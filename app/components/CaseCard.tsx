import { Button } from "@/components/ui/button";
import { Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Database } from "@/types/db-schema";
import { Report, MatchedService } from "@/types/reports";

type BaseProps = {
	reportId: string;
	timestamp: string | null;
	typeOfIncident: Database["public"]["Enums"]["incident_type"] | null;
	description: string | null;
	requiredServices: Database["public"]["Enums"]["support_service_type"][] | null;
	onDelete: (reportId: string) => void;
	formatServiceName?: (service: string) => string;
};

type MatchedServiceDetails = {
	id: string;
	match_status_type: Database["public"]["Enums"]["match_status_type"] | null;
	support_service: {
		name: string;
		service_types: Database["public"]["Enums"]["support_service_type"];
	};
	appointment?: {
		date: string;
		status: Database["public"]["Enums"]["appointment_status_type"] | null;
	};
};

type ProfessionalProps = BaseProps & {
	variant: "professional";
	onAcceptMatch: (matchId: string) => void;
	matchedService?: MatchedServiceDetails;
};

type SurvivorProps = BaseProps & {
	variant: "survivor";
	matchStatus?: Database["public"]["Enums"]["match_status_type"] | null;
	matchedService?: Omit<MatchedServiceDetails, "id" | "match_status_type">;
};

export type CaseCardProps = ProfessionalProps | SurvivorProps;

export default function CaseCard(props: CaseCardProps) {
	const formatServiceName =
		props.formatServiceName ||
		((service: string) =>
			service
				.split("_")
				.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
				.join(" "));

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

	const renderStatus = () => {
		if (props.variant === "survivor" && props.matchStatus) {
			return (
				<Badge className={`text-xs ${getStatusColor(props.matchStatus)}`}>
					{props.matchStatus.charAt(0).toUpperCase() + props.matchStatus.slice(1)}
				</Badge>
			);
		}

		if (
			props.variant === "professional" &&
			props.matchedService?.match_status_type
		) {
			return (
				<Badge
					className={`text-xs ${getStatusColor(
						props.matchedService.match_status_type
					)}`}
				>
					{props.matchedService.match_status_type.charAt(0).toUpperCase() +
						props.matchedService.match_status_type.slice(1)}
				</Badge>
			);
		}

		return null;
	};

	const renderMatchedServiceDetails = () => {
		if (props.variant !== "professional" || !props.matchedService) return null;

		if (props.matchedService.match_status_type === "pending") {
			return (
				<div className="mt-4">
					<Button
						variant="default"
						onClick={() => props.onAcceptMatch(props.matchedService!.id)}
						className="w-full"
					>
						Accept Match & Set Appointment
					</Button>
				</div>
			);
		}

		if (props.matchedService.match_status_type === "accepted") {
			return (
				<div className="mt-4 p-3 bg-secondary/20 rounded-md space-y-2">
					<div className="flex items-center justify-between">
						<p className="text-sm font-medium">
							Accepted by: {props.matchedService.support_service?.name}
						</p>
						<span className="text-xs text-muted-foreground">
							{props.matchedService.support_service?.service_types}
						</span>
					</div>
					{props.matchedService.appointment && (
						<div className="text-sm">
							<p>
								Appointment:{" "}
								{new Date(props.matchedService.appointment.date).toLocaleDateString()}{" "}
								at{" "}
								{new Date(props.matchedService.appointment.date).toLocaleTimeString()}
							</p>
							<p className="text-xs text-muted-foreground">
								Status: {props.matchedService.appointment?.status?.toUpperCase()}
							</p>
						</div>
					)}
				</div>
			);
		}

		return null;
	};

	const renderSurvivorMatchDetails = () => {
		if (props.variant !== "survivor" || !props.matchedService) return null;

		if (props.matchStatus === "accepted") {
			return (
				<div className="mt-4 p-3 bg-secondary/20 rounded-md space-y-2">
					<div className="flex items-center justify-between">
						<p className="text-sm font-medium">
							Matched with: {props.matchedService.support_service?.name}
						</p>
						<span className="text-xs text-muted-foreground">
							{props.matchedService.support_service?.service_types}
						</span>
					</div>
					{props.matchedService.appointment && (
						<div className="text-sm">
							<p>
								Appointment:{" "}
								{new Date(props.matchedService.appointment.date).toLocaleDateString()}{" "}
								at{" "}
								{new Date(props.matchedService.appointment.date).toLocaleTimeString()}
							</p>
							<p className="text-xs text-muted-foreground">
								Status: {props.matchedService.appointment?.status?.toUpperCase()}
							</p>
						</div>
					)}
				</div>
			);
		}

		return null;
	};

	return (
		<div className="bg-card p-4 rounded-lg border shadow-sm">
			<div className="flex justify-between items-start">
				<div>
					<div className="flex items-center gap-2">
						<h3 className="font-semibold">Case #{props.reportId.slice(0, 8)}</h3>
					</div>
					<p className="text-sm text-muted-foreground">
						{props.timestamp && new Date(props.timestamp).toLocaleDateString()}
					</p>
				</div>
				<div className="flex items-center gap-2">
					<span className="px-2 py-1 text-xs rounded-full bg-primary/10 text-primary">
						{props.typeOfIncident}
					</span>
					{renderStatus()}
					<Button
						variant="ghost"
						size="icon"
						className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
						onClick={() => props.onDelete(props.reportId)}
					>
						<Trash2 className="h-4 w-4" />
					</Button>
				</div>
			</div>
			<p className="mt-2 text-sm line-clamp-2">{props.description}</p>
			{props.requiredServices && (
				<div className="mt-2 flex flex-wrap gap-1">
					{Array.isArray(props.requiredServices) &&
						props.requiredServices.map((service: string, index: number) => (
							<span
								key={index}
								className="px-2 py-1 text-xs rounded-full bg-secondary text-secondary-foreground"
							>
								{formatServiceName(service)}
							</span>
						))}
				</div>
			)}

			{props.variant === "survivor"
				? renderSurvivorMatchDetails()
				: renderMatchedServiceDetails()}
		</div>
	);
}
