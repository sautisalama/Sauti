"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { recordLessonVisit, setLessonComplete } from "@/app/actions/courses";
import { cn } from "@/lib/utils";

interface Props {
	lessonId: string;
	initiallyDone: boolean;
	prevHref: string | null;
	nextHref: string | null;
	finishHref: string;
}

export function LessonControls({ lessonId, initiallyDone, prevHref, nextHref, finishHref }: Props) {
	const router = useRouter();
	const [done, setDone] = useState(initiallyDone);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [finished, setFinished] = useState(false);

	// Remember where the learner is so "Continue" resumes here.
	useEffect(() => {
		void recordLessonVisit(lessonId);
	}, [lessonId]);
	useEffect(() => setDone(initiallyDone), [initiallyDone, lessonId]);

	const toggle = async (goNext: boolean) => {
		setBusy(true);
		setError(null);
		const res = await setLessonComplete(lessonId, goNext ? true : !done);
		setBusy(false);
		if (!res.ok) return setError(res.error);
		setDone(goNext ? true : !done);
		if (res.completedCourse && !nextHref) setFinished(true);
		if (goNext) router.push(nextHref ?? finishHref);
		else router.refresh();
	};

	return (
		<div className="mt-12 border-t border-gray-100 pt-6">
			{error && <p role="alert" className="mb-3 text-sm font-semibold text-red-700">{error}</p>}
			{finished && <p role="status" className="mb-3 rounded-xl bg-emerald-50 p-3 font-bold text-emerald-800">🎉 You completed the course. Well done!</p>}
			<div className="flex flex-wrap items-center gap-3">
				{prevHref && (
					<Link href={prevHref} className="inline-flex min-h-11 items-center gap-2 rounded-full border border-gray-300 px-5 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 active:scale-[0.98]">
						<ArrowLeft className="h-4 w-4" aria-hidden /> Previous
					</Link>
				)}
				<button
					onClick={() => toggle(false)}
					disabled={busy}
					aria-pressed={done}
					className={cn("inline-flex min-h-11 items-center gap-2 rounded-full border px-5 py-2.5 text-sm font-bold transition-all active:scale-[0.98] disabled:opacity-60", done ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-gray-300 text-gray-700 hover:bg-gray-50")}
				>
					{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" aria-hidden />} {done ? "Completed" : "Mark as complete"}
				</button>
				<button
					onClick={() => toggle(true)}
					disabled={busy}
					className="ml-auto inline-flex min-h-11 items-center gap-2 rounded-full bg-[#1a365d] px-6 py-2.5 text-sm font-black text-white transition-all hover:bg-sauti-teal active:scale-[0.98] disabled:opacity-60"
				>
					{nextHref ? "Complete & continue" : "Finish course"} <ArrowRight className="h-4 w-4" aria-hidden />
				</button>
			</div>
		</div>
	);
}
