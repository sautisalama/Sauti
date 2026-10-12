"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FormRenderer } from "@/components/forms/FormRenderer";
import { getForm, type FormRow } from "@/app/actions/mjengo-forms";
import { toPublicForm } from "@/lib/forms/public-view";
import type { Device } from "@/lib/forms/schema";
import { DeviceToggle, DevicePreview } from "../_Design";
import { MjengoLoader } from "../../../_components/MjengoLoader";

/** The form exactly as people will see it: its own page, its own theme, nothing submitted. Real size, or in a phone or desktop frame. */
export default function FormPreviewPage() {
	const { id } = useParams<{ id: string }>();
	const [form, setForm] = useState<FormRow | null | undefined>(undefined);
	const [frame, setFrame] = useState<"full" | Device>("full");
	useEffect(() => { getForm(id).then(setForm).catch(() => setForm(null)); }, [id]);

	if (form === undefined) return <MjengoLoader label="Opening the preview" />;
	if (!form) return <p className="py-20 text-center text-sm text-serene-neutral-500">That form no longer exists.</p>;
	const src = { slug: form.slug, title: form.title, description: form.description, questions: form.questions, settings: form.settings ?? {} };

	return (
		<div className="fixed inset-0 z-50 flex flex-col bg-neutral-100">
			<div className="flex shrink-0 flex-wrap items-center gap-3 bg-black/85 px-4 py-2 text-sm text-white backdrop-blur">
				<Link href={`/dashboard/mjengo/forms/${id}`} className="flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-white/10"><ArrowLeft className="h-4 w-4" /> Back to editing</Link>
				<span className="hidden text-white/70 sm:inline">Preview: nothing is submitted</span>
				<div className="ml-auto flex items-center gap-1 rounded-lg bg-white/10 p-0.5">
					{([["full", "This screen"], ["desktop", "Desktop"], ["mobile", "Phone"]] as const).map(([k, l]) => (
						<button key={k} onClick={() => setFrame(k)} aria-pressed={frame === k} className={frame === k ? "rounded-md bg-white px-2.5 py-1 text-xs font-medium text-black" : "rounded-md px-2.5 py-1 text-xs text-white/80"}>{l}</button>
					))}
				</div>
			</div>
			<div className="min-h-0 flex-1 overflow-auto">
				{frame === "full" ? (
					<div className="relative h-full"><FormRenderer form={toPublicForm(src)} preview embedded /></div>
				) : (
					<div className="mx-auto max-w-[1100px] p-4"><DevicePreview form={src} device={frame} /></div>
				)}
			</div>
		</div>
	);
}
