// Admin system type definitions with enum types

export type VerificationStatus =
	| "pending"
	| "verified"
	| "rejected"
	| "under_review";
export type AdminActionType =
	| "verify_user"
	| "ban_user"
	| "verify_service"
	| "ban_service"
	| "unban_user"
	| "unban_service"
	| "reject_user"
	| "reject_service";
export type TargetType = "user" | "service";
export type StatType =
	| "user_counts"
	| "service_counts"
	| "verification_stats"
	| "coverage_map"
	| "initial_setup";

export interface AdminStats {
	total_survivors: number;
	total_professionals: number;
	total_ngos: number;
	total_admins: number;
	pending_verifications: number;
	verified_users: number;
	rejected_users: number;
	pending_service_verifications: number;
	active_services: number;
	rejected_services: number;
	banned_users: number;
	banned_services: number;
}

export interface PendingUser {
	id: string;
	first_name: string;
	last_name: string;
	user_type: "professional" | "ngo" | "survivor";
	verification_status: VerificationStatus;
	verification_notes?: string;
	accreditation_files_metadata?: any[];
	created_at: string;
	verification_updated_at: string;
}

export interface PendingService {
	id: string;
	name: string;
	service_types: string;
	verification_status: VerificationStatus;
	verification_notes?: string;
	accreditation_files_metadata?: any[];
	created_at: string;
	verification_updated_at: string;
	latitude?: number;
	longitude?: number;
	coverage_area_radius?: number;
}

export interface User {
	id: string;
	first_name: string;
	last_name: string;
	user_type: "professional" | "ngo" | "survivor";
	verification_status: VerificationStatus;
	is_banned: boolean;
	created_at: string;
	verification_updated_at: string;
	verification_notes?: string;
}

export interface Service {
	id: string;
	name: string;
	service_types: string;
	verification_status: VerificationStatus;
	is_active: boolean;
	is_banned: boolean;
	created_at: string;
	verification_updated_at: string;
	verification_notes?: string;
	latitude?: number;
	longitude?: number;
	coverage_area_radius?: number;
	profile_id: string;
	profile_name?: string;
}

export interface CoverageData {
	service_id: string;
	name: string;
	service_type: string;
	latitude: number;
	longitude: number;
	coverage_area_radius: number;
	verification_status: VerificationStatus;
	is_active: boolean;
}

export interface UserRoleContext {
	user_id: string;
	primary_role: "professional" | "ngo" | "survivor";
	is_admin: boolean;
	can_switch_to_admin: boolean;
}

export interface AdminAction {
	id: string;
	admin_id: string;
	action_type: AdminActionType;
	target_type: TargetType;
	target_id: string;
	details: any;
	created_at: string;
}

export interface VerificationRequest {
	targetType: TargetType;
	targetId: string;
	action: "verify" | "reject";
	notes?: string;
}

export interface BanRequest {
	targetType: TargetType;
	targetId: string;
	action: "ban" | "unban";
	reason?: string;
}
