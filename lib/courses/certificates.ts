import { randomBytes } from "node:crypto";
import { createAdminClient } from "@/utils/supabase/admin-client";

/** Readable and unambiguous: no 0/O, 1/I/L. */
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newCertificateNumber(date = new Date()): string {
	const bytes = randomBytes(8);
	let code = "";
	for (let i = 0; i < 8; i++) code += ALPHABET[bytes[i] % ALPHABET.length];
	return `SS-${date.getUTCFullYear()}-${code.slice(0, 4)}-${code.slice(4)}`;
}

export interface Certificate {
	number: string;
	learnerName: string;
	courseTitle: string;
	courseSlug: string | null;
	lessonsCompleted: number;
	issuedAt: string;
	/** The learner is anonymous: their certificate carries a private username, so it is not offered for sharing. */
	anonymous?: boolean;
}

/**
 * Issue (or return) a learner's certificate. The server checks the facts itself: the course must exist
 * and EVERY lesson must have a progress row for this user. Safe to call repeatedly: one per learner per
 * course, enforced by a unique constraint.
 */
export async function issueCertificate(courseId: string, userId: string): Promise<Certificate | null> {
	const admin = createAdminClient();
	const existing = await admin.from("course_certificates").select("*").eq("course_id", courseId).eq("user_id", userId).maybeSingle();
	const course = (await admin.from("courses").select("id, title, slug, status").eq("id", courseId).maybeSingle()).data;
	if (!course) return null;
	if (existing.data) return toCertificate(existing.data, course.slug);

	const [{ count: total }, { count: done }, profile] = await Promise.all([
		admin.from("course_lessons").select("id", { count: "exact", head: true }).eq("course_id", courseId),
		admin.from("lesson_progress").select("id", { count: "exact", head: true }).eq("course_id", courseId).eq("user_id", userId),
		admin.from("profiles").select("first_name, last_name, anon_username, is_anonymous").eq("id", userId).maybeSingle(),
	]);
	if (!total || (done ?? 0) < total) return null;

	const p = profile.data;
	// An anonymous learner's certificate carries their private username, never a name.
	const learnerName = p?.is_anonymous ? p.anon_username || "Anonymous learner" : `${p?.first_name ?? ""} ${p?.last_name ?? ""}`.trim() || "Sauti Salama learner";

	for (let attempt = 0; attempt < 3; attempt++) {
		const { data, error } = await admin
			.from("course_certificates")
			.insert({ certificate_number: newCertificateNumber(), course_id: courseId, user_id: userId, learner_name: learnerName, course_title: course.title, lessons_completed: done ?? total })
			.select("*")
			.single();
		if (data) return toCertificate(data, course.slug);
		// someone else issued it first (unique course/user) → read it; a number clash → retry
		const again = await admin.from("course_certificates").select("*").eq("course_id", courseId).eq("user_id", userId).maybeSingle();
		if (again.data) return toCertificate(again.data, course.slug);
		if (error && !/certificate_number/.test(error.message)) break;
	}
	return null;
}

/** Public lookup used by the verification page. Returns only what is printed on the certificate. */
export async function getCertificateByNumber(raw: string): Promise<Certificate | null> {
	const number = raw.trim().toUpperCase();
	if (!/^SS-\d{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(number)) return null;
	const admin = createAdminClient();
	const { data } = await admin.from("course_certificates").select("*").eq("certificate_number", number).maybeSingle();
	if (!data) return null;
	const [slug, owner] = await Promise.all([
		admin.from("courses").select("slug").eq("id", data.course_id).maybeSingle().then((r) => r.data?.slug ?? null),
		admin.from("profiles").select("is_anonymous").eq("id", data.user_id).maybeSingle().then((r) => !!r.data?.is_anonymous),
	]);
	return { ...toCertificate(data, slug), anonymous: owner };
}

function toCertificate(row: { certificate_number: string; learner_name: string; course_title: string; lessons_completed: number; issued_at: string }, slug: string | null): Certificate {
	return { number: row.certificate_number, learnerName: row.learner_name, courseTitle: row.course_title, courseSlug: slug, lessonsCompleted: row.lessons_completed, issuedAt: row.issued_at };
}
