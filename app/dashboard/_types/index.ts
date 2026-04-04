import { Tables, Json } from "@/types/db-schema";

export interface MatchedServiceWithRelations extends Tables<"matched_services"> {
	report?: (Tables<"reports"> & { label?: string }) | null;
	service_details: Tables<"support_services"> | null;
    appointments?: AppointmentWithDetails[];
}

export interface ReportWithRelations extends Tables<"reports"> {
    updated_at?: string | null; // fallbacks to submission_timestamp if null
	matched_services?: MatchedServiceWithRelations[];
}

export interface AppointmentWithDetails {
	appointment_id: string;
	appointment_date: string | null;
	status: string | null;
    appointment_type: string | null;
    calendar_sync_status: string | null;
    created_at: string | null;
    created_via: string | null;
    duration_minutes: number | null;
    emergency_contact: string | null;
    google_calendar_event_id: string | null;
    matched_services: string | null;
    notes: string | null;
	professional_id?: string | null;
	survivor_id?: string | null;
	professional?: Tables<"profiles"> | null;
	survivor?: Tables<"profiles"> | null;
	matched_service?: {
		id: string;
		service_details: Tables<"support_services"> | null;
		report: Tables<"reports"> | null;
	} | null;

	meeting_link?: string;
}
