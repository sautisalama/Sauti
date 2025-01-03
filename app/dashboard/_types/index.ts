import { Tables } from "@/types/db-schema";

export interface MatchedServiceWithRelations {
	id: string;
	match_date: string;
	match_status_type: string;
	report: Tables<"reports">;
	support_service: Tables<"support_services">;
}

export interface ReportWithRelations extends Tables<"reports"> {
	matched_services?: {
		match_status_type: string;
		support_service: Tables<"support_services">;
		appointments?: {
			appointment_date: string;
			status: string;
		}[];
	}[];
}

export interface AppointmentWithDetails {
	id: string;
	appointment_date: string;
	status: string;
	matched_service: {
		support_service: Tables<"support_services">;
	};
}
