"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, PlayCircle } from "lucide-react";
import { enrollInCourse } from "@/app/actions/courses";

export function EnrollButton({ courseId, firstLessonHref }: { courseId: string; firstLessonHref: string | null }) {
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	return (
		<div>
			<button
				disabled={busy}
				onClick={async () => {
					setBusy(true);
					setError(null);
					const res = await enrollInCourse(courseId);
					if (!res.ok) {
						setBusy(false);
						return setError(res.error);
					}
					router.push(firstLessonHref ?? "/dashboard/learning");
				}}
				className="flex w-full items-center justify-center gap-2 rounded-full bg-[#1a365d] px-6 py-3.5 text-base font-black text-white transition-all hover:bg-sauti-teal active:scale-[0.98] disabled:opacity-60"
			>
				{busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <PlayCircle className="h-5 w-5" aria-hidden />} Start course
			</button>
			{error && <p role="alert" className="mt-2 text-sm font-semibold text-red-700">{error}</p>}
		</div>
	);
}
