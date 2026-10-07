import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap, Plus } from "lucide-react";
import { requireAdmin } from "@/lib/auth/require-admin";
import { SereneBreadcrumb } from "@/components/ui/SereneBreadcrumb";
import { cn } from "@/lib/utils";

export const metadata = { title: "Courses" };

const BADGE: Record<string, string> = {
	draft: "bg-slate-100 text-slate-700",
	published: "bg-emerald-100 text-emerald-800",
	archived: "bg-gray-200 text-gray-600",
};

export default async function AdminCoursesPage() {
	const auth = await requireAdmin();
	if (!auth.ok) redirect("/dashboard");

	const [{ data: courses, error }, { data: enrollments }] = await Promise.all([
		auth.supabase.from("courses").select("id, title, status, level, updated_at").order("updated_at", { ascending: false }),
		auth.supabase.from("course_enrollments").select("course_id, completed_at"),
	]);
	const stats = new Map<string, { learners: number; done: number }>();
	for (const e of enrollments ?? []) {
		const s = stats.get(e.course_id) ?? { learners: 0, done: 0 };
		s.learners++;
		if (e.completed_at) s.done++;
		stats.set(e.course_id, s);
	}

	return (
		<div className="mx-auto max-w-6xl space-y-6 p-4 md:p-6">
			<SereneBreadcrumb items={[{ label: "Admin", href: "/dashboard/admin" }, { label: "Courses", active: true }]} />
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="text-2xl font-black text-[#1a365d]">Courses</h1>
					<p className="text-sm text-gray-600">Build modules and lessons. Signed-in learners can start a course and their progress is tracked here.</p>
				</div>
				<Link href="/dashboard/admin/courses/new" className="inline-flex items-center gap-2 rounded-lg bg-[#008080] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#006666]">
					<Plus className="h-4 w-4" /> New course
				</Link>
			</div>
			{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800">Could not load: {error.message}</p>}
			{!courses?.length ? (
				<div className="rounded-2xl border border-dashed border-gray-300 p-12 text-center">
					<GraduationCap className="mx-auto mb-3 h-8 w-8 text-gray-400" aria-hidden />
					<p className="font-bold text-gray-700">No courses yet</p>
				</div>
			) : (
				<ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-200 bg-white">
					{courses.map((c) => {
						const s = stats.get(c.id) ?? { learners: 0, done: 0 };
						return (
							<li key={c.id}>
								<Link href={`/dashboard/admin/courses/${c.id}`} className="flex flex-wrap items-center gap-3 px-4 py-3 hover:bg-gray-50">
									<div className="min-w-0 flex-1">
										<p className="truncate font-bold text-[#1a365d]">{c.title}</p>
										<p className="text-xs capitalize text-gray-500">{c.level} · {s.learners} learner{s.learners === 1 ? "" : "s"} · {s.done} completed</p>
									</div>
									<span className={cn("rounded-full px-2.5 py-1 text-xs font-bold capitalize", BADGE[c.status])}>{c.status}</span>
								</Link>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
