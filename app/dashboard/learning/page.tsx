import Link from "next/link";
import { redirect } from "next/navigation";
import { GraduationCap, PlayCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { pct } from "@/lib/courses/video";

export const metadata = { title: "My learning" };

export default async function LearningPage() {
	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect("/signin?next=/dashboard/learning");

	const { data: enrollments } = await supabase
		.from("course_enrollments")
		.select("course_id, last_lesson_id, last_active_at, completed_at")
		.eq("user_id", user.id)
		.order("last_active_at", { ascending: false });
	const courseIds = (enrollments ?? []).map((e) => e.course_id);

	const [{ data: courses }, { data: lessons }, { data: progress }] = courseIds.length
		? await Promise.all([
				supabase.from("courses").select("id, slug, title, summary, status").in("id", courseIds),
				supabase.from("course_lessons").select("id, course_id").in("course_id", courseIds),
				supabase.from("lesson_progress").select("course_id").eq("user_id", user.id).in("course_id", courseIds),
			])
		: [{ data: [] }, { data: [] }, { data: [] }];

	const total = new Map<string, number>();
	for (const l of lessons ?? []) total.set(l.course_id, (total.get(l.course_id) ?? 0) + 1);
	const done = new Map<string, number>();
	for (const p of progress ?? []) done.set(p.course_id, (done.get(p.course_id) ?? 0) + 1);
	const byId = new Map((courses ?? []).map((c) => [c.id, c]));

	return (
		<div className="mx-auto max-w-4xl space-y-6 p-4 md:p-6">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div>
					<h1 className="text-2xl font-black text-[#1a365d]">My learning</h1>
					<p className="text-sm text-gray-600">Pick up where you left off.</p>
				</div>
				<Link href="/learn/courses" className="inline-flex min-h-11 items-center rounded-full border border-[#008080] px-5 text-sm font-bold text-[#008080] hover:bg-[#f0fafa]">Browse courses</Link>
			</div>
			{!enrollments?.length ? (
				<div className="rounded-2xl border border-dashed border-gray-300 p-12 text-center">
					<GraduationCap className="mx-auto mb-3 h-10 w-10 text-gray-400" aria-hidden />
					<p className="font-bold text-gray-700">You have not started a course yet.</p>
				</div>
			) : (
				<ul className="space-y-4">
					{enrollments.map((e) => {
						const c = byId.get(e.course_id);
						if (!c || c.status === "archived") return null;
						const t = total.get(c.id) ?? 0;
						const d = Math.min(done.get(c.id) ?? 0, t);
						const percent = pct(d, t);
						const href = e.last_lesson_id ? `/learn/courses/${c.slug}/lessons/${e.last_lesson_id}` : `/learn/courses/${c.slug}`;
						return (
							<li key={c.id} className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div className="min-w-0">
										<h2 className="font-black text-[#1a365d]">{c.title}</h2>
										<p className="text-sm text-gray-500">{e.completed_at ? "Completed" : `${d} of ${t} lessons`}</p>
									</div>
									<Link href={href} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[#1a365d] px-5 text-sm font-black text-white hover:bg-[#008080] active:scale-[0.98]">
										<PlayCircle className="h-4 w-4" aria-hidden /> {e.completed_at ? "Review" : "Continue"}
									</Link>
								</div>
								<div className="mt-4 h-2.5 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.title} progress`}>
									<div className="h-full rounded-full bg-[#008080] transition-all duration-500" style={{ width: `${percent}%` }} />
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
