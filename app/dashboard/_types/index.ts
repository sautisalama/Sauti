import { Tables } from "@/types/db-schema";

export interface MatchedServiceWithRelations {
	id: string;
	match_date: string | null;
	match_status_type: string | null;
	match_score?: number | null;
	completed_at?: string | null;
	notes?: string | null;
	survivor_id?: string | null;
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
		id: string;
		service_details: Tables<"support_services">;
		report: Tables<"reports">;
	};

	meeting_link?: string;
}
