import { Tables } from "@/types/db-schema";

export interface MatchedServiceWithRelations {
	id: string;
	match_date: string;
	match_status_type: string;
	report: Tables<"reports">;
	service_details: Tables<"support_services">;
}

export interface ReportWithRelations extends Tables<"reports"> {
	matched_services?: {
		match_status_type: string;
		service_details: Tables<"support_services">;
		appointments?: {
			appointment_date: string;
			status: string;
		}[];
	}[];
}

export interface AppointmentWithDetails {
	appointment_id: string;
	id: string;
	appointment_date: string;
	status: string;
	professional_id?: string;
	survivor_id?: string;
	professional?: Tables<"profiles">;
	survivor?: Tables<"profiles">;
	notes?: string;
	matched_service: {
		service_details: Tables<"support_services">;
		report: Tables<"reports">;
	};
	meeting_link?: string;
}
