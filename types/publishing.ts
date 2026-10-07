/**
 * Hand-maintained row types for the publishing + coursework tables
 * (supabase/migrations/20261007_publishing_and_courses.sql).
 * Narrow (union-typed) views of rows in `types/db-schema.ts`, which is generated from the
 * database (the generated types only know these columns as `string`).
 */

export const PUBLICATION_KINDS = ["blog", "publication", "resource", "learn"] as const;
export type PublicationKind = (typeof PUBLICATION_KINDS)[number];

export const PUBLICATION_STATUSES = ["draft", "in_review", "published", "archived"] as const;
export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];

export interface ExternalLink {
	label: string;
	url: string;
}

export interface PublicationRow {
	id: string;
	slug: string;
	kind: PublicationKind;
	title: string;
	summary: string | null;
	body: string;
	cover_image_url: string | null;
	cover_image_alt: string | null;
	category: string | null;
	tags: string[];
	read_minutes: number | null;
	status: PublicationStatus;
	featured: boolean;
	author_id: string | null;
	published_by: string | null;
	published_at: string | null;
	source_file_url: string | null;
	source_file_name: string | null;
	source_file_type: string | null;
	external_links: ExternalLink[];
	preview_token: string;
	emailed_at: string | null;
	email_status: string | null;
	view_count: number;
	created_at: string;
	updated_at: string;
}

export const COURSE_LEVELS = ["beginner", "intermediate", "advanced"] as const;
export type CourseLevel = (typeof COURSE_LEVELS)[number];
export type CourseStatus = "draft" | "published" | "archived";

export interface CourseRow {
	id: string;
	slug: string;
	title: string;
	summary: string | null;
	description: string | null;
	cover_image_url: string | null;
	level: CourseLevel;
	estimated_minutes: number | null;
	status: CourseStatus;
	created_by: string | null;
	published_at: string | null;
	created_at: string;
	updated_at: string;
}

export interface CourseModuleRow {
	id: string;
	course_id: string;
	title: string;
	summary: string | null;
	position: number;
	created_at: string;
	updated_at: string;
}

export interface CourseLessonRow {
	id: string;
	module_id: string;
	course_id: string;
	title: string;
	content: string;
	video_url: string | null;
	estimated_minutes: number | null;
	position: number;
	created_at: string;
	updated_at: string;
}

export interface CourseEnrollmentRow {
	id: string;
	course_id: string;
	user_id: string;
	enrolled_at: string;
	last_lesson_id: string | null;
	last_active_at: string;
	completed_at: string | null;
}

export interface LessonProgressRow {
	id: string;
	user_id: string;
	course_id: string;
	lesson_id: string;
	completed_at: string;
}
