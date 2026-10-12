"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { FormRenderer } from "@/components/forms/FormRenderer";
import { getForm, type FormRow } from "@/app/actions/mjengo-forms";
import { MjengoLoader } from "../../../_components/MjengoLoader";

/** The form exactly as people will see it: its own page, its own background, nothing submitted. */
export default function FormPreviewPage() {
	const { id } = useParams<{ id: string }>();
	const [form, setForm] = useState<FormRow | null | undefined>(undefined);
	useEffect(() => { getForm(id).then(setForm).catch(() => setForm(null)); }, [id]);

	if (form === undefined) return <MjengoLoader label="Opening the preview" />;
	if (!form) return <p className="py-20 text-center text-sm text-serene-neutral-500">That form no longer exists.</p>;
	const s = form.settings ?? {};
	const pub = {
		slug: form.slug, title: form.title || "Untitled form", description: form.description || null, questions: form.questions,
		collectEmail: !!s.collectEmail, unavailable: null, confirmation: s.confirmation || "Thank you.",
		layout: s.layout === "single" ? "single" : "page", allowAnonymous: s.allowAnonymous !== false, images: s.images ?? [],
		accent: s.style?.accent || "#068297", background: s.style?.background || "#f4f7f8", responder: null,
	} as const;

	return (
		<div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: pub.background }}>
			<div className="sticky top-0 z-10 flex items-center gap-3 bg-black/80 px-4 py-2 text-sm text-white backdrop-blur">
				<Link href={`/dashboard/mjengo/forms/${id}`} className="flex items-center gap-1.5 rounded-md px-2 py-1 hover:bg-white/10"><ArrowLeft className="h-4 w-4" /> Back to editing</Link>
				<span className="text-white/70">Preview: nothing is submitted</span>
			</div>
			<main className="min-h-[100dvh] px-4 py-8 sm:py-12">
				<div className="mx-auto w-full max-w-2xl">
					<FormRenderer form={pub} preview />
					<p className="mt-8 text-center text-xs text-gray-400">Sauti Salama · Please do not share passwords or card numbers in forms.</p>
				</div>
			</main>
		</div>
	);
}
