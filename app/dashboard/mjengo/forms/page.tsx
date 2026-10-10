"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ClipboardList, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { createForm, listForms, type FormRow } from "@/app/actions/mjengo-forms";

const STATUS: Record<FormRow["status"], { label: string; tone: string }> = {
	draft: { label: "Draft", tone: "bg-slate-100 text-slate-700" },
	open: { label: "Accepting responses", tone: "bg-emerald-100 text-emerald-800" },
	closed: { label: "Closed", tone: "bg-rose-100 text-rose-800" },
};

export default function FormsPage() {
	const { toast } = useToast();
	const router = useRouter();
	const [forms, setForms] = useState<FormRow[] | null>(null);
	const [busy, setBusy] = useState(false);

	useEffect(() => {
		listForms().then(setForms).catch(() => setForms([]));
	}, []);

	const create = async () => {
		setBusy(true);
		try {
			router.push(`/dashboard/mjengo/forms/${await createForm()}`);
		} catch (e) {
			toast({ title: "Could not create the form", description: e instanceof Error ? e.message : undefined, variant: "destructive" });
			setBusy(false);
		}
	};

	return (
		<div className="space-y-5">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 className="text-lg font-bold text-serene-neutral-900">Forms</h2>
					<p className="text-sm text-serene-neutral-500">Build a form, share the link or QR code, and read the responses as a table or as charts.</p>
				</div>
				<Button onClick={create} disabled={busy} className="gap-1.5 bg-purple-600 hover:bg-purple-700">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} New form</Button>
			</div>

			{!forms ? (
				<div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-serene-neutral-400" /></div>
			) : forms.length === 0 ? (
				<div className="rounded-2xl border border-dashed border-serene-neutral-200 bg-white p-12 text-center">
					<ClipboardList className="mx-auto h-10 w-10 text-serene-neutral-300" />
					<p className="mt-3 font-semibold text-serene-neutral-900">No forms yet</p>
					<p className="mt-1 text-sm text-serene-neutral-500">Surveys, sign-ups, feedback, applications: create one in a few minutes.</p>
				</div>
			) : (
				<ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{forms.map((f) => (
						<li key={f.id}>
							<Link href={`/dashboard/mjengo/forms/${f.id}`} className="block h-full rounded-2xl border border-serene-neutral-100 border-t-4 border-t-purple-500 bg-white p-4 transition hover:shadow-md">
								<div className="flex items-start justify-between gap-2">
									<h3 className="line-clamp-2 font-semibold text-serene-neutral-900">{f.title}</h3>
									<Badge className={`${STATUS[f.status].tone} shrink-0 hover:${STATUS[f.status].tone}`}>{STATUS[f.status].label}</Badge>
								</div>
								<p className="mt-3 text-2xl font-bold tabular-nums text-serene-neutral-900">{f.response_count}</p>
								<p className="text-xs text-serene-neutral-500">
									responses{f.last_response_at ? ` · last ${formatDistanceToNow(new Date(f.last_response_at), { addSuffix: true })}` : ""}
								</p>
								<p className="mt-3 text-xs text-serene-neutral-400">{f.questions.length} question{f.questions.length === 1 ? "" : "s"} · edited {formatDistanceToNow(new Date(f.updated_at), { addSuffix: true })}</p>
							</Link>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
