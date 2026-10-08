"use client";

import { COURSE_COVERS } from "@/lib/courses/covers";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Archive, ArrowDown, ArrowUp, BarChart3, ExternalLink, Loader2, Plus, Save, Send, Trash2, Undo2, X } from "lucide-react";
import { RichEditor } from "@/components/editor/RichEditor";
import { uploadToPublications } from "@/lib/content/upload-client";
import { cn } from "@/lib/utils";
import {
	deleteCourse, deleteLesson, deleteModule, moveItem, saveCourse, saveLesson, saveModule, setCourseStatus,
} from "@/app/actions/courses";
import { COURSE_LEVELS, type CourseLessonRow, type CourseLevel, type CourseModuleRow, type CourseRow } from "@/types/publishing";

export interface BuilderData {
	course: CourseRow;
	modules: (CourseModuleRow & { lessons: CourseLessonRow[] })[];
	learners: number;
}

const STATUS_CLS: Record<string, string> = {
	draft: "bg-slate-100 text-slate-700",
	published: "bg-emerald-100 text-emerald-800",
	archived: "bg-gray-200 text-gray-600",
};

export function CourseBuilder({ data }: { data: BuilderData }) {
	const router = useRouter();
	const { course, modules } = data;
	const [pending, startTransition] = useTransition();
	const [busy, setBusy] = useState<string | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [openLesson, setOpenLesson] = useState<string | null>(null);

	const run = async (key: string, fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) => {
		setBusy(key);
		setError(null);
		const res = await fn();
		setBusy(null);
		if (!res.ok) return setError(res.error ?? "Something went wrong."), false;
		if (okMsg) {
			setNotice(okMsg);
			setTimeout(() => setNotice(null), 3000);
		}
		startTransition(() => router.refresh());
		return true;
	};

	const totalLessons = modules.reduce((n, m) => n + m.lessons.length, 0);

	return (
		<div className="space-y-6">
			<div className="flex flex-wrap items-center gap-3">
				<span className={cn("rounded-full px-3 py-1 text-xs font-bold capitalize", STATUS_CLS[course.status])}>{course.status}</span>
				<span className="text-sm text-gray-500">{modules.length} modules · {totalLessons} lessons · {data.learners} learner{data.learners === 1 ? "" : "s"}</span>
				<span className="flex-1" />
				<Link href={`/dashboard/admin/courses/${course.id}/progress`} className="btn-secondary"><BarChart3 className="h-4 w-4" /> Learner progress</Link>
				{course.status === "published" && (
					<Link href={`/learn/courses/${course.slug}`} target="_blank" className="btn-secondary"><ExternalLink className="h-4 w-4" /> View live</Link>
				)}
				{course.status === "published" ? (
					<button className="btn-secondary" disabled={!!busy} onClick={() => run("status", () => setCourseStatus(course.id, "draft"), "Unpublished.")}><Undo2 className="h-4 w-4" /> Unpublish</button>
				) : (
					<button className="inline-flex items-center gap-2 rounded-lg bg-[#1a365d] px-4 py-2 text-sm font-bold text-white hover:bg-[#008080] disabled:opacity-50" disabled={!!busy || totalLessons === 0} title={totalLessons === 0 ? "Add a lesson first" : undefined} onClick={() => run("status", () => setCourseStatus(course.id, "published"), "Published. Learners can now enrol.")}>
						{busy === "status" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Publish
					</button>
				)}
				{course.status !== "archived" && (
					<button className="btn-secondary" disabled={!!busy} onClick={() => run("status", () => setCourseStatus(course.id, "archived"), "Archived.")}><Archive className="h-4 w-4" /> Archive</button>
				)}
				<button
					className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label="Delete course" title="Delete course and all learner progress"
					onClick={async () => {
						if (!window.confirm(`Delete “${course.title}” and all learner progress? This cannot be undone.`)) return;
						if (await run("delete", () => deleteCourse(course.id))) router.push("/dashboard/admin/courses");
					}}
				><Trash2 className="h-4 w-4" /></button>
			</div>

			{error && (
				<div role="alert" className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800">
					<span className="flex-1">{error}</span>
					<button aria-label="Dismiss" onClick={() => setError(null)}><X className="h-4 w-4" /></button>
				</div>
			)}
			{notice && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900">{notice}</div>}

			<CourseDetails key={course.updated_at} course={course} run={run} busy={busy} />

			<section aria-labelledby="modules-h" className="space-y-4">
				<div className="flex items-center justify-between">
					<h2 id="modules-h" className="text-xl font-black text-[#1a365d]">Modules & lessons</h2>
					<AddModule courseId={course.id} run={run} busy={busy} />
				</div>
				{modules.length === 0 && <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500">No modules yet. Add a module, then add lessons to it.</p>}
				{modules.map((m, mi) => (
					<div key={m.id} className="rounded-2xl border border-gray-200 bg-white">
						<ModuleHeader m={m} first={mi === 0} last={mi === modules.length - 1} run={run} busy={busy} />
						<ul className="divide-y divide-gray-100 border-t border-gray-100">
							{m.lessons.map((l, li) => (
								<li key={l.id}>
									<div className="flex items-center gap-2 px-4 py-2.5">
										<button className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-gray-800 hover:text-[#008080]" onClick={() => setOpenLesson(openLesson === l.id ? null : l.id)} aria-expanded={openLesson === l.id}>
											<span className="mr-2 text-gray-400">{mi + 1}.{li + 1}</span>{l.title}
										</button>
										<IconBtn label="Move lesson up" disabled={li === 0 || !!busy} onClick={() => run("mv", () => moveItem("course_lessons", l.id, "up"))}><ArrowUp className="h-4 w-4" /></IconBtn>
										<IconBtn label="Move lesson down" disabled={li === m.lessons.length - 1 || !!busy} onClick={() => run("mv", () => moveItem("course_lessons", l.id, "down"))}><ArrowDown className="h-4 w-4" /></IconBtn>
									</div>
									{openLesson === l.id && (
										<LessonEditor key={l.id + l.updated_at} lesson={l} run={run} busy={busy} onClose={() => setOpenLesson(null)} />
									)}
								</li>
							))}
						</ul>
						<div className="border-t border-gray-100 px-4 py-3">
							<AddLesson moduleId={m.id} run={run} busy={busy} onCreated={setOpenLesson} />
						</div>
					</div>
				))}
			</section>
			{pending && <p className="text-xs text-gray-400" aria-live="polite">Updating…</p>}

			<style>{`
				.input{width:100%;border:1px solid #d1d5db;border-radius:.6rem;padding:.55rem .75rem;font-size:.95rem;background:#fff}
				.input:focus{outline:2px solid rgba(0,128,128,.35);border-color:#008080}
				.btn-secondary{display:inline-flex;align-items:center;gap:.4rem;border:1px solid #d1d5db;background:#fff;border-radius:.6rem;padding:.5rem .9rem;font-size:.875rem;font-weight:700;color:#374151}
				.btn-secondary:hover:not(:disabled){background:#f3f4f6}
				.btn-secondary:disabled{opacity:.5}
			`}</style>
		</div>
	);
}

type Run = (key: string, fn: () => Promise<{ ok: boolean; error?: string }>, okMsg?: string) => Promise<boolean>;

function IconBtn({ label, onClick, disabled, children }: { label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }) {
	return (
		<button type="button" aria-label={label} title={label} disabled={disabled} onClick={onClick} className="rounded-md p-1.5 text-gray-500 hover:bg-gray-100 disabled:opacity-30">{children}</button>
	);
}

function CourseDetails({ course, run, busy }: { course: CourseRow; run: Run; busy: string | null }) {
	const [f, setF] = useState({
		title: course.title,
		summary: course.summary ?? "",
		description: course.description ?? "",
		cover: course.cover_image_url ?? "",
		level: course.level,
		minutes: course.estimated_minutes?.toString() ?? "",
	});
	const dirty = f.title !== course.title || f.summary !== (course.summary ?? "") || f.description !== (course.description ?? "") || f.cover !== (course.cover_image_url ?? "") || f.level !== course.level || f.minutes !== (course.estimated_minutes?.toString() ?? "");
	return (
		<section aria-labelledby="details-h" className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5">
			<h2 id="details-h" className="text-xl font-black text-[#1a365d]">Course details</h2>
			<div className="grid gap-4 md:grid-cols-[1fr_12rem_8rem]">
				<label className="block text-sm font-bold text-[#1a365d]">Title<input className="input mt-1 font-normal" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} maxLength={140} /></label>
				<label className="block text-sm font-bold text-[#1a365d]">Level
					<select className="input mt-1 font-normal capitalize" value={f.level} onChange={(e) => setF({ ...f, level: e.target.value as CourseLevel })}>
						{COURSE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
					</select>
				</label>
				<label className="block text-sm font-bold text-[#1a365d]">Minutes<input className="input mt-1 font-normal" inputMode="numeric" value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value.replace(/\D/g, "") })} /></label>
			</div>
			<label className="block text-sm font-bold text-[#1a365d]">Short summary<textarea className="input mt-1 font-normal" rows={2} maxLength={300} value={f.summary} onChange={(e) => setF({ ...f, summary: e.target.value })} /></label>
			<div>
				<p className="mb-1 text-sm font-bold text-[#1a365d]">Feature photo</p>
				<p className="mb-2 text-xs text-gray-500">Choose a photo from the library, or upload your own below. If you choose nothing, a photo is picked for you.</p>
				<div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6" role="radiogroup" aria-label="Feature photo">
					{COURSE_COVERS.map((c) => (
						<button key={c.url} type="button" role="radio" aria-checked={f.cover === c.url} onClick={() => setF({ ...f, cover: f.cover === c.url ? "" : c.url })}
							className={`group relative aspect-video overflow-hidden rounded-lg border-2 transition-[border-color,transform] duration-150 ease-out active:scale-[0.97] ${f.cover === c.url ? "border-[#008080]" : "border-transparent hover:border-gray-300"}`}>
							{/* eslint-disable-next-line @next/next/no-img-element */}
							<img src={c.url} alt="" loading="lazy" className="h-full w-full object-cover" />
							<span className="absolute inset-x-0 bottom-0 bg-black/55 px-1.5 py-0.5 text-left text-[10px] font-semibold text-white">{c.label}</span>
						</button>
					))}
				</div>
			</div>
			<label className="block text-sm font-bold text-[#1a365d]">Cover image link
				<span className="mt-1 flex gap-2">
					<input className="input font-normal" value={f.cover} onChange={(e) => setF({ ...f, cover: e.target.value })} placeholder="https://… or upload" />
					<label className="btn-secondary shrink-0 cursor-pointer">Upload
						<input type="file" accept="image/*" className="sr-only" onChange={async (e) => {
							const file = e.target.files?.[0];
							if (!file) return;
							try { const up = await uploadToPublications(file, "covers"); setF((p) => ({ ...p, cover: up.url })); } catch (err) { window.alert(err instanceof Error ? err.message : "Upload failed."); }
						}} />
					</label>
				</span>
			</label>
			<div>
				<p className="mb-1 text-sm font-bold text-[#1a365d]">About this course</p>
				<RichEditor value={f.description} onChange={(h) => setF((p) => ({ ...p, description: h }))} onUploadImage={async (file) => (await uploadToPublications(file, "images")).url} minHeight={180} placeholder="What will learners get from this course?" />
			</div>
			<button className="inline-flex items-center gap-2 rounded-lg bg-[#008080] px-4 py-2 text-sm font-bold text-white hover:bg-[#006666] disabled:opacity-50" disabled={!dirty || !!busy}
				onClick={() => run("course", () => saveCourse({ id: course.id, title: f.title, summary: f.summary, description: f.description, cover_image_url: f.cover, level: f.level, estimated_minutes: f.minutes ? Number(f.minutes) : null }), "Course saved.")}>
				{busy === "course" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save details
			</button>
		</section>
	);
}

function AddModule({ courseId, run, busy }: { courseId: string; run: Run; busy: string | null }) {
	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState("");
	if (!open) return <button className="btn-secondary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add module</button>;
	return (
		<form className="flex gap-2" onSubmit={async (e) => { e.preventDefault(); if (await run("add-module", () => saveModule({ course_id: courseId, title }))) { setTitle(""); setOpen(false); } }}>
			<input autoFocus className="input" placeholder="Module title" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Module title" />
			<button className="btn-secondary" disabled={!title.trim() || !!busy}>Add</button>
			<button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
		</form>
	);
}

function ModuleHeader({ m, first, last, run, busy }: { m: CourseModuleRow; first: boolean; last: boolean; run: Run; busy: string | null }) {
	const [title, setTitle] = useState(m.title);
	return (
		<div className="flex items-center gap-2 px-4 py-3">
			<input className="input min-w-0 flex-1 font-bold" value={title} onChange={(e) => setTitle(e.target.value)} onBlur={() => title.trim() && title !== m.title && run("mod", () => saveModule({ id: m.id, course_id: m.course_id, title }))} aria-label="Module title" />
			<IconBtn label="Move module up" disabled={first || !!busy} onClick={() => run("mv", () => moveItem("course_modules", m.id, "up"))}><ArrowUp className="h-4 w-4" /></IconBtn>
			<IconBtn label="Move module down" disabled={last || !!busy} onClick={() => run("mv", () => moveItem("course_modules", m.id, "down"))}><ArrowDown className="h-4 w-4" /></IconBtn>
			<IconBtn label="Delete module" disabled={!!busy} onClick={() => window.confirm("Delete this module and its lessons?") && run("del", () => deleteModule(m.id))}><Trash2 className="h-4 w-4 text-red-600" /></IconBtn>
		</div>
	);
}

function AddLesson({ moduleId, run, busy, onCreated }: { moduleId: string; run: Run; busy: string | null; onCreated: (id: string) => void }) {
	const [open, setOpen] = useState(false);
	const [title, setTitle] = useState("");
	if (!open) return <button className="inline-flex items-center gap-1 text-sm font-bold text-[#008080] hover:underline" onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> Add lesson</button>;
	return (
		<form className="flex gap-2" onSubmit={async (e) => {
			e.preventDefault();
			const res = await saveLesson({ module_id: moduleId, title, content: "" });
			if (res.ok) { setTitle(""); setOpen(false); onCreated(res.id); }
			await run("add-lesson", async () => res);
		}}>
			<input autoFocus className="input" placeholder="Lesson title" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Lesson title" />
			<button className="btn-secondary" disabled={!title.trim() || !!busy}>Add</button>
			<button type="button" className="btn-secondary" onClick={() => setOpen(false)}>Cancel</button>
		</form>
	);
}

function LessonEditor({ lesson, run, busy, onClose }: { lesson: CourseLessonRow; run: Run; busy: string | null; onClose: () => void }) {
	const [f, setF] = useState({ title: lesson.title, content: lesson.content, video: lesson.video_url ?? "", minutes: lesson.estimated_minutes?.toString() ?? "" });
	return (
		<div className="space-y-3 border-t border-gray-100 bg-[#f8f9fb] px-4 py-4">
			<div className="grid gap-3 md:grid-cols-[1fr_8rem]">
				<label className="text-sm font-bold text-[#1a365d]">Lesson title<input className="input mt-1 font-normal" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} /></label>
				<label className="text-sm font-bold text-[#1a365d]">Minutes<input className="input mt-1 font-normal" inputMode="numeric" value={f.minutes} onChange={(e) => setF({ ...f, minutes: e.target.value.replace(/\D/g, "") })} /></label>
			</div>
			<label className="block text-sm font-bold text-[#1a365d]">Video (optional — YouTube or Vimeo)<input className="input mt-1 font-normal" value={f.video} onChange={(e) => setF({ ...f, video: e.target.value })} placeholder="https://youtu.be/…" /></label>
			<RichEditor value={f.content} onChange={(h) => setF((p) => ({ ...p, content: h }))} onUploadImage={async (file) => (await uploadToPublications(file, "images")).url} minHeight={260} placeholder="Lesson content…" />
			<div className="flex gap-2">
				<button className="inline-flex items-center gap-2 rounded-lg bg-[#008080] px-4 py-2 text-sm font-bold text-white hover:bg-[#006666] disabled:opacity-50" disabled={!!busy}
					onClick={() => run("lesson", () => saveLesson({ id: lesson.id, module_id: lesson.module_id, title: f.title, content: f.content, video_url: f.video, estimated_minutes: f.minutes ? Number(f.minutes) : null }), "Lesson saved.")}>
					{busy === "lesson" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save lesson
				</button>
				<button className="btn-secondary" onClick={onClose}>Close</button>
				<span className="flex-1" />
				<button className="rounded-lg p-2 text-red-600 hover:bg-red-50" aria-label="Delete lesson" onClick={() => window.confirm("Delete this lesson?") && run("del", () => deleteLesson(lesson.id))}><Trash2 className="h-4 w-4" /></button>
			</div>
		</div>
	);
}
