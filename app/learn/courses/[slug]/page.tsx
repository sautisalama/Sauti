import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Award, CheckCircle2, Circle, PlayCircle } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { createClient } from "@/utils/supabase/server";
import { sanitizeContent } from "@/lib/content/sanitize";
import { pct } from "@/lib/courses/video";
import { EnrollButton } from "@/components/courses/EnrollButton";
import { coverFor } from "@/lib/courses/covers";
import { issueCertificate } from "@/lib/courses/certificates";

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { slug } = await params;
	const supabase = await createClient();
	const { data } = await supabase.from("courses").select("title, summary").eq("slug", slug).eq("status", "published").maybeSingle();
	return data ? { title: data.title, description: data.summary ?? undefined, alternates: { canonical: `/learn/courses/${slug}` } } : { title: "Course not found" };
}

export default async function CoursePage({ params }: Props) {
	const { slug } = await params;
	const supabase = await createClient();
	const { data: course } = await supabase.from("courses").select("*").eq("slug", slug).eq("status", "published").maybeSingle();
	if (!course) notFound();

	const {
		data: { user },
	} = await supabase.auth.getUser();

	const [{ data: modules }, { data: lessons }] = await Promise.all([
		supabase.from("course_modules").select("id, title, summary, position").eq("course_id", course.id).order("position"),
		// Lesson titles are only readable when signed in (RLS); anonymous visitors see module-level outline.
		supabase.from("course_lessons").select("id, module_id, title, position, estimated_minutes").eq("course_id", course.id).order("position"),
	]);

	let done = new Set<string>();
	let enrollment: { last_lesson_id: string | null; completed_at: string | null } | null = null;
	if (user) {
		const [{ data: prog }, { data: enr }] = await Promise.all([
			supabase.from("lesson_progress").select("lesson_id").eq("user_id", user.id).eq("course_id", course.id),
			supabase.from("course_enrollments").select("last_lesson_id, completed_at").eq("user_id", user.id).eq("course_id", course.id).maybeSingle(),
		]);
		done = new Set((prog ?? []).map((p) => p.lesson_id));
		enrollment = enr;
	}

	const certificate = user && enrollment?.completed_at ? await issueCertificate(course.id, user.id).catch(() => null) : null;

	const all = lessons ?? [];
	const ordered = (modules ?? []).flatMap((m) => all.filter((l) => l.module_id === m.id));
	const firstUndone = ordered.find((l) => !done.has(l.id)) ?? ordered[0];
	const resume = ordered.find((l) => l.id === enrollment?.last_lesson_id && !done.has(l.id)) ?? firstUndone;
	const percent = pct(done.size, all.length);
	const next = `/learn/courses/${slug}`;

	return (
		<div className="flex min-h-screen flex-col bg-white">
			<Nav />
			<main id="main-content" className="flex-1 px-4 py-10 md:py-16">
				<div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-[1fr_22rem]">
					<div>
						<Link href="/learn/courses" className="text-sm font-bold text-[#1a365d] hover:text-sauti-orange">← All courses</Link>
						<div className="relative mt-5 aspect-[21/9] overflow-hidden rounded-2xl bg-gradient-to-br from-[#1a365d] to-sauti-teal">
							<Image src={coverFor(course)} alt="" fill priority sizes="(min-width:1024px) 60vw, 100vw" className="object-cover" />
						</div>
						<p className="mt-6 text-[11px] font-black uppercase tracking-widest text-sauti-teal">{course.level}{course.estimated_minutes ? ` · ${course.estimated_minutes} min` : ""}</p>
						<h1 className="mb-4 mt-2 text-3xl font-black text-[#1a365d] md:text-5xl">{course.title}</h1>
						{course.summary && <p className="mb-6 text-lg text-gray-600">{course.summary}</p>}
						{course.description && <div className="rich-content mb-10" dangerouslySetInnerHTML={{ __html: sanitizeContent(course.description) }} />}

						<h2 className="mb-4 text-2xl font-black text-[#1a365d]">What you will learn</h2>
						<ol className="space-y-4">
							{(modules ?? []).map((m, mi) => (
								<li key={m.id} className="rounded-2xl border border-gray-200 p-5">
									<h3 className="font-black text-[#1a365d]">Module {mi + 1}: {m.title}</h3>
									{m.summary && <p className="mt-1 text-sm text-gray-600">{m.summary}</p>}
									<ul className="mt-3 space-y-1.5">
										{all.filter((l) => l.module_id === m.id).map((l) => (
											<li key={l.id} className="flex items-center gap-2 text-sm text-gray-700">
												{done.has(l.id) ? <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-label="Completed" /> : <Circle className="h-4 w-4 shrink-0 text-gray-300" aria-hidden />}
												{user ? <Link href={`/learn/courses/${slug}/lessons/${l.id}`} className="font-medium hover:text-sauti-teal hover:underline">{l.title}</Link> : <span>{l.title}</span>}
												{l.estimated_minutes ? <span className="ml-auto text-xs text-gray-400">{l.estimated_minutes} min</span> : null}
											</li>
										))}
									</ul>
								</li>
							))}
						</ol>
					</div>

					<aside className="lg:sticky lg:top-24 lg:self-start">
						<div className="rounded-2xl border border-gray-200 bg-[#f8f9fb] p-6 shadow-lg">
							{user && enrollment ? (
								<>
									<p className="text-sm font-bold text-gray-600">{enrollment.completed_at ? "Course completed 🎉" : "Your progress"}</p>
									<div className="my-3 h-3 overflow-hidden rounded-full bg-gray-200" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Course progress">
										<div className="h-full rounded-full bg-sauti-teal transition-all duration-500" style={{ width: `${percent}%` }} />
									</div>
									<p className="mb-4 text-sm text-gray-600">{done.size} of {all.length} lessons · {percent}%</p>
									{certificate && (
										<Link href={`/learn/certificates/${certificate.number}`} className="mb-3 flex w-full items-center justify-center gap-2 rounded-full bg-sauti-yellow px-6 py-3.5 text-base font-black text-[#1a365d] transition-[transform,filter] duration-150 ease-out hover:brightness-95 active:scale-[0.98]">
											<Award className="h-5 w-5" aria-hidden /> View your certificate
										</Link>
									)}
									{resume && (
										<Link href={`/learn/courses/${slug}/lessons/${resume.id}`} className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1a365d] px-6 py-3.5 text-base font-black text-white transition-colors hover:bg-sauti-teal active:scale-[0.98]">
											<PlayCircle className="h-5 w-5" aria-hidden /> {done.size ? "Continue" : "Start"} learning
										</Link>
									)}
								</>
							) : user ? (
								<>
									<p className="mb-4 text-sm text-gray-600">{all.length} lessons. Free, self-paced, and your progress is saved.</p>
									<EnrollButton courseId={course.id} firstLessonHref={firstUndone ? `/learn/courses/${slug}/lessons/${firstUndone.id}` : null} />
								</>
							) : (
								<>
									<p className="mb-4 text-sm text-gray-600">Sign in or create a free account to start this course and track your progress.</p>
									<Link href={`/signin?next=${encodeURIComponent(next)}`} className="flex w-full items-center justify-center rounded-full bg-[#1a365d] px-6 py-3.5 text-base font-black text-white hover:bg-sauti-teal">Sign in to start</Link>
									<Link href={`/signup?next=${encodeURIComponent(next)}`} className="mt-3 block text-center text-sm font-bold text-sauti-teal underline">Create a free account</Link>
								</>
							)}
						</div>
					</aside>
				</div>
			</main>
			<div className="bg-[#00473e]"><Footer /></div>
		</div>
	);
}
