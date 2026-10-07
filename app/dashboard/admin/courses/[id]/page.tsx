import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { SereneBreadcrumb } from "@/components/ui/SereneBreadcrumb";
import { CourseBuilder } from "@/components/courses/CourseBuilder";
import type { CourseLessonRow, CourseModuleRow, CourseRow } from "@/types/publishing";

export const metadata = { title: "Edit course" };

export default async function EditCoursePage({ params }: { params: Promise<{ id: string }> }) {
	const auth = await requireAdmin();
	if (!auth.ok) redirect("/dashboard");
	const { id } = await params;
	if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

	const [{ data: course }, { data: modules }, { data: lessons }, { count }] = await Promise.all([
		auth.supabase.from("courses").select("*").eq("id", id).maybeSingle(),
		auth.supabase.from("course_modules").select("*").eq("course_id", id).order("position"),
		auth.supabase.from("course_lessons").select("*").eq("course_id", id).order("position"),
		auth.supabase.from("course_enrollments").select("id", { count: "exact", head: true }).eq("course_id", id),
	]);
	if (!course) notFound();

	const byModule = new Map<string, CourseLessonRow[]>();
	for (const l of (lessons ?? []) as CourseLessonRow[]) byModule.set(l.module_id, [...(byModule.get(l.module_id) ?? []), l]);
	const data = {
		course: course as unknown as CourseRow,
		modules: ((modules ?? []) as CourseModuleRow[]).map((m) => ({ ...m, lessons: byModule.get(m.id) ?? [] })),
		learners: count ?? 0,
	};

	return (
		<div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
			<SereneBreadcrumb items={[{ label: "Admin", href: "/dashboard/admin" }, { label: "Courses", href: "/dashboard/admin/courses" }, { label: data.course.title, active: true }]} />
			<CourseBuilder data={data} />
		</div>
	);
}
