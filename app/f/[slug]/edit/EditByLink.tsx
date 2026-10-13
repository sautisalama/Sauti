"use client";

import { useEffect, useState } from "react";
import { Loader2, Lock } from "lucide-react";
import { unwrap } from "@/lib/action-result";
import { formForEditLink } from "@/app/actions/form-share";
import { FormBuilder } from "@/app/dashboard/mjengo/forms/[id]/_Builder";

/** The form builder for someone who holds an edit link. They need no account; the link's key is the proof. */
export function EditByLink({ slug, k }: { slug: string; k: string }) {
	const [id, setId] = useState<string | null | undefined>(undefined);

	useEffect(() => { unwrap(formForEditLink(slug, k)).then((r) => setId(r?.id ?? null)).catch(() => setId(null)); }, [slug, k]);

	if (id === undefined) return <div className="flex min-h-dvh items-center justify-center text-serene-neutral-400"><Loader2 className="h-6 w-6 animate-spin" /></div>;
	if (id === null) return <div className="mx-auto flex min-h-dvh max-w-sm flex-col items-center justify-center gap-3 p-6 text-center"><Lock className="h-8 w-8 text-serene-neutral-300" /><p className="text-sm text-serene-neutral-600">This edit link is not valid any more. Ask the person who shared it for a new one.</p></div>;
	return <div className="mx-auto max-w-6xl p-4"><FormBuilder id={id} accessKey={k} /></div>;
}
