"use server";

import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/utils/supabase/server";
import { sanitizeContent, slugify } from "@/lib/content/sanitize";
import type { Database } from "@/types/db-schema";
import { COURSE_LEVELS, type CourseLevel, type CourseStatus } from "@/types/publishing";

type Result<T = {}> = ({ ok: true } & T) | { ok: false; error: string };
type Db = SupabaseClient<Database>;

const refresh = (slug?: string) => {
	for (const p of ["/learn", "/learn/courses", "/dashboard/learning", "/dashboard/admin/courses"]) revalidatePath(p);
	if (slug) revalidatePath(`/learn/courses/${slug}`);
};

function cleanVideo(url: string | null | undefined): { url: string | null; error?: string } {
	const v = url?.trim();
	if (!v) return { url: null };
	try {
		const u = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
		if (!/(^|\.)youtube\.com$|(^|\.)youtu\.be$|(^|\.)vimeo\.com$/i.test(u.hostname)) {
			return { url: null, error: "Videos must be YouTube or Vimeo links." };
		}
		return { url: u.toString() };
	} catch {
		return { url: null, error: "That video link is not valid." };
	}
}

async function uniqueCourseSlug(db: Db, title: string, ignoreId?: string) {
	const base = slugify(title);
	const { data } = await db.from("courses").select("id, slug").like("slug", `${base}%`);
	const taken = new Set((data ?? []).filter((r) => r.id !== ignoreId).map((r) => r.slug));
	if (!taken.has(base)) return base;
	for (let i = 2; i < 200; i++) if (!taken.has(`${base}-${i}`)) return `${base}-${i}`;
	return `${base}-${Date.now().toString(36)}`;
}

// ───────────────────────── Admin: course builder ─────────────────────────

export interface CourseInput {
	id?: string;
	title: string;
	summary?: string | null;
	description?: string | null;
	cover_image_url?: string | null;
	level: CourseLevel;
	estimated_minutes?: number | null;
}

export async function saveCourse(input: CourseInput): Promise<Result<{ id: string; slug: string }>> {
	const auth = await requireAdmin();
	if (!auth.ok) return auth;
	const title = input.title?.trim() ?? "";
	if (title.length < 3) return { ok: false, error: "Give the course a title." };
	if (!COURSE_LEVELS.includes(input.level)) return { ok: false, error: "Choose a level." };
	const cover = input.cover_image_url?.trim() || null;
	if (cover && !(cover.startsWith("/") || /^https?:\/\//i.test(cover))) return { ok: false, error: "The cover image link must start with http:// or https://" };
	const minutes = input.estimated_minutes && input.estimated_minutes > 0 ? Math.min(Math.round(input.estimated_minutes), 100000) : null;

	const fields = {
		title,
		summary: input.summary?.trim() || null,
		description: sanitizeContent(input.description ?? ""),
		cover_image_url: cover,
		level: input.level,
		estimated_minutes: minutes,
	};

	if (input.id) {
		const { data, error } = await auth.supabase.from("courses").update(fields).eq("id", input.id).select("id, slug").maybeSingle();
		if (error) return { ok: false, error: error.message };
		if (!data) return { ok: false, error: "That course no longer exists." };
		refresh(data.slug);
		return { ok: true, id: data.id, slug: data.slug };
	}
	for (let i = 0; i < 3; i++) {
		const slug = await uniqueCourseSlug(auth.supabase, title);
		const { data, error } = await auth.supabase.from("courses").insert({ ...fields, slug, status: "draft", created_by: auth.user.id }).select("id, slug").single();
		if (error?.code === "23505") continue;
		if (error) return { ok: false, error: error.message };
		refresh();
		return { ok: true, id: data.id, slug: data.slug };
	}
	return { ok: false, error: "Could not create a unique link for this title." };
}

export async function setCourseStatus(id: string, status: CourseStatus): Promise<Result> {
	const auth = await requireAdmin();
	if (!auth.ok) return auth;
	if (status === "published") {
		const { count } = await auth.supabase.from("course_lessons").select("id", { count: "exact", head: true }).eq("course_id", id);
		if (!count) return { ok: false, error: "Add at least one lesson before publishing." };
	}
	const { data, error } = await auth.supabase.from("courses").update({ status }).eq("id", id).select("slug").maybeSingle();
	if (error) return { ok: false, error: error.message };
	if (!data) return { ok: false, error: "That course no longer exists." };
	refresh(data.slug);
	return { ok: true };
}

export async function deleteCourse(id: string): Promise<Result> {
	const auth = await requireAdmin();
	if (!auth.ok) return auth;
	const { error } = await auth.supabase.from("courses").delete().eq("id", id);
	if (error) return { ok: false, error: error.message };
	refresh();
	return { ok: true };
}

export async function saveModule(input: { id?: string; course_id: string; title: string; summary?: string | null }): Promise<Result<{ id: string }>> {
	const auth = await requireAdmin();
	if (!auth.ok) return auth;
	const title = input.title?.trim() ?? "";
	if (!title) return { ok: false, error: "Give the module a title." };
	if (input.id) {
		const { error } = await auth.supabase.from("course_modules").update({ title, summary: input.summary?.trim() || null }).eq("id", input.id);
		if (error) return { ok: false, error: error.message };
		refresh();
		return { ok: true, id: input.id };
	}
	const { data: last } = await auth.supabase.from("course_modules").select("position").eq("course_id", input.course_id).order("position", { ascending: false }).limit(1).maybeSingle();
	const { data, error } = await auth.supabase.from("course_modules").insert({ course_id: input.course_id, title, summary: input.summary?.trim() || null, position: (last?.position ?? -1) + 1 }).select("id").single();
	if (error) return { ok: false, error: error.message };
	refresh();
	return { ok: true, id: data.id };
}

export async function deleteModule(id: string): Promise<Result> {
	const auth = await requireAdmin();
	if (!auth.ok) return auth;
	const { error } = await auth.supabase.from("course_modules").delete().eq("id", id);
	if (error) return { ok: false, error: error.message };
	refresh();
	return { ok: true };
}

export async function saveLesson(input: {
	id?: string;
	module_id: string;
	title: string;
	content: string;
	video_url?: string | null;
	estimated_minutes?: number | null;
}): Promise<Result<{ id: string }>> {
	const auth = await requireAdmin();
	if (!auth.ok) return auth;
	const title = input.title?.trim() ?? "";
	if (!title) return { ok: false, error: "Give the lesson a title." };
	const video = cleanVideo(input.video_url);
	if (video.error) return { ok: false, error: video.error };
	const fields = {
		title,
		content: sanitizeContent(input.content ?? ""),
		video_url: video.url,
		estimated_minutes: input.estimated_minutes && input.estimated_minutes > 0 ? Math.min(Math.round(input.estimated_minutes), 10000) : null,
	};
	if (input.id) {
		const { error } = await auth.supabase.from("course_lessons").update(fields).eq("id", input.id);
		if (error) return { ok: false, error: error.message };
		refresh();
		return { ok: true, id: input.id };
	}
	const { data: mod } = await auth.supabase.from("course_modules").select("course_id").eq("id", input.module_id).maybeSingle();
	if (!mod) return { ok: false, error: "That module no longer exists." };
	const { data: last } = await auth.supabase.from("course_lessons").select("position").eq("module_id", input.module_id).order("position", { ascending: false }).limit(1).maybeSingle();
	const { data, error } = await auth.supabase.from("course_lessons").insert({ ...fields, module_id: input.module_id, course_id: mod.course_id, position: (last?.position ?? -1) + 1 }).select("id").single();
	if (error) return { ok: false, error: error.message };
	refresh();
	return { ok: true, id: data.id };
}

export async function deleteLesson(id: string): Promise<Result> {
	const auth = await requireAdmin();
	if (!auth.ok) return auth;
	const { error } = await auth.supabase.from("course_lessons").delete().eq("id", id);
	if (error) return { ok: false, error: error.message };
	refresh();
	return { ok: true };
}

/** Swap an item with its neighbour. Rows are re-numbered 0..n so positions never collide. */
export async function moveItem(table: "course_modules" | "course_lessons", id: string, direction: "up" | "down"): Promise<Result> {
	const auth = await requireAdmin();
	if (!auth.ok) return auth;
	const parentCol = table === "course_modules" ? "course_id" : "module_id";
	// Generic over two similarly-shaped tables, so type the dynamic column access loosely.
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	const db = auth.supabase as unknown as SupabaseClient<any>;
	const { data: row } = await db.from(table).select("*").eq("id", id).maybeSingle();
	if (!row) return { ok: false, error: "Not found." };
	const parentId = row[parentCol] as string;
	const { data: siblings } = await db.from(table).select("id, position").eq(parentCol, parentId).order("position").order("created_at");
	const list = siblings ?? [];
	const i = list.findIndex((s) => s.id === id);
	const j = direction === "up" ? i - 1 : i + 1;
	if (i < 0 || j < 0 || j >= list.length) return { ok: true };
	[list[i], list[j]] = [list[j], list[i]];
	for (let k = 0; k < list.length; k++) {
		if (list[k].position !== k) {
			const { error } = await db.from(table).update({ position: k }).eq("id", list[k].id);
			if (error) return { ok: false, error: error.message };
		}
	}
	refresh();
	return { ok: true };
}

// ───────────────────────── Learner actions ─────────────────────────

async function currentUser() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	return { supabase, user };
}

export async function enrollInCourse(courseId: string): Promise<Result> {
	const { supabase, user } = await currentUser();
	if (!user) return { ok: false, error: "Please sign in to start this course." };
	const { data: course } = await supabase.from("courses").select("id, slug, status").eq("id", courseId).maybeSingle();
	if (!course || course.status !== "published") return { ok: false, error: "This course is not available." };
	const { error } = await supabase.from("course_enrollments").upsert({ course_id: courseId, user_id: user.id }, { onConflict: "course_id,user_id", ignoreDuplicates: true });
	if (error) return { ok: false, error: error.message };
	refresh(course.slug);
	return { ok: true };
}

/** Mark a lesson done (or undo). Marks the course complete when every lesson is done. */
export async function setLessonComplete(lessonId: string, done: boolean): Promise<Result<{ completedCourse: boolean; completed: number; total: number }>> {
	const { supabase, user } = await currentUser();
	if (!user) return { ok: false, error: "Please sign in." };

	const { data: lesson } = await supabase.from("course_lessons").select("id, course_id").eq("id", lessonId).maybeSingle();
	if (!lesson) return { ok: false, error: "That lesson is not available." };

	// Opening a lesson enrols you implicitly; progress is always tied to an enrolment.
	await supabase.from("course_enrollments").upsert({ course_id: lesson.course_id, user_id: user.id }, { onConflict: "course_id,user_id", ignoreDuplicates: true });

	if (done) {
		const { error } = await supabase.from("lesson_progress").upsert({ user_id: user.id, course_id: lesson.course_id, lesson_id: lessonId }, { onConflict: "user_id,lesson_id", ignoreDuplicates: true });
		if (error) return { ok: false, error: error.message };
	} else {
		const { error } = await supabase.from("lesson_progress").delete().eq("user_id", user.id).eq("lesson_id", lessonId);
		if (error) return { ok: false, error: error.message };
	}

	const [{ count: total }, { count: completed }] = await Promise.all([
		supabase.from("course_lessons").select("id", { count: "exact", head: true }).eq("course_id", lesson.course_id),
		supabase.from("lesson_progress").select("id", { count: "exact", head: true }).eq("user_id", user.id).eq("course_id", lesson.course_id),
	]);
	const t = total ?? 0;
	const c = completed ?? 0;
	const finished = t > 0 && c >= t;
	await supabase
		.from("course_enrollments")
		.update({ last_lesson_id: lessonId, last_active_at: new Date().toISOString(), completed_at: finished ? new Date().toISOString() : null })
		.eq("course_id", lesson.course_id)
		.eq("user_id", user.id);

	refresh();
	return { ok: true, completedCourse: finished, completed: c, total: t };
}

/** Remember where the learner was, so "Continue" resumes there. */
export async function recordLessonVisit(lessonId: string): Promise<void> {
	const { supabase, user } = await currentUser();
	if (!user) return;
	const { data: lesson } = await supabase.from("course_lessons").select("course_id").eq("id", lessonId).maybeSingle();
	if (!lesson) return;
	await supabase.from("course_enrollments").upsert({ course_id: lesson.course_id, user_id: user.id, last_lesson_id: lessonId, last_active_at: new Date().toISOString() }, { onConflict: "course_id,user_id" });
}
