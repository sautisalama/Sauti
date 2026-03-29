import { Tables, Json } from "@/types/db-schema";

export interface MatchedServiceWithRelations {
	id: string;
	match_date: string | null;
	match_status_type: string | null;
	match_score?: number | null;
	completed_at?: string | null;
	notes?: string | null;
	survivor_id?: string | null;
    updated_at: string | null;
    chat_id: string | null;
    decline_reason: string | null;
    description: string | null;
    escalation_required: boolean | null;
    feedback: string | null;
    hrd_profile_id: string | null;
    match_reason: string | null;
    professional_accepted_at: string | null;
    proposed_meeting_times: Json | null;
    recommendations: Json | null;
    report_id: string | null;
    service_id: string | null;
    shared_from_match_id: string | null;
    support_service: string | null;
    survivor_accepted_at: string | null;
	report: (Tables<"reports"> & { label?: string }) | null;
	service_details: Tables<"support_services"> | null;
}



export interface ReportWithRelations extends Tables<"reports"> {
    updated_at?: string | null; // fallbacks to submission_timestamp if null
	matched_services?: {
		match_status_type: string | null;
		service_details: Tables<"support_services"> | null;
		appointments?: {
			appointment_date: string | null;
			status: string | null;
		}[];
	}[];
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
	matched_service: {
		id: string;
		service_details: Tables<"support_services"> | null;
		report: Tables<"reports"> | null;
	} | null;

	meeting_link?: string;
}
