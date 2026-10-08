import Link from "next/link";
import { redirect } from "next/navigation";
import Image from "next/image";
import { Award, GraduationCap, PlayCircle } from "lucide-react";
import { createClient } from "@/utils/supabase/server";
import { pct } from "@/lib/courses/video";
import { coverFor } from "@/lib/courses/covers";

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

	const { data: certs } = courseIds.length ? await supabase.from("course_certificates").select("course_id, certificate_number").eq("user_id", user.id) : { data: [] as { course_id: string; certificate_number: string }[] };
	const certByCourse = new Map((certs ?? []).map((c) => [c.course_id, c.certificate_number]));

	const [{ data: courses }, { data: lessons }, { data: progress }] = courseIds.length
		? await Promise.all([
				supabase.from("courses").select("id, slug, title, summary, status, cover_image_url").in("id", courseIds),
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
							<li key={c.id} className="overflow-hidden rounded-xl border border-serene-neutral-100 bg-white shadow-sm">
								<div className="relative h-28 bg-gradient-to-br from-[#1a365d] to-sauti-teal sm:h-32">
									<Image src={coverFor(c)} alt="" fill sizes="(min-width:768px) 56rem, 100vw" className="object-cover" />
									{e.completed_at && <span className="absolute left-3 top-3 rounded-lg bg-white/95 px-2.5 py-1 text-xs font-semibold text-serene-green-700 shadow-sm">Completed</span>}
								</div>
								<div className="p-5">
								<div className="flex flex-wrap items-start justify-between gap-3">
									<div className="min-w-0">
										<h2 className="font-semibold text-[#1a365d]">{c.title}</h2>
										<p className="text-sm text-gray-500">{e.completed_at ? "All lessons completed" : `${d} of ${t} lessons · ${percent}%`}</p>
									</div>
									<div className="flex flex-wrap gap-2">
										{certByCourse.get(c.id) && (
											<Link href={`/learn/certificates/${certByCourse.get(c.id)}`} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-sauti-yellow px-4 text-sm font-semibold text-[#1a365d] transition-[transform,filter] duration-150 ease-out hover:brightness-95 active:scale-[0.98]">
												<Award className="h-4 w-4" aria-hidden /> Certificate
											</Link>
										)}
										<Link href={href} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#1a365d] px-4 text-sm font-semibold text-white transition-[transform,background-color] duration-150 ease-out hover:bg-[#008080] active:scale-[0.98]">
											<PlayCircle className="h-4 w-4" aria-hidden /> {e.completed_at ? "Review" : "Continue"}
										</Link>
									</div>
								</div>
								<div className="mt-4 h-2.5 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.title} progress`}>
									<div className="h-full rounded-full bg-[#008080] transition-all duration-500" style={{ width: `${percent}%` }} />
								</div>
								</div>
							</li>
						);
					})}
				</ul>
			)}
		</div>
	);
}
