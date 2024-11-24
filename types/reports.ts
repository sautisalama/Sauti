import { Database } from "./db-schema";

export type Report = Database["public"]["Tables"]["reports"]["Row"] & {
	matched_services?: Array<{
		id: string;
		match_status_type: Database["public"]["Enums"]["match_status_type"];
		support_services: {
			name: string;
			service_types: Database["public"]["Enums"]["support_service_type"];
		};
		appointments?: Array<{
			date: string;
			status: Database["public"]["Enums"]["appointment_status_type"] | null;
		}>;
	}>;
};

export type MatchedService =
	Database["public"]["Tables"]["matched_services"]["Row"] & {
		reports: Pick<
			Report,
			| "report_id"
			| "type_of_incident"
			| "incident_description"
			| "urgency"
			| "required_services"
			| "submission_timestamp"
		>;
		support_services: {
			name: string;
			service_types: Database["public"]["Enums"]["support_service_type"];
		};
		appointments?: Array<{
			date: string;
			status: Database["public"]["Enums"]["appointment_status_type"];
		}>;
	};
