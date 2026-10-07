import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, Circle } from "lucide-react";
import { Nav } from "@/components/Nav";
import { createClient } from "@/utils/supabase/server";
import { sanitizeContent } from "@/lib/content/sanitize";
import { pct, toEmbedUrl } from "@/lib/courses/video";
import { LessonControls } from "@/components/courses/LessonControls";
import { cn } from "@/lib/utils";

type Props = { params: Promise<{ slug: string; lessonId: string }> };

export const metadata: Metadata = { robots: { index: false } };

export default async function LessonPage({ params }: Props) {
	const { slug, lessonId } = await params;
	if (!/^[0-9a-f-]{36}$/i.test(lessonId)) notFound();

	const supabase = await createClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();
	if (!user) redirect(`/signin?next=${encodeURIComponent(`/learn/courses/${slug}/lessons/${lessonId}`)}`);

	const { data: course } = await supabase.from("courses").select("id, title, slug").eq("slug", slug).eq("status", "published").maybeSingle();
	if (!course) notFound();

	const [{ data: modules }, { data: lessons }, { data: prog }] = await Promise.all([
		supabase.from("course_modules").select("id, title, position").eq("course_id", course.id).order("position"),
		supabase.from("course_lessons").select("id, module_id, title, content, video_url, position, estimated_minutes").eq("course_id", course.id).order("position"),
		supabase.from("lesson_progress").select("lesson_id").eq("user_id", user.id).eq("course_id", course.id),
	]);
	const all = lessons ?? [];
	const ordered = (modules ?? []).flatMap((m) => all.filter((l) => l.module_id === m.id));
	const idx = ordered.findIndex((l) => l.id === lessonId);
	if (idx < 0) notFound();
	const lesson = ordered[idx];
	const done = new Set((prog ?? []).map((p) => p.lesson_id));
	const prev = ordered[idx - 1];
	const next = ordered[idx + 1];
	const embed = toEmbedUrl(lesson.video_url);
	const base = `/learn/courses/${slug}`;
	const percent = pct(done.size, ordered.length);

	return (
		<div className="flex min-h-screen flex-col bg-white">
			<Nav />
			<main id="main-content" className="flex-1 px-4 py-6 md:py-12">
				<div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[18rem_1fr]">
					<nav aria-label="Course outline" className="order-2 lg:order-1 lg:sticky lg:top-24 lg:self-start">
						<Link href={base} className="text-sm font-bold text-[#1a365d] hover:text-sauti-orange">← {course.title}</Link>
						<div className="my-3 h-2 overflow-hidden rounded-full bg-gray-100" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress">
							<div className="h-full rounded-full bg-sauti-teal transition-all duration-500" style={{ width: `${percent}%` }} />
						</div>
						<p className="mb-4 text-xs text-gray-500">{done.size}/{ordered.length} complete · {percent}%</p>
						{(modules ?? []).map((m, mi) => (
							<div key={m.id} className="mb-4">
								<p className="mb-1 text-xs font-black uppercase tracking-wider text-gray-500">{mi + 1}. {m.title}</p>
								<ul>
									{all.filter((l) => l.module_id === m.id).map((l) => (
										<li key={l.id}>
											<Link href={`${base}/lessons/${l.id}`} aria-current={l.id === lessonId ? "page" : undefined}
												className={cn("flex min-h-11 items-center gap-2 rounded-lg px-2 py-2 text-sm", l.id === lessonId ? "bg-sauti-teal/10 font-bold text-sauti-teal" : "text-gray-700 hover:bg-gray-50")}>
												{done.has(l.id) ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Completed" /> : <Circle className="h-4 w-4 shrink-0 text-gray-300" aria-hidden />}
												<span>{l.title}</span>
											</Link>
										</li>
									))}
								</ul>
							</div>
						))}
					</nav>

					<article className="order-1 min-w-0 lg:order-2">
						<p className="text-[11px] font-black uppercase tracking-widest text-sauti-teal">Lesson {idx + 1} of {ordered.length}{lesson.estimated_minutes ? ` · ${lesson.estimated_minutes} min` : ""}</p>
						<h1 className="mb-6 mt-2 text-2xl font-black text-[#1a365d] md:text-4xl">{lesson.title}</h1>
						{embed && (
							<div className="mb-8 aspect-video overflow-hidden rounded-2xl bg-black shadow-xl">
								<iframe src={embed} title={lesson.title} className="h-full w-full" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" referrerPolicy="strict-origin-when-cross-origin" />
							</div>
						)}
						{lesson.content ? <div className="rich-content" dangerouslySetInnerHTML={{ __html: sanitizeContent(lesson.content) }} /> : !embed && <p className="text-gray-500">This lesson has no content yet.</p>}
						<LessonControls
							lessonId={lesson.id}
							initiallyDone={done.has(lesson.id)}
							prevHref={prev ? `${base}/lessons/${prev.id}` : null}
							nextHref={next ? `${base}/lessons/${next.id}` : null}
							finishHref={base}
						/>
					</article>
				</div>
			</main>
		</div>
	);
}
