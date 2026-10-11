"use client";

import { MjengoLoader } from "../_components/MjengoLoader";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { ClipboardList, LayoutGrid, List as ListIcon, Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { createForm, listForms, type FormRow } from "@/app/actions/mjengo-forms";

const STATUS: Record<FormRow["status"], { label: string; tone: string }> = {
	draft: { label: "Draft", tone: "bg-slate-100 text-slate-700" },
	open: { label: "Accepting responses", tone: "bg-emerald-100 text-emerald-800" },
	closed: { label: "Closed", tone: "bg-rose-100 text-rose-800" },
};

const when = (iso: string) => formatDistanceToNow(new Date(iso), { addSuffix: true });

export default function FormsPage() {
	const { toast } = useToast();
	const router = useRouter();
	const [forms, setForms] = useState<FormRow[] | null>(null);
	const [busy, setBusy] = useState(false);
	const [view, setView] = useState<"cards" | "list">("cards");

	useEffect(() => {
		listForms().then(setForms).catch(() => setForms([]));
		try { const v = localStorage.getItem("ss_forms_view"); if (v === "cards" || v === "list") setView(v); } catch { /* default */ }
	}, []);
	const changeView = (v: "cards" | "list") => { setView(v); try { localStorage.setItem("ss_forms_view", v); } catch { /* ignore */ } };

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
		<div className="mx-auto max-w-6xl space-y-4">
			<div className="flex flex-wrap items-end justify-between gap-3">
				<div>
					<h2 className="text-xl font-bold tracking-tight text-sauti-dark">Forms</h2>
					<p className="text-sm text-serene-neutral-500">Build a form, share the link or QR code, and read the responses as a table or as charts.</p>
				</div>
				<div className="flex items-center gap-2">
					<div className="inline-flex rounded-lg border border-serene-neutral-200 bg-white p-0.5" role="group" aria-label="View">
						<button onClick={() => changeView("cards")} aria-pressed={view === "cards"} aria-label="Cards" className={cn("flex h-7 w-7 items-center justify-center rounded-md", view === "cards" ? "bg-sauti-teal text-white" : "text-serene-neutral-600")}><LayoutGrid className="h-4 w-4" /></button>
						<button onClick={() => changeView("list")} aria-pressed={view === "list"} aria-label="List" className={cn("flex h-7 w-7 items-center justify-center rounded-md", view === "list" ? "bg-sauti-teal text-white" : "text-serene-neutral-600")}><ListIcon className="h-4 w-4" /></button>
					</div>
					<Button onClick={create} disabled={busy} size="sm" className="h-8 gap-1.5 bg-sauti-teal px-3 text-xs hover:bg-sauti-dark">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} New form</Button>
				</div>
			</div>

			{!forms ? (
				<MjengoLoader label="Loading forms" />
			) : forms.length === 0 ? (
				<div className="rounded-2xl border border-dashed border-serene-neutral-200 bg-white p-12 text-center">
					<span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-sauti-teal-light text-sauti-teal"><ClipboardList className="h-6 w-6" /></span>
					<p className="font-semibold text-serene-neutral-900">No forms yet</p>
					<p className="mt-1 text-sm text-serene-neutral-500">Surveys, sign-ups, feedback, applications: create one in a few minutes.</p>
				</div>
			) : view === "cards" ? (
				<ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
					{forms.map((f) => {
						const cover = f.settings?.images?.[0];
						const accent = f.settings?.style?.accent || "#068297";
						return (
							<li key={f.id}>
								<Link href={`/dashboard/mjengo/forms/${f.id}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-serene-neutral-200/70 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)] transition hover:border-sauti-teal/40 hover:shadow-md">
									{cover ? (
										<img src={cover} alt="" className="h-32 w-full object-cover" />
									) : (
										<div className="flex h-32 items-end p-4" style={{ background: `linear-gradient(135deg, ${accent}22, ${accent}55)` }}>
											<ClipboardList className="h-8 w-8" style={{ color: accent }} />
										</div>
									)}
									<div className="flex flex-1 flex-col p-4">
										<div className="flex items-start justify-between gap-2">
											<h3 className="line-clamp-2 font-semibold text-serene-neutral-900">{f.title}</h3>
											<span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold", STATUS[f.status].tone)}>{STATUS[f.status].label}</span>
										</div>
										<div className="mt-auto flex items-end justify-between pt-4">
											<div>
												<p className="text-2xl font-bold tabular-nums text-serene-neutral-900">{f.response_count}</p>
												<p className="text-xs text-serene-neutral-500">responses{f.last_response_at ? ` · last ${when(f.last_response_at)}` : ""}</p>
											</div>
											<p className="text-right text-xs text-serene-neutral-400">{f.questions.length} question{f.questions.length === 1 ? "" : "s"}<br />edited {when(f.updated_at)}</p>
										</div>
									</div>
								</Link>
							</li>
						);
					})}
				</ul>
			) : (
				<div className="overflow-hidden rounded-2xl border border-serene-neutral-200/70 bg-white">
					<ul className="divide-y divide-serene-neutral-100">
						{forms.map((f) => (
							<li key={f.id}>
								<Link href={`/dashboard/mjengo/forms/${f.id}`} className="flex items-center gap-3 p-3 hover:bg-serene-neutral-50/70">
									{f.settings?.images?.[0] ? <img src={f.settings.images[0]} alt="" className="h-12 w-12 shrink-0 rounded-xl object-cover" /> : <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-sauti-teal-light text-sauti-teal"><ClipboardList className="h-5 w-5" /></span>}
									<span className="min-w-0 flex-1">
										<span className="block truncate text-sm font-semibold text-serene-neutral-900">{f.title}</span>
										<span className="block truncate text-xs text-serene-neutral-500">{f.questions.length} question{f.questions.length === 1 ? "" : "s"} · edited {when(f.updated_at)}</span>
									</span>
									<span className="hidden text-right sm:block"><span className="block text-sm font-semibold tabular-nums">{f.response_count}</span><span className="block text-xs text-serene-neutral-500">responses</span></span>
									<span className={cn("hidden shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold sm:inline", STATUS[f.status].tone)}>{STATUS[f.status].label}</span>
								</Link>
							</li>
						))}
					</ul>
				</div>
			)}
		</div>
	);
}
