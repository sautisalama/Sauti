"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { saveCourse } from "@/app/actions/courses";
import { COURSE_LEVELS, type CourseLevel } from "@/types/publishing";

export function NewCourseForm() {
	const router = useRouter();
	const [title, setTitle] = useState("");
	const [summary, setSummary] = useState("");
	const [level, setLevel] = useState<CourseLevel>("beginner");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	return (
		<form
			className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5"
			onSubmit={async (e) => {
				e.preventDefault();
				setBusy(true);
				setError(null);
				const res = await saveCourse({ title, summary, level });
				if (!res.ok) {
					setBusy(false);
					return setError(res.error);
				}
				router.push(`/dashboard/admin/courses/${res.id}`);
			}}
		>
			<h1 className="text-2xl font-black text-[#1a365d]">New course</h1>
			<p className="text-sm text-gray-600">Start with the basics. You will add modules and lessons next, and it stays a draft until you publish it.</p>
			{error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-800">{error}</p>}
			<label className="block text-sm font-bold text-[#1a365d]">Title
				<input autoFocus required minLength={3} maxLength={140} value={title} onChange={(e) => setTitle(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" />
			</label>
			<label className="block text-sm font-bold text-[#1a365d]">Short summary
				<textarea rows={2} maxLength={300} value={summary} onChange={(e) => setSummary(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal" />
			</label>
			<label className="block text-sm font-bold text-[#1a365d]">Level
				<select value={level} onChange={(e) => setLevel(e.target.value as CourseLevel)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 font-normal capitalize">
					{COURSE_LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
				</select>
			</label>
			<button disabled={busy || title.trim().length < 3} className="inline-flex items-center gap-2 rounded-lg bg-[#008080] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#006666] disabled:opacity-50">
				{busy && <Loader2 className="h-4 w-4 animate-spin" />} Create course
			</button>
		</form>
	);
}
