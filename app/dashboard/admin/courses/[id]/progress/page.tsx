import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/require-admin";
import { SereneBreadcrumb } from "@/components/ui/SereneBreadcrumb";

export const metadata = { title: "Learner progress" };

const when = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "—");

export default async function CourseProgressPage({ params }: { params: Promise<{ id: string }> }) {
	const auth = await requireAdmin();
	if (!auth.ok) redirect("/dashboard");
	const { id } = await params;
	if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();

	const { data: course } = await auth.supabase.from("courses").select("id, title").eq("id", id).maybeSingle();
	if (!course) notFound();

	const [{ count: total }, { data: enrollments }, { data: progress }] = await Promise.all([
		auth.supabase.from("course_lessons").select("id", { count: "exact", head: true }).eq("course_id", id),
		auth.supabase.from("course_enrollments").select("user_id, enrolled_at, last_active_at, completed_at").eq("course_id", id).order("last_active_at", { ascending: false }),
		auth.supabase.from("lesson_progress").select("user_id").eq("course_id", id),
	]);
	const doneBy = new Map<string, number>();
	for (const p of progress ?? []) doneBy.set(p.user_id, (doneBy.get(p.user_id) ?? 0) + 1);

	const ids = (enrollments ?? []).map((e) => e.user_id);
	const { data: profiles } = ids.length ? await auth.supabase.from("profiles").select("id, first_name, last_name, email, is_anonymous, anon_username").in("id", ids) : { data: [] };
	const nameOf = new Map(
		(profiles ?? []).map((p) => [p.id, p.is_anonymous ? p.anon_username || "Anonymous learner" : [p.first_name, p.last_name].filter(Boolean).join(" ") || p.email || "Learner"])
	);

	const lessons = total ?? 0;
	const rows = (enrollments ?? []).map((e) => {
		const done = Math.min(doneBy.get(e.user_id) ?? 0, lessons);
		return { ...e, name: nameOf.get(e.user_id) ?? "Learner", done, pct: lessons ? Math.round((done / lessons) * 100) : 0 };
	});
	const completed = rows.filter((r) => r.completed_at).length;
	const avg = rows.length ? Math.round(rows.reduce((n, r) => n + r.pct, 0) / rows.length) : 0;

	return (
		<div className="mx-auto max-w-5xl space-y-6 p-4 md:p-6">
			<SereneBreadcrumb items={[{ label: "Admin", href: "/dashboard/admin" }, { label: "Courses", href: "/dashboard/admin/courses" }, { label: course.title, href: `/dashboard/admin/courses/${id}` }, { label: "Progress", active: true }]} />
			<h1 className="text-2xl font-black text-[#1a365d]">Learner progress — {course.title}</h1>
			<dl className="grid grid-cols-3 gap-3">
				{[["Learners", rows.length], ["Completed", completed], ["Average progress", `${avg}%`]].map(([k, v]) => (
					<div key={k as string} className="rounded-xl border border-gray-200 bg-white p-4">
						<dt className="text-xs font-bold uppercase tracking-wider text-gray-500">{k}</dt>
						<dd className="text-2xl font-black text-[#1a365d]">{v}</dd>
					</div>
				))}
			</dl>
			{rows.length === 0 ? (
				<p className="rounded-xl border border-dashed border-gray-300 p-10 text-center text-sm text-gray-500">No one has started this course yet.</p>
			) : (
				<div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
					<table className="w-full min-w-[34rem] text-left text-sm">
						<thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
							<tr><th className="px-4 py-3">Learner</th><th className="px-4 py-3">Progress</th><th className="px-4 py-3">Started</th><th className="px-4 py-3">Last active</th><th className="px-4 py-3">Completed</th></tr>
						</thead>
						<tbody className="divide-y divide-gray-100">
							{rows.map((r) => (
								<tr key={r.user_id}>
									<td className="px-4 py-3 font-semibold text-gray-800">{r.name}</td>
									<td className="px-4 py-3">
										<div className="flex items-center gap-2">
											<div className="h-2 w-28 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={r.pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${r.name} progress`}>
												<div className="h-full bg-[#008080]" style={{ width: `${r.pct}%` }} />
											</div>
											<span className="text-xs text-gray-600">{r.done}/{lessons} · {r.pct}%</span>
										</div>
									</td>
									<td className="px-4 py-3 text-gray-600">{when(r.enrolled_at)}</td>
									<td className="px-4 py-3 text-gray-600">{when(r.last_active_at)}</td>
									<td className="px-4 py-3 text-gray-600">{when(r.completed_at)}</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
			<Link href={`/dashboard/admin/courses/${id}`} className="text-sm font-bold text-[#008080] hover:underline">← Back to course</Link>
		</div>
	);
}
