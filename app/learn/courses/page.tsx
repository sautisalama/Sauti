import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, GraduationCap } from "lucide-react";
import { Nav } from "@/components/Nav";
import { Footer } from "@/components/Footer";
import { createPublicClient } from "@/utils/supabase/public-client";

export const revalidate = 300;

export const metadata: Metadata = {
	title: "Courses — Free GBV Response Training",
	description: "Free self-paced courses from Sauti Salama. Sign in, start learning, and track your progress.",
	alternates: { canonical: "/learn/courses" },
};

export default async function CoursesPage() {
	const db = createPublicClient();
	const { data: courses } = await db
		.from("courses")
		.select("id, slug, title, summary, cover_image_url, level, estimated_minutes")
		.eq("status", "published")
		.order("published_at", { ascending: false });
	const { data: lessons } = await db.from("course_modules").select("course_id");
	const modules = new Map<string, number>();
	for (const m of lessons ?? []) modules.set(m.course_id, (modules.get(m.course_id) ?? 0) + 1);

	return (
		<div className="flex min-h-screen flex-col bg-white">
			<Nav />
			<main id="main-content" className="flex-1 px-4 py-12 md:py-20">
				<div className="mx-auto max-w-7xl">
					<h1 className="mb-4 text-3xl font-black text-sauti-dark md:text-6xl">Courses</h1>
					<p className="mb-10 max-w-2xl text-lg font-medium text-gray-600 md:text-xl">Learn at your own pace. Create a free account to start a course and pick up where you left off on any device.</p>
					{!courses?.length ? (
						<div className="rounded-2xl border border-dashed border-gray-300 p-12 text-center">
							<GraduationCap className="mx-auto mb-3 h-10 w-10 text-gray-400" aria-hidden />
							<p className="font-bold text-gray-700">New courses are on the way.</p>
							<Link href="/learn" className="mt-3 inline-block font-bold text-sauti-teal underline">Back to Learn</Link>
						</div>
					) : (
						<ul className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
							{courses.map((c) => (
								<li key={c.id}>
									<Link href={`/learn/courses/${c.slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl transition-shadow hover:shadow-2xl">
										<div className="relative flex aspect-video items-center justify-center overflow-hidden bg-gradient-to-br from-[#1a365d] to-sauti-teal">
											{c.cover_image_url ? <Image src={c.cover_image_url} alt="" fill sizes="(min-width:1024px) 33vw, (min-width:640px) 50vw, 100vw" className="object-cover transition-transform duration-700 group-hover:scale-105" /> : <GraduationCap className="h-12 w-12 text-white/70" aria-hidden />}
										</div>
										<div className="flex flex-1 flex-col p-6">
											<p className="mb-2 text-[11px] font-black uppercase tracking-widest text-sauti-teal">{c.level} · {modules.get(c.id) ?? 0} modules{c.estimated_minutes ? ` · ${c.estimated_minutes} min` : ""}</p>
											<h2 className="mb-2 text-xl font-bold text-[#1a365d] group-hover:text-sauti-orange">{c.title}</h2>
											<p className="mb-4 flex-1 text-gray-500">{c.summary}</p>
											<span className="flex items-center gap-2 font-black text-[#1a365d]">View course <ArrowRight className="h-4 w-4 text-sauti-orange" /></span>
										</div>
									</Link>
								</li>
							))}
						</ul>
					)}
				</div>
			</main>
			<div className="bg-[#00473e]"><Footer /></div>
		</div>
	);
}
